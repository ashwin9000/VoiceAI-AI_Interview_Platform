"""
LangGraph RAG workflow for the Interview History Assistant.

Graph: START → rewrite_query → retrieve → generate → END

Uses:
  - InMemorySaver checkpointer for multi-turn conversation memory
  - Conversational query rewriting for better follow-up retrieval
  - ChromaDB retriever scoped to the user
  - Gemini 3.1 Flash Lite for generation
"""

import logging
import operator
from typing import Annotated, Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy
from typing_extensions import TypedDict

from app.config import get_settings
from app.vectorstore import get_retriever

logger = logging.getLogger(__name__)

# ── LLM Singleton ─────────────────────────────────────────────────────────
# Created once at module level, reused across all requests.

_llm: ChatGoogleGenerativeAI | None = None


def _get_llm() -> ChatGoogleGenerativeAI:
    """Cached Gemini LLM — created once."""
    global _llm
    if _llm is None:
        settings = get_settings()
        _llm = ChatGoogleGenerativeAI(
            model="gemini-3.1-flash-lite",
            google_api_key=settings.gemini_api_key,
            temperature=0.3,
            max_output_tokens=2048,
        )
    return _llm


# ── State Schema ───────────────────────────────────────────────────────────

class ChatState(TypedDict):
    """Graph state shared across all nodes.

    Field semantics:
      - ``messages`` uses ``operator.add`` → values are **appended** each turn.
        The checkpointer accumulates the full conversation history.
      - All other fields are plain types → values are **overwritten** each turn.
        This is intentional: retrieved_docs/sources should always reflect the
        current query, not accumulate across turns.
    """

    messages: Annotated[list, operator.add]  # Conversation history (appends)
    user_id: str  # Authenticated user (overwritten each invoke)
    standalone_query: str  # Rewritten query for retrieval (overwritten per turn)
    retrieved_docs: list[dict[str, Any]]  # Overwritten per turn (fresh retrieval)
    retrieved_sources: list[dict[str, Any]]  # Overwritten per turn


# ── System Prompt ──────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are the **Interview History Assistant** for the AI Interviewer platform.
Your role is to help users analyze, understand, and learn from their past interview performance.

## Rules
1. **ONLY** use information from the retrieved interview documents provided below. Never fabricate or guess data.
2. If the retrieved context doesn't contain enough information to answer, say so honestly.
3. Reference specific interviews by their role and date when citing data.
4. Use markdown formatting for clarity: bold for emphasis, bullet lists for multiple items, tables for comparisons.
5. Be encouraging but honest. Highlight both strengths and areas for improvement.
6. When asked about trends or progress, compare scores and feedback across multiple interviews.
7. For study plan or practice question requests, base them on the weaknesses and recommendations from the user's actual interview data.

## Retrieved Interview Data
{context}
"""

# ── Query Rewrite Prompt ───────────────────────────────────────────────────

QUERY_REWRITE_PROMPT = """Given the following conversation history and a new follow-up question, \
rewrite the follow-up question as a standalone, self-contained search query. \
The rewritten query should capture the full intent by incorporating relevant \
context from the conversation history.

Rules:
1. If the new question is already self-contained and specific, return it as-is.
2. Resolve all pronouns and references (e.g. "it", "that", "those", "them") using the conversation context.
3. Keep the rewritten query concise but semantically rich for vector search.
4. Output ONLY the rewritten query — no explanation, no preamble.

Conversation history:
{chat_history}

Follow-up question: {question}

