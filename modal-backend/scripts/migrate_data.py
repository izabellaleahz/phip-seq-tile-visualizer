"""
Data migration script: JSON → PostgreSQL

This script migrates all PhIP-seq data from static JSON files
to PostgreSQL database on Supabase.

Usage:
    python migrate_data.py --data-dir ../public/data --db-url "postgresql+asyncpg://..."
"""

import json
import sqlite3
from pathlib import Path
import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text


class DataMigrator:
    """Migrates PhIP-seq data from JSON to PostgreSQL"""

    def __init__(self, data_dir: str, db_url: str):
        self.data_dir = Path(data_dir)
        self.db_url = db_url

        # Ensure asyncpg driver
        if self.db_url.startswith("postgresql://"):
            self.db_url = self.db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

        # Create async engine
        self.engine = create_async_engine(
            self.db_url,
            echo=False,
            pool_size=20,
            max_overflow=10,
        )

        # Create session factory
        self.SessionLocal = sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )

    async def migrate_all(self):
        """Run full migration"""
        print("🚀 Starting PhIP-seq data migration to Supabase...")
        print(f"📂 Data directory: {self.data_dir}")

        try:
            print("\n1️⃣  Migrating viruses...")
            await self.migrate_viruses()

            print("\n2️⃣  Migrating proteins and tiles...")
            await self.migrate_proteins()

            print("\n3️⃣  Migrating search index...")
            await self.migrate_search_index()

            print("\n✅ Migration complete!")

        except Exception as e:
            print(f"\n❌ Migration failed: {e}")
            raise
        finally:
            await self.engine.dispose()

    async def migrate_viruses(self):
        """Migrate viruses.json to viruses table"""
        viruses_file = self.data_dir / "viruses.json"

        if not viruses_file.exists():
            print(f"  ⚠️  File not found: {viruses_file}")
            return

        with open(viruses_file) as f:
            viruses = json.load(f)

        print(f"  📊 Found {len(viruses)} viruses")

        async with self.SessionLocal() as session:
            for i, virus in enumerate(viruses):
                # Insert virus using raw SQL to avoid ORM overhead
                await session.execute(
                    text("""
                        INSERT INTO viruses (
                            id, name, protein_count, tile_count,
                            taxon_ids, host_species, baltimore_group,
                            genome_composition, representative_protein_id, collapsed
                        ) VALUES (
                            :id, :name, :protein_count, :tile_count,
                            :taxon_ids, :host_species, :baltimore_group,
                            :genome_composition, :representative_protein_id, :collapsed
                        )
                        ON CONFLICT (id) DO UPDATE SET
                            name = EXCLUDED.name,
                            protein_count = EXCLUDED.protein_count,
                            tile_count = EXCLUDED.tile_count
                    """),
                    {
                        "id": virus["id"],
                        "name": virus["name"],
                        "protein_count": virus.get("proteinCount", 0),
                        "tile_count": virus.get("tileCount", 0),
                        "taxon_ids": virus.get("taxonIds", []),
                        "host_species": virus.get("hostSpecies", []),
                        "baltimore_group": virus.get("baltimoreGroup"),
                        "genome_composition": virus.get("genomeComposition"),
                        "representative_protein_id": virus.get("representativeProteinId"),
                        "collapsed": virus.get("collapsed", False),
                    }
                )

                if (i + 1) % 100 == 0:
                    await session.commit()
                    print(f"  ✓ Processed {i + 1}/{len(viruses)} viruses")

            await session.commit()

        print(f"  ✅ Migrated {len(viruses)} viruses")

    async def migrate_proteins(self):
        """Migrate all protein JSON files to proteins and tile_positions tables"""
        proteins_dir = self.data_dir / "proteins"

        if not proteins_dir.exists():
            print(f"  ⚠️  Directory not found: {proteins_dir}")
            return

        protein_files = sorted(proteins_dir.glob("*.json"))
        print(f"  📊 Found {len(protein_files)} protein files")

        count_proteins = 0
        count_tiles = 0
        batch_size = 10  # Process 10 files at a time

        async with self.SessionLocal() as session:
            for file_idx, pfile in enumerate(protein_files):
                with open(pfile) as f:
                    proteins_list = json.load(f)

                for protein in proteins_list:
                    count_proteins += 1

                    # Insert protein
                    await session.execute(
                        text("""
                            INSERT INTO proteins (
                                id, virus_id, virus_name, name, accession,
                                length, tile_count, shared_tile_count,
                                unique_tile_count, coverage_percent, is_representative
                            ) VALUES (
                                :id, :virus_id, :virus_name, :name, :accession,
                                :length, :tile_count, :shared_tile_count,
                                :unique_tile_count, :coverage_percent, :is_representative
                            )
                            ON CONFLICT (id) DO UPDATE SET
                                tile_count = EXCLUDED.tile_count,
                                coverage_percent = EXCLUDED.coverage_percent
                        """),
                        {
                            "id": protein["id"],
                            "virus_id": protein["virusId"],
                            "virus_name": protein["virusName"],
                            "name": protein["name"],
                            "accession": protein.get("accession"),
                            "length": protein["length"],
                            "tile_count": protein.get("tileCount", 0),
                            "shared_tile_count": protein.get("sharedTileCount", 0),
                            "unique_tile_count": protein.get("uniqueTileCount", 0),
                            "coverage_percent": protein.get("coveragePercent", 0.0),
                            "is_representative": protein.get("isRepresentative", False),
                        }
                    )

                    # Insert tiles
                    for tile in protein.get("tiles", []):
                        count_tiles += 1

                        await session.execute(
                            text("""
                                INSERT INTO tile_positions (
                                    tile_id, protein_id, virus_id,
                                    start_pos, end_pos, sequence,
                                    is_shared, shared_count
                                ) VALUES (
                                    :tile_id, :protein_id, :virus_id,
                                    :start_pos, :end_pos, :sequence,
                                    :is_shared, :shared_count
                                )
                            """),
                            {
                                "tile_id": tile["id"],
                                "protein_id": protein["id"],
                                "virus_id": protein["virusId"],
                                "start_pos": tile["start"],
                                "end_pos": tile["end"],
                                "sequence": tile.get("seq", ""),
                                "is_shared": tile.get("isShared", False),
                                "shared_count": tile.get("sharedCount", 0),
                            }
                        )

                # Commit every batch_size files
                if (file_idx + 1) % batch_size == 0:
                    await session.commit()
                    print(f"  ✓ Progress: {file_idx + 1}/{len(protein_files)} files | {count_proteins} proteins | {count_tiles} tiles")

            # Final commit
            await session.commit()

        print(f"  ✅ Migrated {count_proteins} proteins with {count_tiles} tiles")

    async def migrate_search_index(self):
        """Migrate search.db SQLite to search_fts table"""
        search_db = self.data_dir / "search.db"

        if not search_db.exists():
            print(f"  ⚠️  File not found: {search_db}")
            return

        # Read from SQLite
        conn = sqlite3.connect(str(search_db))
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        print(f"  📊 SQLite tables: {[t[0] for t in tables]}")

        # Find the search table (might be named differently)
        cursor = conn.execute("SELECT * FROM search_fts LIMIT 1")
        columns = [desc[0] for desc in cursor.description]
        print(f"  📊 Columns: {columns}")

        # Get all rows
        cursor = conn.execute("SELECT * FROM search_fts")
        rows = cursor.fetchall()
        print(f"  📊 Found {len(rows)} search entries")

        async with self.SessionLocal() as session:
            for i, row in enumerate(rows):
                # Assuming columns: entry_type, name, accession, virus_name, ...
                # Adjust based on actual SQLite schema
                entry_data = dict(zip(columns, row))

                search_text = " ".join([
                    str(entry_data.get("name", "")),
                    str(entry_data.get("accession", "")),
                    str(entry_data.get("virus_name", "")),
                ])

                await session.execute(
                    text("""
                        INSERT INTO search_fts (
                            entry_id, entry_type, name, accession, virus_name, search_text
                        ) VALUES (
                            :entry_id, :entry_type, :name, :accession, :virus_name, :search_text
                        )
                    """),
                    {
                        "entry_id": entry_data.get("id", f"search_{i}"),
                        "entry_type": entry_data.get("type", "unknown"),
                        "name": entry_data.get("name", ""),
                        "accession": entry_data.get("accession"),
                        "virus_name": entry_data.get("virus_name"),
                        "search_text": search_text,
                    }
                )

                if (i + 1) % 1000 == 0:
                    await session.commit()
                    print(f"  ✓ Processed {i + 1}/{len(rows)} search entries")

            await session.commit()

        conn.close()
        print(f"  ✅ Migrated {len(rows)} search entries")


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Migrate PhIP-seq data to PostgreSQL")
    parser.add_argument(
        "--data-dir",
        default="../public/data",
        help="Path to data directory with JSON files",
    )
    parser.add_argument(
        "--db-url",
        required=True,
        help="PostgreSQL database URL (postgresql+asyncpg://...)",
    )

    args = parser.parse_args()

    # Validate data directory
    data_path = Path(args.data_dir)
    if not data_path.exists():
        print(f"❌ Data directory not found: {data_path}")
        sys.exit(1)

    migrator = DataMigrator(args.data_dir, args.db_url)
    asyncio.run(migrator.migrate_all())


if __name__ == "__main__":
    main()
