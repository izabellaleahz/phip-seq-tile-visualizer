export interface Virus {
  id: string;
  name: string;
  proteinCount: number;
  tileCount: number;
  uniqueTiles?: number;
  taxonIds: string[];
}

export interface TilePosition {
  id: string;
  start: number;
  end: number;
  isShared: boolean;
  seq: string;
}

export interface Protein {
  id: string;
  virusId: string;
  virusName: string;
  name: string;
  nameClean: string;
  tileCount: number;
  sharedTiles: number;
  length: number;
  coveragePct: number;
  coverageStart: number;
  coverageEnd: number;
  tiles: TilePosition[];
}

export interface ProteinIndex {
  id: string;
  name: string;
  virusId: string;
  virusName: string;
  length: number;
}

export interface VirusSharingSummary {
  count: number;
  virusName: string;
}

export interface SharedTile {
  id: string;
  proteins: string[];
  virusesSummary: Record<string, VirusSharingSummary>;
  numViruses: number;
  isCrossVirus: boolean;
}

export interface SharedTilesIndex {
  [sequence: string]: SharedTile;
}

export interface SearchIndex {
  viruses: { id: string; name: string; abbrev: string }[];
  proteins: { id: string; name: string; virusId: string; virusName: string }[];
}

export interface LibraryStatistics {
  library_summary: {
    total_unique_tiles: number;
    total_proteins_covered: number;
    total_tile_protein_mappings: number;
    unique_viruses: number;
  };
  tile_statistics: {
    shared_tiles: number;
    single_protein_tiles: number;
    mean_proteins_per_shared_tile: number;
  };
  sharing_details: {
    cross_virus_tiles: number;
    same_virus_tiles: number;
    total_shared_tiles: number;
  };
  coverage: {
    proteins_with_100_pct: number;
    proteins_with_gaps: number;
    mean_coverage_depth: number;
  };
  protein_statistics: {
    mean_length: number;
    median_length: number;
    min_length: number;
    max_length: number;
  };
}
