"""
FastAPI application entry point for the Interview History RAG Service.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.router import router as chat_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-8s │ %(name)s │ %(message)s",
    datefmt="%H:%M:%S",
)

# Build app
app = FastAPI(
    title="Interview History RAG Service",
    description="AI-powered chatbot for analysing past interview performance",
    version="0.1.0",
)

# CORS — allow both the Node.js backend and the client dev server
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.node_backend_url,
        settings.client_url,
        "http://localhost:5173",
        "http://localhost:5000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount chat router
app.include_router(chat_router)


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "rag-service"}
