"""
Simplified Search API endpoints

Uses JSON search index instead of PostgreSQL FTS.
"""

from fastapi import APIRouter, Query
from typing import List
import re

from services.json_data import get_data_service

router = APIRouter()


@router.get("/")
async def search(
    q: str = Query(..., min_length=1, max_length=100, description="Search query"),
    limit: int = Query(20, ge=1, le=100, description="Maximum results to return"),
):
    """
    Global search across viruses, proteins, and collapsed entries.

    Replicates searchDb.ts logic:
    1. Sanitize query (remove special chars)
    2. Case-insensitive substring search

    Returns results sorted by relevance.
    """
    # Sanitize query (same as searchDb.ts)
    sanitized = re.sub(r'[^a-zA-Z0-9\s-]', '', q).strip()

    if not sanitized:
        return []

    data_service = get_data_service()
    results = data_service.search(sanitized, limit=limit)

    return results


@router.get("/autocomplete")
async def autocomplete(
    q: str = Query(..., min_length=1, max_length=50),
    limit: int = Query(10, ge=1, le=20),
):
    """
    Fast autocomplete suggestions for virus/protein names.

    Returns only names (lightweight response).
    """
    sanitized = re.sub(r'[^a-zA-Z0-9\s-]', '', q).strip()

    if not sanitized:
        return []

    data_service = get_data_service()
    query_lower = sanitized.lower()

    # Get matching names from search index
    suggestions = []
    seen = set()

    for entry in data_service.search_index:
        name = entry.get("name", "")
        if name and name.lower().startswith(query_lower) and name not in seen:
            suggestions.append(name)
            seen.add(name)
            if len(suggestions) >= limit:
                break

    return suggestions
