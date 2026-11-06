"""
Search API endpoints using SQLite FTS5 for fast full-text search
"""

from fastapi import APIRouter, Query
import re

from services.sqlite_data import get_data_service

router = APIRouter()


@router.get("/")
async def search(
    q: str = Query(..., min_length=1, max_length=100, description="Search query"),
    limit: int = Query(20, ge=1, le=100, description="Maximum results to return"),
):
    """
    Global search across viruses and proteins using FTS5.
    Super fast full-text search with ranking.
    """
    # Sanitize query
    sanitized = re.sub(r'[^a-zA-Z0-9\s-]', '', q).strip()
    if not sanitized:
        return []

    data_service = get_data_service()
    results = data_service.search(sanitized, limit=limit)
    return results
