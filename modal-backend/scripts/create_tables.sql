-- PhIP-seq Visualizer Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/upbmuioaecgartxtvhcx/sql

-- Create viruses table
CREATE TABLE IF NOT EXISTS viruses (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    protein_count INTEGER NOT NULL,
    tile_count INTEGER NOT NULL,
    taxon_ids TEXT[] NOT NULL,
    host_species TEXT[] NOT NULL,
    baltimore_group VARCHAR(10),
    genome_composition VARCHAR(50),
    representative_protein_id VARCHAR(100),
    collapsed BOOLEAN DEFAULT FALSE
);

-- Create proteins table
CREATE TABLE IF NOT EXISTS proteins (
    id VARCHAR(100) PRIMARY KEY,
    virus_id VARCHAR(50) NOT NULL REFERENCES viruses(id) ON DELETE CASCADE,
    virus_name VARCHAR(500) NOT NULL,
    name VARCHAR(500) NOT NULL,
    accession VARCHAR(50),
    length INTEGER NOT NULL,
    tile_count INTEGER NOT NULL,
    shared_tile_count INTEGER DEFAULT 0,
    unique_tile_count INTEGER DEFAULT 0,
    coverage_percent FLOAT NOT NULL,
    is_representative BOOLEAN DEFAULT FALSE
);

-- Create tile_positions table
CREATE TABLE IF NOT EXISTS tile_positions (
    id SERIAL PRIMARY KEY,
    tile_id VARCHAR(50) NOT NULL,
    protein_id VARCHAR(100) NOT NULL REFERENCES proteins(id) ON DELETE CASCADE,
    virus_id VARCHAR(50) NOT NULL REFERENCES viruses(id) ON DELETE CASCADE,
    start_pos INTEGER NOT NULL,
    end_pos INTEGER NOT NULL,
    sequence TEXT NOT NULL,
    is_shared BOOLEAN DEFAULT FALSE,
    shared_count INTEGER DEFAULT 0
);

-- Create search_fts table
CREATE TABLE IF NOT EXISTS search_fts (
    id SERIAL PRIMARY KEY,
    entry_id VARCHAR(100) NOT NULL,
    entry_type VARCHAR(20) NOT NULL,
    name VARCHAR(500) NOT NULL,
    accession VARCHAR(50),
    virus_name VARCHAR(500),
    search_text TEXT NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_proteins_virus_id ON proteins(virus_id);
CREATE INDEX IF NOT EXISTS idx_tile_positions_protein_id ON tile_positions(protein_id);
CREATE INDEX IF NOT EXISTS idx_tile_positions_virus_id ON tile_positions(virus_id);
CREATE INDEX IF NOT EXISTS idx_tile_positions_tile_id ON tile_positions(tile_id);
CREATE INDEX IF NOT EXISTS idx_tile_positions_is_shared ON tile_positions(is_shared);
CREATE INDEX IF NOT EXISTS idx_search_fts_entry_type ON search_fts(entry_type);
CREATE INDEX IF NOT EXISTS idx_search_fts_name ON search_fts(name);
CREATE INDEX IF NOT EXISTS idx_viruses_host_species ON viruses USING GIN(host_species);
CREATE INDEX IF NOT EXISTS idx_viruses_taxon_ids ON viruses USING GIN(taxon_ids);

-- Create full-text search index on search_fts table
CREATE INDEX IF NOT EXISTS idx_search_fts_text ON search_fts USING GIN(to_tsvector('english', search_text));

-- Success message
SELECT 'Database tables created successfully!' AS status;
