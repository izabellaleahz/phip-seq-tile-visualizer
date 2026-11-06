"""
SQLite Data Service

Fast data access using SQLite database with indexed queries.
"""

import sqlite3
import json
from pathlib import Path
from typing import List, Dict, Optional

# Database path
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
            self._conn = sqlite3.connect(str(self.db_path))
            self._conn.row_factory = sqlite3.Row
        return self._conn

    def filter_viruses(
        self,
        host_species: Optional[List[str]] = None,
        offset: int = 0,
        limit: int = 1000
    ) -> List[Dict]:
        """Filter viruses with indexed query"""
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
        """Get library statistics"""
        cursor = self.conn.cursor()

        stats = {}

        cursor.execute("SELECT COUNT(*) as count FROM viruses")
        stats['totalViruses'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM proteins")
        stats['totalProteins'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM tiles")
        stats['totalTiles'] = cursor.fetchone()['count']

        cursor.execute("SELECT COUNT(*) as count FROM tiles WHERE is_shared = 0")
        stats['uniqueTiles'] = cursor.fetchone()['count']

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
