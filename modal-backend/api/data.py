"""
Data API endpoints

Replaces static JSON file fetching with database queries.
Provides viruses, proteins, and tiles data.
"""

from fastapi import APIRouter, Query, HTTPException, Path
from typing import List, Optional
from sqlalchemy import select

from services.database import get_db
from models import database as db_models
from models.schemas import Virus, Protein, TilePosition
from services.cache import cache, get_cache_key, CACHE_TTL

router = APIRouter()


@router.get("/viruses", response_model=List[Virus])
async def get_viruses(
    host_species: Optional[List[str]] = Query(None, description="Filter by host species"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(1000, ge=1, le=10000, description="Maximum results"),
):
    """
    Get list of all viruses with optional filtering.

    Replaces: fetch('/data/viruses.json')
    """

    # Check cache first
    cache_key = get_cache_key("viruses", str(host_species), offset, limit)
    cached = await cache.get(cache_key)
    if cached:
        return cached

    async with get_db() as db:
        query = select(db_models.Virus)

        if host_species:
            # Filter where host_species array overlaps with requested species
            query = query.where(db_models.Virus.host_species.overlap(host_species))

        query = query.offset(offset).limit(limit).order_by(db_models.Virus.tile_count.desc())
        result = await db.execute(query)
        viruses = [v.to_dict() for v in result.scalars()]

        # Cache results
        await cache.set(cache_key, viruses, ttl=CACHE_TTL["viruses"])

        return viruses


@router.get("/viruses/{virus_id}/proteins", response_model=List[Protein])
async def get_virus_proteins(
    virus_id: str = Path(..., description="Virus ID"),
    include_tiles: bool = Query(False, description="Include tile positions"),
):
    """
    Get all proteins for a specific virus.

    Replaces: fetch(`/data/proteins/${virusId}.json`)
    """

    # Check cache first
    cache_key = get_cache_key("virus_proteins", virus_id, include_tiles)
    cached = await cache.get(cache_key)
    if cached:
        return cached

    async with get_db() as db:
        query = select(db_models.Protein).where(db_models.Protein.virus_id == virus_id)
        result = await db.execute(query)
        proteins = result.scalars().all()

        if not proteins:
            raise HTTPException(404, f"Virus {virus_id} not found")

        proteins_data = [p.to_dict(include_tiles=include_tiles) for p in proteins]

        # Cache results
        await cache.set(cache_key, proteins_data, ttl=CACHE_TTL["proteins"])

        return proteins_data


@router.get("/proteins/{protein_id}", response_model=Protein)
async def get_protein(
    protein_id: str = Path(..., description="Protein ID"),
    include_tiles: bool = Query(True, description="Include tile positions"),
):
    """
    Get a single protein by ID.

    Used for direct protein lookups and protein detail pages.
    """

    # Check cache first
    cache_key = get_cache_key("protein", protein_id, include_tiles)
    cached = await cache.get(cache_key)
    if cached:
        return cached

    async with get_db() as db:
        query = select(db_models.Protein).where(db_models.Protein.id == protein_id)
        result = await db.execute(query)
        protein = result.scalar_one_or_none()

        if not protein:
            raise HTTPException(404, f"Protein {protein_id} not found")

        protein_data = protein.to_dict(include_tiles=include_tiles)

        # Cache results
        await cache.set(cache_key, protein_data, ttl=CACHE_TTL["proteins"])

        return protein_data


@router.get("/proteins/{protein_id}/tiles", response_model=List[TilePosition])
async def get_protein_tiles(
    protein_id: str = Path(..., description="Protein ID"),
    shared_only: bool = Query(False, description="Return only shared tiles"),
    unique_only: bool = Query(False, description="Return only unique tiles"),
):
    """
    Get tiles for a protein (separate endpoint for progressive loading).

    Useful for large proteins - load metadata first, then tiles on demand.
    """

    # Check cache first
    cache_key = get_cache_key("protein_tiles", protein_id, shared_only, unique_only)
    cached = await cache.get(cache_key)
    if cached:
        return cached

    async with get_db() as db:
        query = select(db_models.TilePosition).where(db_models.TilePosition.protein_id == protein_id)

        if shared_only:
            query = query.where(db_models.TilePosition.is_shared == True)
        elif unique_only:
            query = query.where(db_models.TilePosition.is_shared == False)

        result = await db.execute(query)
        tiles = [t.to_dict() for t in result.scalars()]

        # Cache results
        await cache.set(cache_key, tiles, ttl=CACHE_TTL["tiles"])

        return tiles


@router.get("/statistics")
async def get_statistics():
    """
    Get library statistics.

    Replaces: fetch('/data/statistics.json')
    """

    # TODO: Compute from database or cache
    return {
        "totalTiles": 538798,
        "totalProteins": 74370,
        "totalViruses": 2178,
        "uniqueTiles": 538798,
    }


@router.get("/taxonomy")
async def get_taxonomy():
    """
    Get taxonomy tree data.

    Replaces: fetch('/data/taxonomy.json')
    """

    # TODO: Load from database
    return {"message": "Taxonomy data - TODO: implement"}
