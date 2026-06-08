"""
MongoDB read-only client for fetching interview and report data.
Connects directly to the same database as the Node.js backend.
"""

import logging
from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import MongoClient

from app.config import get_settings

logger = logging.getLogger(__name__)

# Module-level client — lazy-initialised on first call
_client: MongoClient | None = None


def _get_db():
    """Return the MongoDB database handle, creating the client if needed."""
    global _client
    if _client is None:
        settings = get_settings()
        _client = MongoClient(settings.mongodb_uri)
    return _client.get_default_database()


def _safe_object_id(user_id: str) -> ObjectId:
    """Convert a string to an ObjectId, raising ValueError on bad input."""
    try:
        return ObjectId(user_id)
    except (InvalidId, TypeError) as exc:
        raise ValueError(
            f"Invalid user ID format: '{user_id}'. "
            "Expected a 24-character hex string."
        ) from exc


def count_user_interviews(user_id: str) -> int:
    """
    Return the number of completed/evaluated interviews for a user.
    Lightweight query used for staleness detection — avoids fetching full docs.
    """
    db = _get_db()
    oid = _safe_object_id(user_id)
    return db.interviews.count_documents(
        {
            "userId": oid,
            "status": {"$in": ["completed", "evaluated"]},
        }
    )


def get_user_interviews(user_id: str) -> list[dict[str, Any]]:
    """
    Fetch all evaluated interviews for a user, joined with their reports.

    Returns a list of dicts, each containing the full interview data
    merged with its corresponding report data.
    """
    db = _get_db()
    oid = _safe_object_id(user_id)

    # Fetch completed/evaluated interviews
    interviews = list(
        db.interviews.find(
            {
                "userId": oid,
                "status": {"$in": ["completed", "evaluated"]},
            }
        ).sort("createdAt", -1)
    )

    if not interviews:
        return []

    # Fetch reports for these interviews
    interview_ids = [i["_id"] for i in interviews]
    reports = list(
        db.reports.find({"interviewId": {"$in": interview_ids}})
    )
    report_map = {str(r["interviewId"]): r for r in reports}

    # Merge interview + report data
    results: list[dict[str, Any]] = []
    for interview in interviews:
        interview_id = str(interview["_id"])
        report = report_map.get(interview_id, {})

        results.append(
            {
                "interview_id": interview_id,
                "user_id": user_id,
                "role": interview.get("role", "Unknown"),
                "status": interview.get("status", ""),
                "score": interview.get("score", 0),
                "duration": interview.get("duration", 0),
                "created_at": interview.get("createdAt"),
                # Questions and answers
                "questions": interview.get("questions", []),
                "answers": interview.get("answers", []),
                # Question generation state (for phase info)
                "question_state": interview.get("questionState", {}),
                # Resume analysis
                "resume_analysis": interview.get("resumeAnalysis"),
                # Report data
                "overall_score": report.get("overallScore", 0),
                "grade": report.get("grade", ""),
                "section_scores": report.get("sectionScores", {}),
                "strengths": report.get("strengths", []),
                "weaknesses": report.get("weaknesses", []),
                "recommendations": report.get("recommendations", []),
                "learning_resources": report.get("learningResources", []),
                "hiring_recommendation": report.get(
                    "hiringRecommendation", ""
                ),
                "feedback": report.get("feedback", ""),
            }
        )

    logger.info(
        "Fetched %d evaluated interviews for user %s",
        len(results),
        user_id,
    )
    return results
