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
import threading
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

# Per-user locks to prevent concurrent reindex operations.
_reindex_locks: dict[str, threading.Lock] = {}
_locks_lock = threading.Lock()

# Cooldown after failed reindex to prevent cascading retry storms.
# Maps user_id → timestamp of last failure.
_user_reindex_cooldowns: dict[str, float] = {}
_REINDEX_COOLDOWN_SECONDS = 60

# Batch size for embedding calls to stay under API rate limits.
_EMBED_BATCH_SIZE = 20
_EMBED_BATCH_DELAY = 1.0  # seconds between batches


def _get_user_lock(user_id: str) -> threading.Lock:
    """Get or create a per-user lock for reindex serialization."""
    with _locks_lock:
        if user_id not in _reindex_locks:
            _reindex_locks[user_id] = threading.Lock()
        return _reindex_locks[user_id]


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


def _timestamp(dt: Any) -> float:
    """Convert a datetime-like value to a Unix timestamp for numeric comparisons."""
    if isinstance(dt, datetime):
        return dt.timestamp()
    return 0.0


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
        "created_at_ts": _timestamp(interview.get("created_at")),
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

    logger.debug(
        "Built %d documents for interview %s (role=%s, date=%s, score=%s)",
        len(docs), interview_id, role, date_str, score,
    )
    return docs


def _is_on_cooldown(user_id: str) -> bool:
    """Check if a user's reindex is on cooldown after a recent failure."""
    import time
    last_failure = _user_reindex_cooldowns.get(user_id, 0)
    if time.time() - last_failure < _REINDEX_COOLDOWN_SECONDS:
        logger.info(
            "User %s: reindex on cooldown (failed %.0fs ago), skipping",
            user_id, time.time() - last_failure,
        )
        return True
    return False


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
        if _is_on_cooldown(user_id):
            return 0
        logger.info(
            "Interview count changed for user %s (%d → %d), re-indexing",
            user_id,
            _user_interview_counts[user_id],
            current_count,
        )
        return reindex_user(user_id)

    # First time seeing this user in this process — verify ChromaDB
    # has the correct number of interviews by checking stored metadata.
    client = _get_chroma_client()
    col_name = _collection_name(user_id)
    try:
        existing = client.get_collection(col_name)
        doc_count = existing.count()
        if doc_count > 0 and current_count > 0:
            # Verify by counting distinct interview_ids in ChromaDB
            all_meta = existing.get(include=["metadatas"])
            indexed_ids = set()
            for meta in (all_meta.get("metadatas") or []):
                iid = meta.get("interview_id")
                if iid:
                    indexed_ids.add(iid)
            indexed_interview_count = len(indexed_ids)

            if indexed_interview_count == current_count:
                # ChromaDB is in sync — safe to trust
                _user_interview_counts[user_id] = current_count
                logger.info(
                    "User %s: ChromaDB verified in-sync "
                    "(%d interviews, %d docs)",
                    user_id, indexed_interview_count, doc_count,
                )
                return 0
            else:
                # ChromaDB is stale — reindex
                if _is_on_cooldown(user_id):
                    # On cooldown but we still have SOME data — use it
                    _user_interview_counts[user_id] = indexed_interview_count
                    return 0
                logger.warning(
                    "User %s: ChromaDB STALE — %d interviews indexed "
                    "vs %d in MongoDB. Triggering re-index.",
                    user_id, indexed_interview_count, current_count,
                )
                return reindex_user(user_id)
    except Exception:
        # Collection doesn't exist yet — we'll create it below
        pass

    if current_count == 0:
        # No interviews to index
        _user_interview_counts[user_id] = 0
        return 0

    if _is_on_cooldown(user_id):
        return 0

    return reindex_user(user_id)


