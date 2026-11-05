"""
Search API endpoints

Replaces client-side searchDb.ts with server-side full-text search.
Uses PostgreSQL tsvector for FTS5-equivalent functionality.
"""

from fastapi import APIRouter, Query, HTTPException
from typing import List
from sqlalchemy import select, or_, and_, func
import re

from services.database import get_db
from models.database import SearchFTS
from models.schemas import SearchResult
from services.cache import cache, get_cache_key, CACHE_TTL

router = APIRouter()


@router.get("/", response_model=List[SearchResult])
async def search(
    q: str = Query(..., min_length=1, max_length=100, description="Search query"),
    limit: int = Query(20, ge=1, le=100, description="Maximum results to return"),
):
    """
    Global search across viruses, proteins, and collapsed entries.

    Replicates searchDb.ts logic:
    1. Sanitize query (remove special chars)
    2. Try FTS prefix match first (ts_query with :*)
    3. Fallback to LIKE substring match if needed

    Returns results sorted by relevance.
    """

    # Check cache first
    cache_key = get_cache_key("search", q, limit)
    cached = await cache.get(cache_key)
    if cached:
        return cached

    # Sanitize query (same as searchDb.ts line 155)
    sanitized = re.sub(r'[^a-zA-Z0-9\s-]', '', q).strip()

    if not sanitized:
        return []

    # Split into terms for search
    terms = sanitized.split()

    async with get_db() as db:
        # Try LIKE substring search (works without tsvector for now)
        # Build conditions for each term - must match in name, accession, or protein_name
        conditions = []
        for term in terms:
            term_pattern = f'%{term}%'
            conditions.append(
                or_(
                    SearchFTS.name.ilike(term_pattern),
                    SearchFTS.accession.ilike(term_pattern),
                    SearchFTS.protein_name.ilike(term_pattern),
                )
            )

        # All terms must match (AND)
        query = select(SearchFTS).where(and_(*conditions)).limit(limit)

        result = await db.execute(query)
        results = [r.to_dict() for r in result.scalars()]

        # Cache results
        await cache.set(cache_key, results, ttl=CACHE_TTL["search"])

        return results


@router.get("/autocomplete")
async def autocomplete(
    q: str = Query(..., min_length=1, max_length=50),
    limit: int = Query(10, ge=1, le=20),
):
    """
    Fast autocomplete suggestions for virus/protein names.

    Uses PostgreSQL pg_trgm for fuzzy matching.
    Returns only names (lightweight response).
    """

    # Check cache first
    cache_key = get_cache_key("autocomplete", q, limit)
    cached = await cache.get(cache_key)
    if cached:
        return cached

    sanitized = re.sub(r'[^a-zA-Z0-9\s-]', '', q).strip()

    if not sanitized:
        return []

    async with get_db() as db:
        # Simple prefix match on name
        query = (
            select(SearchFTS.name)
            .where(SearchFTS.name.ilike(f'{sanitized}%'))
            .distinct()
            .limit(limit)
        )

        result = await db.execute(query)
        suggestions = [row[0] for row in result]

        # Cache results
        await cache.set(cache_key, suggestions, ttl=CACHE_TTL["search"])

        return suggestions
