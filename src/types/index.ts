export interface Virus {
  id: string;
  name: string;
  proteinCount: number;
  tileCount: number;
  /** Peptide sequences found only on this virus (not shared with other viruses). */
  uniqueTiles?: number;
  /** Distinct peptide sequences on this virus (includes cross-virus shared). */
  distinctSequences?: number;
  taxonIds: string[];
  hostSpecies: string[];
}

export interface TilePosition {
  id: string;
  start: number;
  end: number;
  isShared: boolean;
  seq: string;
  dna?: string;
}

export interface XRegion {
  start: number;
  end: number;
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
  database?: string;
  xRegions?: XRegion[];
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
  viruses: { id: string; name: string; abbrev: string; hostSpecies?: string[] }[];
  proteins: { id: string; name: string; virusId: string; virusName: string }[];
}

export interface TaxonomyEntry {
  name: string;
  lineage: string;
  rank: string;
}

export interface FamilyStats {
  count: number;
  proteins: number;
  tiles: number;
  unique_tiles: number;
}

export interface TaxonomyData {
  taxid_to_family: Record<string, string>;
  taxonomy_data: Record<string, TaxonomyEntry>;
  family_stats: Record<string, FamilyStats>;
}

export interface LibraryStatistics {
  library_summary: {
    /** Canonical oligo count in the synthesis library (distinct peptide sequences). */
    library_oligo_count?: number;
    total_tiles?: number;
    total_unique_tiles: number;
    total_virus_exclusive_tiles?: number;
    cross_virus_shared_sequences?: number;
    total_proteins_covered: number;
    total_tile_protein_mappings: number;
    unique_viruses: number;
  };
  tile_statistics: {
    library_oligo_count?: number;
    multi_protein_sequences?: number;
    single_protein_sequences?: number;
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
  host_species_breakdown?: Record<string, {
    viruses: number;
    proteins: number;
    tile_mappings: number;
    tiles?: number;
    virus_exclusive_sequences?: number;
    library_sequences?: number;
  }>;
  generation_info?: {
    pipeline: string;
    tile_length: number;
    tile_overlap: number;
    similarity_threshold: number;
    max_cluster_size: number;
    no_gaps_mode: boolean;
    source_database: string;
    host_filter: string;
    min_protein_length: number;
    clustering: string;
    notes?: string;
  };
}
