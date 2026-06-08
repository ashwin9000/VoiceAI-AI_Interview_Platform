"""
Application settings loaded from environment variables.
Uses pydantic-settings for validation and type coercion.
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """RAG service configuration — reads from .env file."""

    # Gemini
    gemini_api_key: str

    # MongoDB
    mongodb_uri: str = "mongodb://localhost:27017/ai-interviewer"

    # JWT (must match Node.js backend)
    jwt_secret: str

    # ChromaDB — default path is at the project root (outside rag_service/)
    # so that uvicorn --reload doesn't trigger on ChromaDB file writes.
    chroma_persist_dir: str = str(
        Path(__file__).resolve().parent.parent.parent / "chroma_data"
    )

    # External services
    node_backend_url: str = "http://localhost:5000"
    client_url: str = "http://localhost:5173"

    model_config = {
        "env_file": str(Path(__file__).resolve().parent.parent / ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton — parsed once at startup."""
    return Settings()
