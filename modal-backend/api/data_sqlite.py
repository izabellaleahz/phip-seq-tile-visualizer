"""
Data API endpoints using SQLite for fast queries
"""

from fastapi import APIRouter, Query, HTTPException, Path
from typing import List, Optional

from services.sqlite_data import get_data_service

router = APIRouter()


@router.get("/viruses")
async def get_viruses(
    host_species: Optional[List[str]] = Query(None, description="Filter by host species"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(1000, ge=1, le=10000, description="Maximum results"),
):
    """
    Get list of all viruses with optional filtering.
    Uses indexed SQLite query for fast results.
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
    Fast indexed lookup.
    """
    data_service = get_data_service()
    proteins = data_service.get_virus_proteins(virus_id, include_tiles=include_tiles)

    if not proteins:
        raise HTTPException(404, f"Virus {virus_id} not found or has no proteins")

    return proteins


@router.get("/proteins/{protein_id}")
async def get_protein(
    protein_id: str = Path(..., description="Protein ID"),
    include_tiles: bool = Query(True, description="Include tile positions"),
):
    """
    Get a single protein by ID.
    O(1) lookup with index - super fast!
    """
    data_service = get_data_service()
    protein = data_service.get_protein_by_id(protein_id, include_tiles=include_tiles)

    if not protein:
        raise HTTPException(404, f"Protein {protein_id} not found")

    return protein


@router.get("/proteins/{protein_id}/tiles")
async def get_protein_tiles(
    protein_id: str = Path(..., description="Protein ID"),
    shared_only: bool = Query(False, description="Return only shared tiles"),
    unique_only: bool = Query(False, description="Return only unique tiles"),
):
    """
    Get tiles for a protein (separate endpoint for progressive loading).
    """
    data_service = get_data_service()
    protein = data_service.get_protein_by_id(protein_id, include_tiles=True)

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
    Fast aggregation from SQLite.
    """
    data_service = get_data_service()
    return data_service.get_statistics()


@router.get("/taxonomy")
async def get_taxonomy():
    """
    Get taxonomy tree data with family statistics.
    Returns taxonomy mappings and computed family stats.
    """
    import json
    from pathlib import Path
    import os

    # Load taxonomy.json - check Modal container path first, then local
    if os.path.exists("/taxonomy.json"):
        taxonomy_file = Path("/taxonomy.json")
    else:
        taxonomy_file = Path(__file__).parent.parent.parent / "public" / "data" / "taxonomy.json"

    if not taxonomy_file.exists():
        raise HTTPException(404, "Taxonomy data file not found")

    with open(taxonomy_file) as f:
        taxonomy_data = json.load(f)

    # Compute family_stats from taxonomy data
    data_service = get_data_service()

    # Get all viruses to compute stats
    all_viruses = data_service.filter_viruses(limit=10000)

    # Build family stats
    family_stats = {}
    for virus in all_viruses:
        # Get taxon IDs for this virus
        taxon_ids = virus.get('taxonIds', [])

        # Find families from taxonomy
        families = set()
        for taxon_id in taxon_ids:
            taxon_str = str(taxon_id)
            if taxon_str in taxonomy_data:
                family = taxonomy_data[taxon_str].get('family', 'Unknown')
                families.add(family)

        # Update stats for each family
        for family in families:
            if family not in family_stats:
                family_stats[family] = {
                    'count': 0,
                    'proteins': 0,
                    'tiles': 0,
                    'unique_tiles': 0
                }
            family_stats[family]['count'] += 1
            family_stats[family]['proteins'] += virus.get('proteinCount', 0)
            family_stats[family]['tiles'] += virus.get('tileCount', 0)
            family_stats[family]['unique_tiles'] += virus.get('uniqueTiles', 0)

    # Return both taxonomy data and computed family stats
    return {
        'taxonomy_data': taxonomy_data,
        'family_stats': family_stats
    }
