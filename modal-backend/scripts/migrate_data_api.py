"""
Data migration script using Supabase REST API

This script migrates PhIP-seq data from JSON files to Supabase
using the REST API instead of direct PostgreSQL connections.

Usage:
    python migrate_data_api.py --data-dir ../public/data --project-id upbmuioaecgartxtvhcx --api-key your-service-role-key
"""

import json
import sqlite3
from pathlib import Path
import sys
import requests
from typing import List, Dict
import time


class SupabaseMigrator:
    """Migrates data to Supabase using REST API"""

    def __init__(self, data_dir: str, project_id: str, api_key: str):
        self.data_dir = Path(data_dir)
        self.project_id = project_id
        self.base_url = f"https://{project_id}.supabase.co/rest/v1"
        self.headers = {
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }

    def insert_batch(self, table: str, data: List[Dict], batch_size: int = 100):
        """Insert data in batches via REST API"""
        total = len(data)

        for i in range(0, total, batch_size):
            batch = data[i:i + batch_size]

            response = requests.post(
                f"{self.base_url}/{table}",
                headers=self.headers,
                json=batch
            )

            if response.status_code not in [200, 201]:
                print(f"    ⚠️  Error inserting batch {i//batch_size + 1}: {response.text}")
                # Continue anyway

            if (i + batch_size) % 500 == 0:
                print(f"    ✓ Inserted {min(i + batch_size, total)}/{total}")
                time.sleep(0.1)  # Rate limiting

    def migrate_all(self):
        """Run full migration"""
        print("🚀 Starting PhIP-seq data migration to Supabase (via REST API)...")
        print(f"📂 Data directory: {self.data_dir}")
        print(f"🔗 Supabase project: {self.project_id}")

        try:
            print("\n1️⃣  Migrating viruses...")
            self.migrate_viruses()

            print("\n2️⃣  Migrating proteins and tiles...")
            self.migrate_proteins()

            print("\n3️⃣  Migrating search index...")
            self.migrate_search_index()

            print("\n✅ Migration complete!")

        except Exception as e:
            print(f"\n❌ Migration failed: {e}")
            import traceback
            traceback.print_exc()
            raise

    def migrate_viruses(self):
        """Migrate viruses.json"""
        viruses_file = self.data_dir / "viruses.json"

        if not viruses_file.exists():
            print(f"  ⚠️  File not found: {viruses_file}")
            return

        with open(viruses_file) as f:
            viruses_data = json.load(f)

        print(f"  📊 Found {len(viruses_data)} viruses")

        # Transform to match database schema
        viruses = []
        for v in viruses_data:
            viruses.append({
                "id": v["id"],
                "name": v["name"],
                "protein_count": v.get("proteinCount", 0),
                "tile_count": v.get("tileCount", 0),
                "taxon_ids": v.get("taxonIds", []),
                "host_species": v.get("hostSpecies", []),
                "baltimore_group": v.get("baltimoreGroup"),
                "genome_composition": v.get("genomeComposition"),
                "representative_protein_id": v.get("representativeProteinId"),
                "collapsed": v.get("collapsed", False),
            })

        # Insert in batches
        self.insert_batch("viruses", viruses, batch_size=100)
        print(f"  ✅ Migrated {len(viruses)} viruses")

    def migrate_proteins(self):
        """Migrate all protein JSON files"""
        proteins_dir = self.data_dir / "proteins"

        if not proteins_dir.exists():
            print(f"  ⚠️  Directory not found: {proteins_dir}")
            return

        protein_files = sorted(proteins_dir.glob("*.json"))
        print(f"  📊 Found {len(protein_files)} protein files")

        all_proteins = []
        all_tiles = []

        for file_idx, pfile in enumerate(protein_files):
            with open(pfile) as f:
                proteins_list = json.load(f)

            for protein in proteins_list:
                # Add protein
                all_proteins.append({
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
                })

                # Add tiles
                for tile in protein.get("tiles", []):
                    all_tiles.append({
                        "tile_id": tile["id"],
                        "protein_id": protein["id"],
                        "virus_id": protein["virusId"],
                        "start_pos": tile["start"],
                        "end_pos": tile["end"],
                        "sequence": tile.get("seq", ""),
                        "is_shared": tile.get("isShared", False),
                        "shared_count": tile.get("sharedCount", 0),
                    })

            # Insert proteins every 10 files
            if (file_idx + 1) % 10 == 0 or file_idx == len(protein_files) - 1:
                print(f"  📤 Uploading batch: {len(all_proteins)} proteins, {len(all_tiles)} tiles...")

                if all_proteins:
                    self.insert_batch("proteins", all_proteins, batch_size=100)
                    all_proteins = []

                if all_tiles:
                    # Tiles in smaller batches (more data per row)
                    self.insert_batch("tile_positions", all_tiles, batch_size=500)
                    all_tiles = []

                print(f"  ✓ Progress: {file_idx + 1}/{len(protein_files)} files")

        print(f"  ✅ Migration complete!")

    def migrate_search_index(self):
        """Migrate search.db SQLite to search_fts table"""
        search_db = self.data_dir / "search.db"

        if not search_db.exists():
            print(f"  ⚠️  File not found: {search_db}")
            return

        # Read from SQLite
        conn = sqlite3.connect(str(search_db))
        cursor = conn.execute("SELECT * FROM search_fts LIMIT 1")
        columns = [desc[0] for desc in cursor.description]
        print(f"  📊 Columns: {columns}")

        # Get all rows
        cursor = conn.execute("SELECT * FROM search_fts")
        rows = cursor.fetchall()
        print(f"  📊 Found {len(rows)} search entries")

        search_entries = []
        for i, row in enumerate(rows):
            entry_data = dict(zip(columns, row))

            search_text = " ".join([
                str(entry_data.get("name", "")),
                str(entry_data.get("accession", "")),
                str(entry_data.get("virus_name", "")),
            ])

            search_entries.append({
                "entry_id": entry_data.get("id", f"search_{i}"),
                "entry_type": entry_data.get("type", "unknown"),
                "name": entry_data.get("name", ""),
                "accession": entry_data.get("accession"),
                "virus_name": entry_data.get("virus_name"),
                "search_text": search_text,
            })

        conn.close()

        # Insert in batches
        self.insert_batch("search_fts", search_entries, batch_size=200)
        print(f"  ✅ Migrated {len(search_entries)} search entries")


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Migrate PhIP-seq data to Supabase via REST API")
    parser.add_argument(
        "--data-dir",
        default="../public/data",
        help="Path to data directory with JSON files",
    )
    parser.add_argument(
        "--project-id",
        default="upbmuioaecgartxtvhcx",
        help="Supabase project ID",
    )
    parser.add_argument(
        "--api-key",
        required=True,
        help="Supabase service_role API key",
    )

    args = parser.parse_args()

    # Validate data directory
    data_path = Path(args.data_dir)
    if not data_path.exists():
        print(f"❌ Data directory not found: {data_path}")
        sys.exit(1)

    migrator = SupabaseMigrator(args.data_dir, args.project_id, args.api_key)
    migrator.migrate_all()


if __name__ == "__main__":
    main()