Standalone query:"""

# ── Nodes ──────────────────────────────────────────────────────────────────


def rewrite_query(state: ChatState) -> dict:
    """
    Rewrite follow-up questions into standalone, context-rich queries.

    On the first turn (no prior conversation), the original question is
    passed through unchanged. On subsequent turns, the LLM rewrites the
    question using conversation history so the retriever gets a
    semantically rich query instead of a bare follow-up like
    "so what do I do about it".
    """
    messages = state["messages"]

    # Extract the latest human message
    question = ""
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage):
            question = msg.content if isinstance(msg.content, str) else str(msg.content)
            break

    if not question:
        return {"standalone_query": ""}

    # Collect prior conversation history (everything before the latest message)
    history_msgs = messages[:-1] if len(messages) > 1 else []

    # First turn — no history to rewrite against
    if not history_msgs:
        logger.info("First turn — using original query: %.80s…", question)
        return {"standalone_query": question}

    # Build a readable chat history string for the rewrite prompt
    history_lines = []
    for msg in history_msgs[-10:]:  # Last 10 messages for context
        if isinstance(msg, HumanMessage):
            history_lines.append(f"User: {msg.content}")
        elif isinstance(msg, AIMessage):
            # Truncate long AI responses to keep the rewrite prompt focused
            content = msg.content if isinstance(msg.content, str) else str(msg.content)
            if len(content) > 500:
                content = content[:500] + "…"
            history_lines.append(f"Assistant: {content}")

    chat_history = "\n".join(history_lines)

    # Ask the LLM to rewrite the follow-up into a standalone query
    llm = _get_llm()
    rewrite_prompt = QUERY_REWRITE_PROMPT.format(
        chat_history=chat_history,
        question=question,
    )
    response = llm.invoke([HumanMessage(content=rewrite_prompt)])

    standalone = response.content
    if not isinstance(standalone, str):
        standalone = str(standalone)
    standalone = standalone.strip()

    logger.info(
        "Query rewrite: '%s' → '%s'",
        question[:80],
        standalone[:120],
    )

    return {"standalone_query": standalone}


def retrieve(state: ChatState) -> dict:
    """
    Retrieve relevant interview documents using the standalone query
    produced by the rewrite_query node.
    """
    user_id = state["user_id"]
    query = state.get("standalone_query", "")

    if not query:
        return {"retrieved_docs": [], "retrieved_sources": []}

    retriever = get_retriever(user_id)
    docs = retriever.invoke(query)

    # Build structured doc list and source references
    retrieved_docs = []
    retrieved_sources = []
    seen_interviews: set[str] = set()

    for doc in docs:
        retrieved_docs.append(
            {
                "content": doc.page_content,
                "metadata": doc.metadata,
            }
        )

        # Deduplicated source references
        iid = doc.metadata.get("interview_id", "")
        if iid and iid not in seen_interviews:
            seen_interviews.add(iid)
            retrieved_sources.append(
                {
                    "interview_id": iid,
                    "role": doc.metadata.get("role", "Unknown"),
                    "date": doc.metadata.get("date", ""),
                    "score": doc.metadata.get("score", 0),
                    "grade": doc.metadata.get("grade", ""),
                }
            )

    # Log retrieval diagnostics for debugging stale data issues
    for i, doc in enumerate(retrieved_docs):
        meta = doc["metadata"]
        logger.info(
            "  [Retrieved doc %d] interview=%s | date=%s | "
            "type=%s | score=%s | preview=%.100s…",
            i + 1,
            meta.get("interview_id", "?")[:12],
            meta.get("date", "?"),
            meta.get("doc_type", "?"),
            meta.get("score", "?"),
            doc["content"][:100].replace("\n", " "),
        )
    logger.info(
        "Retrieved %d docs from %d interviews for query: %.60s…",
        len(retrieved_docs),
        len(retrieved_sources),
        query,
    )

    return {
        "retrieved_docs": retrieved_docs,
        "retrieved_sources": retrieved_sources,
    }


def generate(state: ChatState) -> dict:
    """
    Generate a response using Gemini, grounded in retrieved interview data.
    Maintains conversation context through the messages list.
    """
    llm = _get_llm()

    # Build context string from retrieved docs
    context_parts = []
    for i, doc in enumerate(state.get("retrieved_docs", []), 1):
        meta = doc.get("metadata", {})
        header = (
            f"[Document {i} — {meta.get('role', 'Unknown')} interview, "
            f"{meta.get('date', 'unknown date')}, "
            f"Score: {meta.get('score', 'N/A')}]"
        )
        context_parts.append(f"{header}\n{doc['content']}")

    context = "\n\n---\n\n".join(context_parts) if context_parts else (
        "No interview data was found. The user may not have completed "
        "any interviews yet."
    )

    # Build message list: system + conversation history
    system_msg = SystemMessage(content=SYSTEM_PROMPT.format(context=context))

    # Only keep recent conversation turns (last 20 messages) to stay in context
    conversation = state["messages"][-20:]

    llm_messages = [system_msg, *conversation]
    response = llm.invoke(llm_messages)

    # Ensure content is always a plain string.
    # ChatGoogleGenerativeAI can return content as a list of content blocks
    # (e.g. [{"type": "text", "text": "..."}]) instead of a plain string.
    content = response.content
    if not isinstance(content, str):
        # Flatten list of content parts into a single string
        if isinstance(content, list):
            parts = []
            for part in content:
                if isinstance(part, str):
                    parts.append(part)
                elif isinstance(part, dict) and "text" in part:
                    parts.append(part["text"])
                else:
                    parts.append(str(part))
            content = "\n".join(parts)
        else:
            content = str(content)

    return {
        "messages": [AIMessage(content=content)],
    }


# ── Graph Assembly ─────────────────────────────────────────────────────────

# Retry policy for transient errors (Gemini API rate limits, network issues)
_retry = RetryPolicy(max_attempts=3, initial_interval=1.0)


def build_graph():
    """
    Build and compile the RAG chat graph with an in-memory checkpointer
    for multi-turn conversation support.
    """
    checkpointer = InMemorySaver()

    graph = (
        StateGraph(ChatState)
        .add_node("rewrite_query", rewrite_query, retry=_retry)
        .add_node("retrieve", retrieve, retry=_retry)
        .add_node("generate", generate, retry=_retry)
        .add_edge(START, "rewrite_query")
        .add_edge("rewrite_query", "retrieve")
        .add_edge("retrieve", "generate")
        .add_edge("generate", END)
        .compile(checkpointer=checkpointer)
    )

    return graph


# Module-level graph instance — reused across requests
chat_graph = build_graph()
