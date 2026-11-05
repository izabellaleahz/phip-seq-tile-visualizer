"""
JSON Data Service

Loads and serves data from static JSON files.
Simple in-memory caching for fast lookups.
"""

import json
import os
from pathlib import Path
from typing import List, Dict, Optional
from functools import lru_cache

# Data directory path (will be mounted as Modal volume)
DATA_DIR = Path("/data")


class JSONDataService:
    """Service for loading and querying JSON data files"""

    def __init__(self, data_dir: Path = DATA_DIR):
        self.data_dir = data_dir
        self._viruses_cache = None
        self._search_index_cache = None
        self._protein_cache = {}  # Cache for individual protein files

    @property
    def viruses(self) -> List[Dict]:
        """Load and cache viruses.json"""
        if self._viruses_cache is None:
            viruses_file = self.data_dir / "viruses.json"
            with open(viruses_file) as f:
                self._viruses_cache = json.load(f)
        return self._viruses_cache

    @property
    def search_index(self) -> List[Dict]:
        """Load and cache search-index.json"""
        if self._search_index_cache is None:
            search_file = self.data_dir / "search-index.json"
            with open(search_file) as f:
                data = json.load(f)
                # Flatten the structure - it has a "viruses" key
                if isinstance(data, dict) and "viruses" in data:
                    self._search_index_cache = data["viruses"]
                else:
                    self._search_index_cache = data
        return self._search_index_cache

    def get_virus_proteins(self, virus_id: str) -> List[Dict]:
        """Load proteins for a specific virus from proteins/{virus_id}.json"""
        # Check cache first
        if virus_id in self._protein_cache:
            return self._protein_cache[virus_id]

        protein_file = self.data_dir / "proteins" / f"{virus_id}.json"

        if not protein_file.exists():
            return []

        with open(protein_file) as f:
            proteins = json.load(f)

        # Cache it
        self._protein_cache[virus_id] = proteins
        return proteins

    def get_protein_by_id(self, protein_id: str) -> Optional[Dict]:
        """Find a protein by ID - searches through all protein files"""
        # First check if we've already loaded this protein (in cache)
        for virus_id, proteins in self._protein_cache.items():
            for protein in proteins:
                if protein.get("id") == protein_id:
                    return protein

        # If not in cache, search through all protein files
        # Use os.listdir for better compatibility
        proteins_dir = self.data_dir / "proteins"
        if not proteins_dir.exists() or not proteins_dir.is_dir():
            return None

        try:
            # Get all JSON files in the proteins directory
            protein_files = [f for f in os.listdir(str(proteins_dir)) if f.endswith('.json')]

            # Search through each protein file
            for filename in protein_files:
                virus_id = filename.replace('.json', '')

                # Load proteins for this virus
                proteins = self.get_virus_proteins(virus_id)

                # Search for the protein in this virus's proteins
                for protein in proteins:
                    if protein.get("id") == protein_id:
                        # Ensure virusId is set
                        if "virusId" not in protein:
                            protein["virusId"] = virus_id
                        return protein
        except Exception as e:
            print(f"Error searching for protein {protein_id}: {e}")
            return None

        return None

    def filter_viruses(
        self,
        host_species: Optional[List[str]] = None,
        offset: int = 0,
        limit: int = 1000
    ) -> List[Dict]:
        """Filter viruses by host species"""
        viruses = self.viruses

        if host_species:
            # Filter where virus hostSpecies overlaps with requested species
            viruses = [
                v for v in viruses
                if any(hs in v.get("hostSpecies", []) for hs in host_species)
            ]

        # Apply pagination
        return viruses[offset:offset + limit]

    def search(self, query: str, limit: int = 20) -> List[Dict]:
        """Simple text search across search index"""
        query_lower = query.lower()
        results = []

        for entry in self.search_index:
            # Search in name, accession, virus name
            searchable_text = " ".join([
                str(entry.get("name", "")),
                str(entry.get("accession", "")),
                str(entry.get("virusName", "")),
            ]).lower()

            if query_lower in searchable_text:
                results.append(entry)
                if len(results) >= limit:
                    break

        return results


# Global instance
_data_service = None


def get_data_service(data_dir: Path = DATA_DIR) -> JSONDataService:
    """Get or create global data service instance"""
    global _data_service
    if _data_service is None:
        _data_service = JSONDataService(data_dir)
    return _data_service