def reindex_user(user_id: str) -> int:
    """
    Rebuild the vector store for a user using upsert semantics.

    Key design choices to handle free-tier API rate limits (100 RPM):
      1. Does NOT drop the collection first — uses deterministic document
         IDs so ``add_documents`` acts as an upsert.  If embedding fails
         mid-way, the user still has their old (partial) data.
      2. Embeds documents in small batches with a delay between each to
         stay comfortably under the 100 RPM Gemini Embedding limit.
      3. On 429 rate-limit errors, waits with exponential backoff instead
         of immediately failing.
      4. After all documents are upserted, removes stale documents whose
         interview_id no longer exists in MongoDB.
      5. Sets a cooldown on failure so cascading retries don't hammer the
         API repeatedly within the same minute.

    Thread-safe: uses a per-user lock to prevent concurrent rebuilds.
    Returns the number of documents indexed.
    """
    lock = _get_user_lock(user_id)
    if not lock.acquire(blocking=False):
        # Another thread is already reindexing this user — skip.
        logger.info(
            "Reindex already in progress for user %s, skipping",
            user_id,
        )
        return 0

    try:
        import time
        start_time = time.time()
        logger.info("[REINDEX START] user=%s", user_id)

        client = _get_chroma_client()
        col_name = _collection_name(user_id)

        # Fetch interviews from MongoDB
        interviews = get_user_interviews(user_id)
        if not interviews:
            logger.info("No evaluated interviews found for user %s", user_id)
            # Safe to drop — there's genuinely nothing to keep
            try:
                client.delete_collection(col_name)
            except Exception:
                pass
            _user_interview_counts[user_id] = 0
            _user_reindex_cooldowns.pop(user_id, None)
            return 0

        # Build documents (each has a deterministic ID)
        all_docs: list[Document] = []
        for interview in interviews:
            all_docs.extend(_build_documents(interview))

        current_interview_ids = {i["interview_id"] for i in interviews}
        logger.info(
            "[REINDEX] Upserting %d documents for user %s "
            "(%d interviews: %s)",
            len(all_docs),
            user_id,
            len(interviews),
            sorted(current_interview_ids),
        )

        # Get or create the Chroma collection (NO drop!)
        vectorstore = Chroma(
            collection_name=col_name,
            embedding_function=_get_embeddings(),
            client=client,
        )

        # ── Batch upsert with rate-limit awareness ────────────────────
        embed_start = time.time()
        total_batches = (len(all_docs) + _EMBED_BATCH_SIZE - 1) // _EMBED_BATCH_SIZE

        for batch_idx in range(0, len(all_docs), _EMBED_BATCH_SIZE):
            batch = all_docs[batch_idx : batch_idx + _EMBED_BATCH_SIZE]
            batch_num = batch_idx // _EMBED_BATCH_SIZE + 1

            # Retry loop for this batch
            max_retries = 3
            for attempt in range(1, max_retries + 1):
                try:
                    vectorstore.add_documents(batch)
                    logger.debug(
                        "[REINDEX] Batch %d/%d done (%d docs)",
                        batch_num, total_batches, len(batch),
                    )
                    break  # success
                except Exception as exc:
                    err = str(exc)
                    is_rate_limit = (
                        "429" in err or "RESOURCE_EXHAUSTED" in err
                    )
                    if is_rate_limit and attempt < max_retries:
                        wait = min(10 * (2 ** attempt), 65)
                        logger.warning(
                            "[REINDEX] Rate limited on batch %d/%d "
                            "for user %s — waiting %ds "
                            "(attempt %d/%d)",
                            batch_num, total_batches,
                            user_id, wait, attempt, max_retries,
                        )
                        time.sleep(wait)
                    elif is_rate_limit:
                        # Final attempt also rate-limited
                        logger.error(
                            "[REINDEX PARTIAL] user=%s — rate limit "
                            "retries exhausted at batch %d/%d. "
                            "Partial data preserved.",
                            user_id, batch_num, total_batches,
                        )
                        _user_reindex_cooldowns[user_id] = time.time()
                        # Don't raise — partial data is better than no data
                        return 0
                    else:
                        # Non-rate-limit error — log and set cooldown
                        logger.exception(
                            "[REINDEX FAILED] user=%s at batch %d/%d",
                            user_id, batch_num, total_batches,
                        )
                        _user_reindex_cooldowns[user_id] = time.time()
                        raise

            # Small delay between batches to respect rate limits
            if batch_idx + _EMBED_BATCH_SIZE < len(all_docs):
                time.sleep(_EMBED_BATCH_DELAY)

        embed_elapsed = time.time() - embed_start

        # ── Clean up stale documents from deleted interviews ──────────
        try:
            collection = client.get_collection(col_name)
            all_meta = collection.get(include=["metadatas"])
            stale_ids = [
                doc_id
                for doc_id, meta in zip(
                    all_meta.get("ids", []),
                    all_meta.get("metadatas", []),
                )
                if meta.get("interview_id") not in current_interview_ids
            ]
            if stale_ids:
                collection.delete(ids=stale_ids)
                logger.info(
                    "[REINDEX] Removed %d stale documents for user %s",
                    len(stale_ids), user_id,
                )
        except Exception as exc:
            logger.warning(
                "[REINDEX] Failed to clean stale docs for user %s: %s",
                user_id, exc,
            )

        _user_interview_counts[user_id] = len(interviews)
        _user_reindex_cooldowns.pop(user_id, None)  # clear cooldown on success
        elapsed = time.time() - start_time
        logger.info(
            "[REINDEX COMPLETE] user=%s | interviews=%d | docs=%d | "
            "embed_time=%.2fs | total_time=%.2fs",
            user_id, len(interviews), len(all_docs),
            embed_elapsed, elapsed,
        )
        return len(all_docs)
    finally:
        lock.release()


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
        search_type="mmr",
        search_kwargs={
            "k": 8,
            "fetch_k": 30
        }
    )


def get_index_status(user_id: str) -> dict[str, Any]:
    """
    Return diagnostic information about a user's index state.
    Useful for debugging staleness issues.
    """
    from app.database import count_user_interviews as _count

    mongo_count = _count(user_id)
    cached_count = _user_interview_counts.get(user_id)

    client = _get_chroma_client()
    col_name = _collection_name(user_id)

    chroma_doc_count = 0
    chroma_interview_ids: list[str] = []
    chroma_interviews: list[dict[str, Any]] = []
    try:
        collection = client.get_collection(col_name)
        chroma_doc_count = collection.count()
        if chroma_doc_count > 0:
            all_meta = collection.get(include=["metadatas"])
            seen: dict[str, dict[str, Any]] = {}
            for meta in (all_meta.get("metadatas") or []):
                iid = meta.get("interview_id", "")
                if iid and iid not in seen:
                    seen[iid] = {
                        "interview_id": iid,
                        "role": meta.get("role", ""),
                        "date": meta.get("date", ""),
                        "score": meta.get("score", 0),
                    }
            chroma_interview_ids = sorted(seen.keys())
            chroma_interviews = list(seen.values())
    except Exception:
        pass

    needs_reindex = (
        cached_count is None
        or cached_count != mongo_count
        or len(chroma_interview_ids) != mongo_count
    )

    return {
        "user_id": user_id,
        "mongo_interview_count": mongo_count,
        "cached_count": cached_count,
        "chroma_doc_count": chroma_doc_count,
        "chroma_interview_count": len(chroma_interview_ids),
        "chroma_interview_ids": chroma_interview_ids,
        "chroma_interviews": chroma_interviews,
        "needs_reindex": needs_reindex,
        "collection_name": col_name,
    }
