"""
Build SQLite database from JSON files for fast queries.

This script reads the JSON data files and creates a SQLite database
with proper indexes for fast lookups.
"""

import json
import sqlite3
from pathlib import Path
import sys

# Paths
DATA_DIR = Path(__file__).parent.parent / "public" / "data"
DB_PATH = Path(__file__).parent / "phipseq.db"

def create_schema(conn: sqlite3.Connection):
    """Create database schema with indexes"""
    cursor = conn.cursor()

    # Viruses table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS viruses (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            protein_count INTEGER,
            tile_count INTEGER,
            taxon_ids TEXT,
            host_species TEXT,
            unique_tiles INTEGER
        )
    """)

    # Proteins table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS proteins (
            id TEXT PRIMARY KEY,
            virus_id TEXT NOT NULL,
            virus_name TEXT,
            name TEXT,
            name_clean TEXT,
            tile_count INTEGER,
            shared_tiles INTEGER,
            length INTEGER,
            coverage_pct REAL,
            coverage_start INTEGER,
            coverage_end INTEGER,
            FOREIGN KEY (virus_id) REFERENCES viruses(id)
        )
    """)

    # Tiles table (for fast tile lookups)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tiles (
            id TEXT PRIMARY KEY,
            protein_id TEXT NOT NULL,
            start INTEGER,
            end INTEGER,
            is_shared BOOLEAN,
            seq TEXT,
            FOREIGN KEY (protein_id) REFERENCES proteins(id)
        )
    """)

    # Full-text search table for viruses and proteins
    cursor.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
            entity_type,
            entity_id,
            name,
            virus_name,
            virus_id,
            tokenize='porter unicode61'
        )
    """)

    # Create indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_proteins_virus_id ON proteins(virus_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_proteins_name ON proteins(name)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tiles_protein_id ON tiles(protein_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tiles_shared ON tiles(is_shared)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_viruses_name ON viruses(name)")

    conn.commit()
    print("✓ Created schema and indexes")

def import_viruses(conn: sqlite3.Connection):
    """Import viruses from viruses.json"""
    viruses_file = DATA_DIR / "viruses.json"

    if not viruses_file.exists():
        print(f"Error: {viruses_file} not found")
        return

    with open(viruses_file) as f:
        viruses = json.load(f)

    cursor = conn.cursor()

    for virus in viruses:
        cursor.execute("""
            INSERT OR REPLACE INTO viruses
            (id, name, protein_count, tile_count, taxon_ids, host_species, unique_tiles)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            virus.get('id'),
            virus.get('name'),
            virus.get('proteinCount'),
            virus.get('tileCount'),
            json.dumps(virus.get('taxonIds', [])),
            json.dumps(virus.get('hostSpecies', [])),
            virus.get('uniqueTiles'),
        ))

        # Add to FTS
        cursor.execute("""
            INSERT INTO search_fts (entity_type, entity_id, name, virus_name, virus_id)
            VALUES (?, ?, ?, ?, ?)
        """, ('virus', virus.get('id'), virus.get('name'), None, virus.get('id')))

    conn.commit()
    print(f"✓ Imported {len(viruses)} viruses")

def import_proteins(conn: sqlite3.Connection):
    """Import proteins from protein JSON files"""
    proteins_dir = DATA_DIR / "proteins"

    if not proteins_dir.exists():
        print(f"Error: {proteins_dir} not found")
        return

    cursor = conn.cursor()
    protein_files = list(proteins_dir.glob("*.json"))

    total_proteins = 0
    total_tiles = 0

    for i, protein_file in enumerate(protein_files, 1):
        virus_id = protein_file.stem

        try:
            with open(protein_file) as f:
                proteins = json.load(f)

            # Skip if not a list
            if not isinstance(proteins, list):
                print(f"  Warning: Skipping {protein_file.name} - not a list")
                continue

        except Exception as e:
            print(f"  Warning: Error reading {protein_file.name}: {e}")
            continue

        for protein in proteins:
            # Skip if not a dict
            if not isinstance(protein, dict):
                continue
            # Insert protein
            cursor.execute("""
                INSERT OR REPLACE INTO proteins
                (id, virus_id, virus_name, name, name_clean, tile_count, shared_tiles,
                 length, coverage_pct, coverage_start, coverage_end)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                protein.get('id'),
                virus_id,
                protein.get('virusName'),
                protein.get('name'),
                protein.get('nameClean'),
                protein.get('tileCount'),
                protein.get('sharedTiles'),
                protein.get('length'),
                protein.get('coveragePct'),
                protein.get('coverageStart'),
                protein.get('coverageEnd'),
            ))

            # Add to FTS
            cursor.execute("""
                INSERT INTO search_fts (entity_type, entity_id, name, virus_name, virus_id)
                VALUES (?, ?, ?, ?, ?)
            """, ('protein', protein.get('id'), protein.get('name'), protein.get('virusName'), virus_id))

            # Insert tiles
            # NOTE: For shared tiles, we create a composite ID (protein_id + original_tile_id)
            # This allows the same tile to appear in multiple proteins
            tiles = protein.get('tiles', [])
            for tile in tiles:
                # Create unique tile ID per protein
                composite_tile_id = f"{protein.get('id')}_{tile.get('id')}"

                cursor.execute("""
                    INSERT OR REPLACE INTO tiles
                    (id, protein_id, start, end, is_shared, seq)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    composite_tile_id,
                    protein.get('id'),
                    tile.get('start'),
                    tile.get('end'),
                    tile.get('isShared', False),
                    tile.get('seq'),
                ))
                total_tiles += 1

            total_proteins += 1

        if i % 100 == 0:
            conn.commit()
            print(f"  Progress: {i}/{len(protein_files)} files, {total_proteins} proteins, {total_tiles} tiles")

    conn.commit()
    print(f"✓ Imported {total_proteins} proteins with {total_tiles} tiles from {len(protein_files)} viruses")

def main():
    """Build the SQLite database"""
    print(f"Building SQLite database at: {DB_PATH}")
    print(f"Reading data from: {DATA_DIR}")

    # Remove existing database
    if DB_PATH.exists():
        print("Removing existing database...")
        DB_PATH.unlink()

    # Create new database
    conn = sqlite3.connect(str(DB_PATH))

    try:
        create_schema(conn)
        import_viruses(conn)
        import_proteins(conn)

        # Optimize database
        print("Optimizing database...")
        conn.execute("VACUUM")
        conn.execute("ANALYZE")

        # Print statistics
        cursor = conn.cursor()
        virus_count = cursor.execute("SELECT COUNT(*) FROM viruses").fetchone()[0]
        protein_count = cursor.execute("SELECT COUNT(*) FROM proteins").fetchone()[0]
        tile_count = cursor.execute("SELECT COUNT(*) FROM tiles").fetchone()[0]

        db_size_mb = DB_PATH.stat().st_size / (1024 * 1024)

        print("\n" + "="*60)
        print("Database built successfully!")
        print("="*60)
        print(f"Viruses:  {virus_count:,}")
        print(f"Proteins: {protein_count:,}")
        print(f"Tiles:    {tile_count:,}")
        print(f"DB Size:  {db_size_mb:.1f} MB")
        print(f"Location: {DB_PATH}")
        print("="*60)

    finally:
        conn.close()

if __name__ == "__main__":
    main()
