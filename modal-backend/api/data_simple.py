"""
Simplified Data API endpoints

Serves data from JSON files instead of database.
"""

from fastapi import APIRouter, Query, HTTPException, Path
from typing import List, Optional

from services.json_data import get_data_service

router = APIRouter()


@router.get("/viruses")
async def get_viruses(
    host_species: Optional[List[str]] = Query(None, description="Filter by host species"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(1000, ge=1, le=10000, description="Maximum results"),
):
    """
    Get list of all viruses with optional filtering.

    Replaces: fetch('/data/viruses.json')
    """
    data_service = get_data_service()
    viruses = data_service.filter_viruses(
        host_species=host_species,
        offset=offset,
        limit=limit
    )
    return viruses


@router.get("/viruses/{virus_id}/proteins")
async def get_virus_proteins(
    virus_id: str = Path(..., description="Virus ID"),
    include_tiles: bool = Query(True, description="Include tile positions"),
):
    """
    Get all proteins for a specific virus.

    Replaces: fetch(`/data/proteins/${virusId}.json`)
    """
    data_service = get_data_service()
    proteins = data_service.get_virus_proteins(virus_id)

    if not proteins:
        raise HTTPException(404, f"Virus {virus_id} not found or has no proteins")

    # If include_tiles is False, strip tiles from response
    if not include_tiles:
        proteins = [
            {k: v for k, v in p.items() if k != "tiles"}
            for p in proteins
        ]

    return proteins


@router.get("/proteins/{protein_id}")
async def get_protein(
    protein_id: str = Path(..., description="Protein ID"),
    include_tiles: bool = Query(True, description="Include tile positions"),
):
    """
    Get a single protein by ID.

    Used for direct protein lookups and protein detail pages.
    """
    data_service = get_data_service()
    protein = data_service.get_protein_by_id(protein_id)

    if not protein:
        raise HTTPException(404, f"Protein {protein_id} not found")

    # If include_tiles is False, strip tiles from response
    if not include_tiles:
        protein = {k: v for k, v in protein.items() if k != "tiles"}

    return protein


@router.get("/proteins/{protein_id}/tiles")
async def get_protein_tiles(
    protein_id: str = Path(..., description="Protein ID"),
    shared_only: bool = Query(False, description="Return only shared tiles"),
    unique_only: bool = Query(False, description="Return only unique tiles"),
):
    """
    Get tiles for a protein (separate endpoint for progressive loading).

    Useful for large proteins - load metadata first, then tiles on demand.
    """
    data_service = get_data_service()
    protein = data_service.get_protein_by_id(protein_id)

    if not protein:
        raise HTTPException(404, f"Protein {protein_id} not found")

    tiles = protein.get("tiles", [])

    # Apply filters
    if shared_only:
        tiles = [t for t in tiles if t.get("isShared", False)]
    elif unique_only:
        tiles = [t for t in tiles if not t.get("isShared", False)]

    return tiles


@router.get("/statistics")
async def get_statistics():
    """
    Get library statistics.

    Computes from viruses data.
    """
    data_service = get_data_service()
    viruses = data_service.viruses

    total_viruses = len(viruses)
    total_proteins = sum(v.get("proteinCount", 0) for v in viruses)
    total_tiles = sum(v.get("tileCount", 0) for v in viruses)
    unique_tiles = sum(v.get("uniqueTiles", 0) for v in viruses)

    return {
        "totalViruses": total_viruses,
        "totalProteins": total_proteins,
        "totalTiles": total_tiles,
        "uniqueTiles": unique_tiles,
    }


@router.get("/taxonomy")
async def get_taxonomy():
    """
    Get taxonomy tree data.

    Replaces: fetch('/data/taxonomy.json')
    """
    data_service = get_data_service()

    # Try to load taxonomy.json
    import json
    taxonomy_file = data_service.data_dir / "taxonomy.json"

    if taxonomy_file.exists():
        with open(taxonomy_file) as f:
            return json.load(f)

    return {"message": "Taxonomy data not available"}
