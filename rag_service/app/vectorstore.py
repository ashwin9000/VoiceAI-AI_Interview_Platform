"""
ChromaDB vector store management.

Each user gets their own collection scoped by user_id.
Interviews are split into multiple document types for fine-grained retrieval:
  - Overview documents (scores, grades, metadata)
  - Q&A documents (individual question-answer pairs)
  - Strengths / Weaknesses / Recommendations documents

Staleness detection:
  The module tracks how many interviews were indexed per user. On each
  request, it compares the current MongoDB count with the indexed count
  and auto-reindexes when they differ (e.g. after a new interview is
  completed).
"""

import logging
from datetime import datetime
from typing import Any

import chromadb
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_google_genai import GoogleGenerativeAIEmbeddings

from app.config import get_settings
from app.database import count_user_interviews, get_user_interviews

logger = logging.getLogger(__name__)

# Module-level singletons
_chroma_client: chromadb.ClientAPI | None = None
_embeddings: GoogleGenerativeAIEmbeddings | None = None

# Track how many interviews were indexed per user so we can detect staleness.
# Maps user_id → interview count at the time of last index.
_user_interview_counts: dict[str, int] = {}


def _get_chroma_client() -> chromadb.ClientAPI:
    """Persistent ChromaDB client — created once."""
    global _chroma_client
    if _chroma_client is None:
        settings = get_settings()
        _chroma_client = chromadb.PersistentClient(
            path=settings.chroma_persist_dir
        )
    return _chroma_client


def _get_embeddings() -> GoogleGenerativeAIEmbeddings:
    """Gemini embedding model — created once."""
    global _embeddings
    if _embeddings is None:
        settings = get_settings()
        _embeddings = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-2",
            google_api_key=settings.gemini_api_key,
        )
    return _embeddings


def _collection_name(user_id: str) -> str:
    """Deterministic collection name for a user."""
    # ChromaDB collection names: 3-63 chars, alphanum + underscores/hyphens
    return f"user_{user_id}"


def _format_date(dt: Any) -> str:
    """Safely format a datetime-like value to a readable string."""
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d %H:%M")
    if dt is not None:
        return str(dt)
    return "Unknown date"


def _doc_id(interview_id: str, doc_type: str, index: int = 0) -> str:
    """
    Generate a deterministic document ID.

    Using deterministic IDs prevents duplicates if reindex is called
    multiple times, and makes upsert-style updates possible.
    """
    return f"{interview_id}_{doc_type}_{index}"


def _build_documents(interview: dict[str, Any]) -> list[Document]:
    """
    Convert a single interview+report record into multiple LangChain Documents.
    Each document has metadata for filtering/display and a deterministic ID.
    """
    interview_id = interview["interview_id"]
    role = interview["role"]
    score = interview.get("overall_score") or interview.get("score", 0)
    grade = interview.get("grade", "N/A")
    date_str = _format_date(interview.get("created_at"))
    duration = interview.get("duration", 0)
    hiring_rec = interview.get("hiring_recommendation", "")

    base_metadata = {
        "interview_id": interview_id,
        "user_id": interview["user_id"],
        "role": role,
        "score": score,
        "grade": grade,
        "date": date_str,
        "duration_minutes": round(duration / 60, 1) if duration else 0,
    }

    docs: list[Document] = []

    # 1. Overview document
    section_scores = interview.get("section_scores", {})
    section_text = "\n".join(
        f"  - {k.replace('_', ' ').title()}: {v}/100"
        for k, v in section_scores.items()
        if v
    )
    feedback = interview.get("feedback", "")

    overview_content = (
        f"Interview Overview for {role} position\n"
        f"Date: {date_str}\n"
        f"Overall Score: {score}/100 (Grade: {grade})\n"
        f"Duration: {base_metadata['duration_minutes']} minutes\n"
        f"Hiring Recommendation: {hiring_rec}\n"
        f"Section Scores:\n{section_text}\n"
        f"Overall Feedback: {feedback}"
    )
    docs.append(
        Document(
            page_content=overview_content,
            metadata={**base_metadata, "doc_type": "overview"},
            id=_doc_id(interview_id, "overview"),
        )
    )

    # 2. Q&A documents — one per question-answer pair
    questions = interview.get("questions", [])
    answers = interview.get("answers", [])
    answer_map = {a.get("questionIndex", i): a for i, a in enumerate(answers)}

    for idx, q in enumerate(questions):
        q_text = q.get("text", "")
        q_type = q.get("type", "unknown")
        q_difficulty = q.get("difficulty", "unknown")
        is_followup = q.get("isFollowUp", False)

        answer = answer_map.get(idx, {})
        a_text = answer.get("text", "No answer provided")

        qa_content = (
            f"Interview Question ({role} — {q_type}, {q_difficulty}):\n"
            f"Q: {q_text}\n"
            f"A: {a_text}\n"
            f"{'(This was a follow-up question)' if is_followup else ''}"
        )
        docs.append(
            Document(
                page_content=qa_content,
                metadata={
                    **base_metadata,
                    "doc_type": "qa",
                    "question_index": idx,
                    "question_type": q_type,
                    "difficulty": q_difficulty,
                },
                id=_doc_id(interview_id, "qa", idx),
            )
        )

    # 3. Strengths document
    strengths = interview.get("strengths", [])
    if strengths:
        strengths_text = (
            f"Strengths identified in {role} interview ({date_str}, "
            f"Score: {score}/100):\n"
            + "\n".join(f"  • {s}" for s in strengths)
        )
        docs.append(
            Document(
                page_content=strengths_text,
                metadata={**base_metadata, "doc_type": "strengths"},
                id=_doc_id(interview_id, "strengths"),
            )
        )

    # 4. Weaknesses document
    weaknesses = interview.get("weaknesses", [])
    if weaknesses:
        weaknesses_text = (
            f"Weaknesses identified in {role} interview ({date_str}, "
            f"Score: {score}/100):\n"
            + "\n".join(f"  • {w}" for w in weaknesses)
        )
        docs.append(
            Document(
                page_content=weaknesses_text,
                metadata={**base_metadata, "doc_type": "weaknesses"},
                id=_doc_id(interview_id, "weaknesses"),
            )
        )

    # 5. Recommendations document
    recommendations = interview.get("recommendations", [])
    resources = interview.get("learning_resources", [])
    if recommendations or resources:
        rec_parts = []
        if recommendations:
            rec_parts.append(
                "Improvement Recommendations:\n"
                + "\n".join(f"  • {r}" for r in recommendations)
            )
        if resources:
            res_lines = [
                f"  • {r.get('topic', 'Topic')}: {r.get('url', '')}"
                for r in resources
            ]
            rec_parts.append(
                "Learning Resources:\n" + "\n".join(res_lines)
            )

        docs.append(
            Document(
                page_content=(
                    f"Recommendations for {role} interview "
                    f"({date_str}):\n" + "\n".join(rec_parts)
                ),
                metadata={**base_metadata, "doc_type": "recommendations"},
                id=_doc_id(interview_id, "recommendations"),
            )
        )

    return docs


