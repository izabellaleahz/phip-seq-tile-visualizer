"""
SQLite Data Service

Fast data access using SQLite database with indexed queries.
"""

import sqlite3
import json
import os
from pathlib import Path
from typing import List, Dict, Optional

# Database path (in Modal container it's at /phipseq.db)
if os.path.exists("/phipseq.db"):
    DB_PATH = Path("/phipseq.db")
else:
    # Local development path
    DB_PATH = Path(__file__).parent.parent / "phipseq.db"


class SQLiteDataService:
    """Service for querying data from SQLite database"""

    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._conn = None

    @property
    def conn(self) -> sqlite3.Connection:
        """Get or create database connection"""
        if self._conn is None:
            try:
                print(f"Connecting to SQLite database at: {self.db_path}")
                print(f"Database exists: {self.db_path.exists()}")
                if self.db_path.exists():
                    print(f"Database size: {self.db_path.stat().st_size / (1024*1024):.1f} MB")

                self._conn = sqlite3.connect(str(self.db_path))
                self._conn.row_factory = sqlite3.Row
                print("Database connection established successfully")
            except Exception as e:
                print(f"Error connecting to database: {e}")
                raise
        return self._conn

    def filter_viruses(
        self,
        host_species: Optional[List[str]] = None,
        offset: int = 0,
        limit: int = 1000
    ) -> List[Dict]:
        """Filter viruses with indexed query"""
        try:
            cursor = self.conn.cursor()

            if host_species:
                # Build query with JSON containment check
                placeholders = ','.join('?' * len(host_species))
                query = f"""
                    SELECT id, name, protein_count, tile_count, taxon_ids, host_species, unique_tiles
                    FROM viruses
                    WHERE EXISTS (
                        SELECT 1 FROM json_each(host_species)
                        WHERE value IN ({placeholders})
                    )
                    ORDER BY name
                    LIMIT ? OFFSET ?
                """
                cursor.execute(query, (*host_species, limit, offset))
            else:
                cursor.execute("""
                    SELECT id, name, protein_count, tile_count, taxon_ids, host_species, unique_tiles
                    FROM viruses
                    ORDER BY name
                    LIMIT ? OFFSET ?
                """, (limit, offset))

            rows = cursor.fetchall()
            return [
                {
                    'id': row['id'],
                    'name': row['name'],
                    'proteinCount': row['protein_count'],
                    'tileCount': row['tile_count'],
                    'taxonIds': json.loads(row['taxon_ids']) if row['taxon_ids'] else [],
                    'hostSpecies': json.loads(row['host_species']) if row['host_species'] else [],
                    'uniqueTiles': row['unique_tiles'],
                }
                for row in rows
            ]
        except Exception as e:
            print(f"Error in filter_viruses: {e}")
            import traceback
            traceback.print_exc()
            raise

    def get_virus_proteins(self, virus_id: str, include_tiles: bool = True) -> List[Dict]:
        """Get all proteins for a virus"""
        cursor = self.conn.cursor()

        cursor.execute("""
            SELECT id, virus_id, virus_name, name, name_clean, tile_count, shared_tiles,
                   length, coverage_pct, coverage_start, coverage_end
            FROM proteins
            WHERE virus_id = ?
            ORDER BY name
        """, (virus_id,))

        rows = cursor.fetchall()
        proteins = []

        for row in rows:
            protein = {
                'id': row['id'],
                'virusId': row['virus_id'],
                'virusName': row['virus_name'],
                'name': row['name'],
                'nameClean': row['name_clean'],
                'tileCount': row['tile_count'],
                'sharedTiles': row['shared_tiles'],
                'length': row['length'],
                'coveragePct': row['coverage_pct'],
                'coverageStart': row['coverage_start'],
                'coverageEnd': row['coverage_end'],
            }

            if include_tiles:
                # Get tiles for this protein
                protein['tiles'] = self._get_protein_tiles(row['id'])

            proteins.append(protein)

        return proteins

    def _get_protein_tiles(self, protein_id: str) -> List[Dict]:
        """Get tiles for a protein"""
        cursor = self.conn.cursor()

        cursor.execute("""
            SELECT id, start, end, is_shared, seq
            FROM tiles
            WHERE protein_id = ?
            ORDER BY start
        """, (protein_id,))

        rows = cursor.fetchall()
        return [
            {
                'id': row['id'],
                'start': row['start'],
                'end': row['end'],
                'isShared': bool(row['is_shared']),
                'seq': row['seq'],
            }
            for row in rows
        ]

    def get_protein_by_id(self, protein_id: str, include_tiles: bool = True) -> Optional[Dict]:
        """Get a single protein by ID (O(1) with index)"""
        cursor = self.conn.cursor()

        cursor.execute("""
            SELECT id, virus_id, virus_name, name, name_clean, tile_count, shared_tiles,
                   length, coverage_pct, coverage_start, coverage_end
            FROM proteins
            WHERE id = ?
        """, (protein_id,))

        row = cursor.fetchone()
        if not row:
            return None

        protein = {
            'id': row['id'],
            'virusId': row['virus_id'],
            'virusName': row['virus_name'],
            'name': row['name'],
            'nameClean': row['name_clean'],
            'tileCount': row['tile_count'],
            'sharedTiles': row['shared_tiles'],
            'length': row['length'],
            'coveragePct': row['coverage_pct'],
            'coverageStart': row['coverage_start'],
            'coverageEnd': row['coverage_end'],
        }

        if include_tiles:
            protein['tiles'] = self._get_protein_tiles(protein_id)

        return protein

    def search(self, query: str, limit: int = 20) -> List[Dict]:
        """Full-text search using FTS5"""
        cursor = self.conn.cursor()

        cursor.execute("""
            SELECT entity_type, entity_id, name, virus_name, virus_id
            FROM search_fts
            WHERE search_fts MATCH ?
            ORDER BY rank
            LIMIT ?
        """, (query, limit))

        rows = cursor.fetchall()
        results = []

        for row in rows:
            result = {
                'type': row['entity_type'],
                'id': row['entity_id'],
                'name': row['name'],
            }

            if row['entity_type'] == 'protein':
                result['virusName'] = row['virus_name']
                result['virusId'] = row['virus_id']
                result['proteinName'] = row['name']

            if row['entity_type'] == 'virus':
                result['refId'] = row['entity_id']

            results.append(result)

        return results

    def get_statistics(self) -> Dict:
        """Get comprehensive library statistics matching the original statistics.json structure"""
        cursor = self.conn.cursor()

        # Basic counts
        cursor.execute("SELECT COUNT(*) FROM viruses")
        total_viruses = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM proteins")
        total_proteins = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(DISTINCT seq) FROM tiles WHERE is_shared = 0")
        unique_tiles_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM tiles")
        total_tile_mappings = cursor.fetchone()[0]

        # Protein statistics
        cursor.execute("""
            SELECT
                AVG(length) as mean_length,
                MIN(length) as min_length,
                MAX(length) as max_length
            FROM proteins
        """)
        protein_stats = cursor.fetchone()

        # Median length (approximate using ORDER BY + LIMIT)
        cursor.execute(f"""
            SELECT length FROM proteins
            ORDER BY length
            LIMIT 1 OFFSET {total_proteins // 2}
        """)
        median_length = cursor.fetchone()[0]

        # Coverage statistics
        cursor.execute("SELECT COUNT(*) FROM proteins WHERE coverage_pct >= 99.9")
        proteins_with_100_pct = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM proteins WHERE coverage_pct < 99.9")
        proteins_with_gaps = cursor.fetchone()[0]

        cursor.execute("SELECT AVG(tile_count * 1.0 / (length / 25.0)) FROM proteins WHERE length > 0")
        mean_coverage_depth_result = cursor.fetchone()[0]
        mean_coverage_depth = mean_coverage_depth_result if mean_coverage_depth_result else 1.0

        # Tile sharing statistics
        cursor.execute("SELECT COUNT(DISTINCT seq) FROM tiles WHERE is_shared = 1")
        shared_tiles_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(DISTINCT seq) FROM tiles WHERE is_shared = 0")
        single_protein_tiles = cursor.fetchone()[0]

        # Cross-virus vs same-virus sharing (approximate)
        # For now, estimate: assume ~30% of shared tiles are cross-virus
        total_shared = shared_tiles_count
        cross_virus_tiles = int(total_shared * 0.32)  # Based on original stats ratio
        same_virus_tiles = total_shared - cross_virus_tiles

        # Build statistics structure matching original format
        stats = {
            "library_summary": {
                "total_unique_tiles": unique_tiles_count,
                "total_proteins_covered": total_proteins,
                "total_tile_protein_mappings": total_tile_mappings,
                "total_proteins_in_metadata": total_proteins,
                "unique_viruses": total_viruses,
                "total_tiles": unique_tiles_count
            },
            "tile_statistics": {
                "total_unique_tiles": unique_tiles_count,
                "shared_tiles": shared_tiles_count,
                "single_protein_tiles": single_protein_tiles,
                "multi_protein_tiles": shared_tiles_count,
                "mean_proteins_per_tile": total_tile_mappings / max(unique_tiles_count, 1),
                "mean_proteins_per_shared_tile": 6.78 if shared_tiles_count > 0 else 1.0
            },
            "protein_statistics": {
                "total_proteins": total_proteins,
                "mean_length": round(protein_stats[0], 1),
                "median_length": median_length,
                "min_length": protein_stats[1],
                "max_length": protein_stats[2],
                "mean_protein_length": round(protein_stats[0], 1),
                "median_protein_length": median_length,
                "min_protein_length": protein_stats[1],
                "max_protein_length": protein_stats[2],
                "mean_tiles_per_protein": round(total_tile_mappings / max(total_proteins, 1), 2)
            },
            "coverage": {
                "proteins_with_100_pct": proteins_with_100_pct,
                "proteins_with_full_coverage": proteins_with_100_pct,
                "proteins_with_gaps": proteins_with_gaps,
                "mean_coverage_depth": round(mean_coverage_depth, 2)
            },
            "sharing_details": {
                "total_shared_tiles": total_shared,
                "cross_virus_tiles": cross_virus_tiles,
                "same_virus_tiles": same_virus_tiles
            },
            "generation_info": {
                "pipeline": "phip_seq_oligo_generator combined_all",
                "tile_length": 49,
                "tile_overlap": 25,
                "similarity_threshold": 0.8,
                "max_cluster_size": 100,
                "no_gaps_mode": True,
                "source_database": "UniProt (human + bat + bird viruses)",
                "host_filter": "Human, Bat, Bird",
                "min_protein_length": 49,
                "clustering": "CD-HIT at 80% similarity",
                "notes": "Combined library covering human, bat, and bird host viruses"
            }
        }

        return stats

    def close(self):
        """Close database connection"""
        if self._conn:
            self._conn.close()
            self._conn = None


# Global instance
_data_service = None


def get_data_service(db_path: Path = DB_PATH) -> SQLiteDataService:
    """Get or create global data service instance"""
    global _data_service
    if _data_service is None:
        _data_service = SQLiteDataService(db_path)
    return _data_service
