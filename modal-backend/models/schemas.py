"""
Pydantic schemas for API request/response validation

These schemas match the current frontend TypeScript types exactly
to ensure API compatibility with existing React components.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class TilePosition(BaseModel):
    """Tile position within a protein"""
    id: str
    start: int
    end: int
    isShared: bool = Field(alias="is_shared")
    seq: str
    dna: Optional[str] = None

    class Config:
        populate_by_name = True


class XRegion(BaseModel):
    """Unknown residue region in protein sequence"""
    start: int
    end: int


class Protein(BaseModel):
    """Protein metadata and tiles"""
    id: str
    virusId: str = Field(alias="virus_id")
    virusName: str = Field(alias="virus_name")
    name: str
    nameClean: str = Field(alias="name_clean")
    tileCount: int = Field(alias="tile_count")
    sharedTiles: int = Field(alias="shared_tiles")
    length: int
    coveragePct: float = Field(alias="coverage_pct")
    coverageStart: int = Field(alias="coverage_start")
    coverageEnd: int = Field(alias="coverage_end")
    database: Optional[str] = None
    xRegions: Optional[List[XRegion]] = Field(None, alias="x_regions")
    tiles: List[TilePosition] = []

    class Config:
        populate_by_name = True


class Virus(BaseModel):
    """Virus metadata"""
    id: str
    name: str
    proteinCount: int = Field(alias="protein_count")
    tileCount: int = Field(alias="tile_count")
    uniqueTiles: int = Field(alias="unique_tiles")
    taxonIds: List[str] = Field(alias="taxon_ids")
    hostSpecies: List[str] = Field(alias="host_species")

    class Config:
        populate_by_name = True


class SearchResult(BaseModel):
    """Search result item"""
    type: str  # "virus", "protein", "collapsed", "virushostdb"
    id: str
    name: str
    accession: Optional[str] = None
    proteinName: Optional[str] = Field(None, alias="protein_name")
    taxonId: Optional[str] = Field(None, alias="taxon_id")
    refId: Optional[str] = Field(None, alias="ref_id")

    class Config:
        populate_by_name = True


class SharedTileInfo(BaseModel):
    """Information about a shared tile"""
    id: str
    proteins: List[str]
    virusesSummary: dict = Field(alias="viruses_summary")
    numViruses: int = Field(alias="num_viruses")
    isCrossVirus: bool = Field(alias="is_cross_virus")

    class Config:
        populate_by_name = True
