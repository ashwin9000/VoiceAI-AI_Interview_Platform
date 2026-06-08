"""
FastAPI router for chat endpoints.

Endpoints:
  POST /chat          — SSE-streamed chat response
  POST /reindex       — Rebuild vector store for user
  GET  /chat-history/{session_id} — Retrieve conversation history
"""

import asyncio
import logging
import uuid
from collections.abc import AsyncIterable

from fastapi import APIRouter
from fastapi.sse import EventSourceResponse, ServerSentEvent
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage
from pydantic import BaseModel, Field

from app.auth import CurrentUserId
from app.graph import chat_graph
from app.vectorstore import ensure_user_indexed, reindex_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


# ── Request / Response Models ──────────────────────────────────────────────


class ChatRequest(BaseModel):
    """Incoming chat message."""

    message: str
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))


class ReindexResponse(BaseModel):
    """Response after reindexing."""

    success: bool
    documents_indexed: int


class ChatHistoryMessage(BaseModel):
    """Single message in chat history."""

    role: str
    content: str


class ChatHistoryResponse(BaseModel):
    """Chat history for a session."""

    session_id: str
    messages: list[ChatHistoryMessage]


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.post("", response_class=EventSourceResponse)
async def chat(
    body: ChatRequest, user_id: CurrentUserId
) -> AsyncIterable[ServerSentEvent]:
    """
    Send a chat message and receive a streamed response via SSE.

    Uses LangGraph's ``stream_mode="messages"`` to stream individual LLM
    tokens from the *generate* node in real time, rather than waiting for
    the full response.

    Events emitted:
      - event: token   → data: partial response text (real-time LLM token)
      - event: sources → data: JSON array of interview references
      - event: done    → data: full response text (signal completion)
      - event: error   → data: error message
    """
    logger.info(
        "Chat request from user %s, session %s: %.80s…",
        user_id,
        body.session_id,
        body.message,
    )

    # Ensure the user's interviews are indexed (blocking → threadpool)
    try:
        indexed = await asyncio.to_thread(ensure_user_indexed, user_id)
        if indexed > 0:
            logger.info("Indexed %d documents for user %s", indexed, user_id)
    except Exception as exc:
        logger.error("Indexing failed for user %s: %s", user_id, exc)
        # Continue anyway — retrieval will just return empty results

    # Stream the LangGraph workflow with real token-level streaming
    config = {"configurable": {"thread_id": f"{user_id}_{body.session_id}"}}
    input_data = {
        "messages": [HumanMessage(content=body.message)],
        "user_id": user_id,
        "standalone_query": "",
        "retrieved_docs": [],
        "retrieved_sources": [],
    }

    try:
        full_text = ""

        # astream with stream_mode="messages" yields (message_chunk, metadata)
        # tuples. LangGraph intercepts LLM calls and emits individual tokens
        # as AIMessageChunk objects. We filter for the "generate" node so we
        # don't accidentally stream the query-rewrite LLM output to the user.
        async for chunk_msg, metadata in chat_graph.astream(
            input_data, config, stream_mode="messages"
        ):
            if (
                isinstance(chunk_msg, AIMessageChunk)
                and metadata.get("langgraph_node") == "generate"
                and chunk_msg.content
            ):
                # Gemini returns content as a list of content blocks
                # e.g. [{'type': 'text', 'text': 'token', 'index': 0}]
                # instead of a plain string. Extract the actual text.
                raw = chunk_msg.content
                if isinstance(raw, str):
                    token = raw
                elif isinstance(raw, list):
                    parts = []
                    for part in raw:
                        if isinstance(part, str):
                            parts.append(part)
                        elif isinstance(part, dict) and part.get("text"):
                            parts.append(part["text"])
                    token = "".join(parts)
                else:
                    token = str(raw)

                if not token:
                    continue

                full_text += token
                yield ServerSentEvent(
                    data={"text": token},
                    event="token",
                )

        # Retrieve sources from the final checkpoint state
        final_state = await chat_graph.aget_state(config)
        retrieved_sources = []
        if final_state and final_state.values:
            retrieved_sources = final_state.values.get(
                "retrieved_sources", []
            )

        # Send sources
        yield ServerSentEvent(
            data=retrieved_sources,
            event="sources",
        )

        # Send done signal with the complete text
        yield ServerSentEvent(
            data={"text": full_text},
            event="done",
        )

    except Exception as exc:
        logger.error(
            "Chat error for user %s: %s", user_id, exc, exc_info=True
        )
        yield ServerSentEvent(
            data={
                "error": "An error occurred while processing your message. Please try again."
            },
            event="error",
        )


@router.post("/reindex")
async def reindex(user_id: CurrentUserId) -> ReindexResponse:
    """Rebuild the vector store for the authenticated user."""
    logger.info("Reindex request from user %s", user_id)

    try:
        count = await asyncio.to_thread(reindex_user, user_id)
        return ReindexResponse(success=True, documents_indexed=count)
    except Exception as exc:
        logger.error("Reindex failed for user %s: %s", user_id, exc)
        return ReindexResponse(success=False, documents_indexed=0)


@router.get("/history/{session_id}")
async def get_chat_history(
    session_id: str,
    user_id: CurrentUserId,
) -> ChatHistoryResponse:
    """
    Retrieve conversation history for a given session.
    Uses the LangGraph checkpointer to read stored state.
    """
    config = {"configurable": {"thread_id": f"{user_id}_{session_id}"}}

    try:
        state = chat_graph.get_state(config)
        messages = []

        if state and state.values:
            for msg in state.values.get("messages", []):
                if isinstance(msg, HumanMessage):
                    messages.append(
                        ChatHistoryMessage(
                            role="user", content=msg.content
                        )
                    )
                elif isinstance(msg, AIMessage):
                    messages.append(
                        ChatHistoryMessage(
                            role="assistant", content=msg.content
                        )
                    )

    except Exception as exc:
        logger.warning(
            "Failed to get chat history for session %s: %s",
            session_id,
            exc,
        )
        messages = []

    return ChatHistoryResponse(session_id=session_id, messages=messages)