def ensure_user_indexed(user_id: str) -> int:
    """
    Index a user's interviews if not already indexed, or re-index when
    the interview count in MongoDB has changed (new interviews completed).

    Returns the number of documents indexed (0 if already up-to-date).
    """
    # Quick check: how many interviews does MongoDB have now?
    current_count = count_user_interviews(user_id)

    # If we've indexed before and the count hasn't changed, skip.
    if user_id in _user_interview_counts:
        if _user_interview_counts[user_id] == current_count:
            return 0
        # Count changed → new interviews exist, need re-index
        logger.info(
            "Interview count changed for user %s (%d → %d), re-indexing",
            user_id,
            _user_interview_counts[user_id],
            current_count,
        )
        return reindex_user(user_id)

    # First time seeing this user in this process — check ChromaDB.
    client = _get_chroma_client()
    col_name = _collection_name(user_id)
    try:
        existing = client.get_collection(col_name)
        if existing.count() > 0 and current_count > 0:
            # Collection exists and has data. Trust it, record the count.
            _user_interview_counts[user_id] = current_count
            logger.info(
                "User %s already has %d docs in vector store "
                "(%d interviews in DB)",
                user_id,
                existing.count(),
                current_count,
            )
            return 0
    except Exception:
        # Collection doesn't exist yet — we'll create it below
        pass

    if current_count == 0:
        # No interviews to index
        _user_interview_counts[user_id] = 0
        return 0

    return reindex_user(user_id)


def reindex_user(user_id: str) -> int:
    """
    Drop and rebuild the vector store for a user.
    Returns the number of documents indexed.
    """
    client = _get_chroma_client()
    col_name = _collection_name(user_id)

    # Drop existing collection
    try:
        client.delete_collection(col_name)
        logger.info("Dropped existing collection %s", col_name)
    except Exception:
        pass

    # Fetch interviews from MongoDB
    interviews = get_user_interviews(user_id)
    if not interviews:
        logger.info("No evaluated interviews found for user %s", user_id)
        _user_interview_counts[user_id] = 0
        return 0

    # Build documents (each has a deterministic ID)
    all_docs: list[Document] = []
    for interview in interviews:
        all_docs.extend(_build_documents(interview))

    logger.info(
        "Indexing %d documents for user %s (%d interviews)",
        len(all_docs),
        user_id,
        len(interviews),
    )

    # Create Chroma collection and add documents
    try:
        vectorstore = Chroma(
            collection_name=col_name,
            embedding_function=_get_embeddings(),
            client=client,
        )
        vectorstore.add_documents(all_docs)
    except Exception:
        logger.exception(
            "Failed to index documents for user %s — "
            "next request will retry",
            user_id,
        )
        # Don't update _user_interview_counts so the next request retries
        raise

    _user_interview_counts[user_id] = len(interviews)
    return len(all_docs)


def get_retriever(user_id: str):
    """
    Return a LangChain retriever scoped to a user's collection.
    Uses similarity search with k=8 results.
    """
    ensure_user_indexed(user_id)

    client = _get_chroma_client()
    col_name = _collection_name(user_id)

    vectorstore = Chroma(
        collection_name=col_name,
        embedding_function=_get_embeddings(),
        client=client,
    )

    return vectorstore.as_retriever(
        search_type="similarity",
        search_kwargs={"k": 8},
    )
