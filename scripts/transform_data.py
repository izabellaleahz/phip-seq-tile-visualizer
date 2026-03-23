#!/usr/bin/env python3
"""
Transform PhIP-seq library CSV data into optimized JSON for the web visualizer.
"""

import json
import csv
import os
from collections import defaultdict
from pathlib import Path
import sys

# Increase CSV field size limit for large protein lists
csv.field_size_limit(sys.maxsize)

# Paths
ANALYSIS_DIR = Path("/large_storage/gilbertlab/izabella/phip_seq/phip_seq_oligo_generator/analysis_output")
OUTPUT_DIR = Path("/large_storage/gilbertlab/izabella/phip_seq/phip-seq-tile-visualizer/data")

def load_host_mapping():
    """Load host species mapping from host_mapping.json."""
    host_mapping_path = ANALYSIS_DIR / "host_mapping.json"
    if host_mapping_path.exists():
        with open(host_mapping_path, "r") as f:
            return json.load(f)
    print("  WARNING: host_mapping.json not found, all viruses will be 'human'")
    return {}

def get_host_species(taxon_ids, host_mapping):
    """Determine host species for a virus based on its taxon IDs."""
    if taxon_ids == ["0"]:
        return ["control"]
    hosts = set()
    for tid in taxon_ids:
        if tid in host_mapping:
            for h in host_mapping[tid]:
                hosts.add(h)
    return sorted(hosts) if hosts else ["human"]

def load_virus_summary():
    """Load virus summary data. Returns viruses dict and name->id mapping."""
    viruses = {}
    virus_name_to_id = {}  # Map virus full name to unique ID
    abbrev_counts = defaultdict(int)  # Track how many times each abbreviation is used
    host_mapping = load_host_mapping()

    with open(ANALYSIS_DIR / "virus_summary.csv", "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            virus_name = row["virus_name"]
            # Generate a simple abbreviation from the virus name
            words = virus_name.split()
            if len(words) >= 2:
                base_abbrev = ''.join(w[0].upper() for w in words[:3])
            else:
                base_abbrev = virus_name[:5].upper()

            # Make abbreviation unique by adding a suffix if needed
            abbrev_counts[base_abbrev] += 1
            if abbrev_counts[base_abbrev] > 1:
                virus_abbrev = f"{base_abbrev}_{abbrev_counts[base_abbrev]}"
            else:
                virus_abbrev = base_abbrev

            taxon_ids = row["taxon_ids"].split(";") if row.get("taxon_ids") else []
            host_species = get_host_species(taxon_ids, host_mapping)

            viruses[virus_abbrev] = {
                "id": virus_abbrev,
                "name": virus_name,
                "proteinCount": int(row["protein_count"]),
                "tileCount": int(row["tile_count"]),
                "taxonIds": taxon_ids,
                "hostSpecies": host_species,
            }
            virus_name_to_id[virus_name] = virus_abbrev

    return viruses, virus_name_to_id

def load_protein_summary(virus_name_to_id):
    """Load protein summary data using the virus name->id mapping."""
    proteins = {}
    proteins_by_virus = defaultdict(list)

    with open(ANALYSIS_DIR / "protein_summary.csv", "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            virus_name = row["virus_full_name"]
            # Use the mapping to get the correct unique virus ID
            virus_id = virus_name_to_id.get(virus_name, row["virus_abbrev"])

            # Parse X regions (JSON string from CSV)
            x_regions_raw = row.get("x_regions", "[]")
            try:
                x_regions = json.loads(x_regions_raw) if x_regions_raw else []
            except (json.JSONDecodeError, TypeError):
                x_regions = []

            protein = {
                "id": row["protein_id"],
                "virusId": virus_id,
                "virusName": virus_name,
                "name": row["protein_name"] if row["protein_name"] != "nan" else "Unknown",
                "nameClean": row["protein_name_clean"] if row["protein_name_clean"] != "nan" else "Unknown",
                "tileCount": int(row["tile_count"]),
                "sharedTiles": int(row["shared_tiles"]),
                "length": int(row["length"]),
                "coveragePct": float(row["coverage_pct"]),
                "coverageStart": int(row["coverage_start"]),
                "coverageEnd": int(row["coverage_end"]),
                "database": row.get("database", "Unknown"),
                "xRegions": x_regions,
            }
            proteins[row["protein_id"]] = protein
            proteins_by_virus[virus_id].append(protein)

    return proteins, proteins_by_virus

def process_tiles():
    """
    Process tile metadata to create:
    1. Per-protein tile positions
    2. Shared tile index (tile -> all proteins)
    """
    print("Processing tile metadata (this may take a few minutes)...")

    # Track tiles per protein for visualization
    protein_tiles = defaultdict(list)

    # Track shared tiles: sequence -> {tile_id, proteins: [...]}
    tile_sequences = {}  # sequence -> tile_id (use first encountered)
    tile_proteins = defaultdict(set)  # tile_id -> set of protein_ids
    tile_info = {}  # tile_id -> {seq, numSharing}

    row_count = 0
    # Use tiles_by_protein.csv which has correct per-protein positions
    with open(ANALYSIS_DIR / "tiles_by_protein.csv", "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            row_count += 1
            if row_count % 500000 == 0:
                print(f"  Processed {row_count:,} rows...")

            protein_id = row["protein_id"]
            tile_name = row["tile_id"]
            sequence = row["tile_sequence"]
            is_shared = int(row.get("num_shared_proteins", 1)) > 1 or row.get("is_merged", "False") == "True"
            num_sharing = int(row.get("num_shared_proteins", 1))

            # Add tile position to protein
            protein_tiles[protein_id].append({
                "id": tile_name,
                "start": int(row["tile_start"]),
                "end": int(row["tile_end"]),
                "isShared": is_shared,
                "seq": sequence
            })

            # Track shared tile info
            if is_shared:
                # Use sequence as key to deduplicate
                if sequence not in tile_sequences:
                    tile_sequences[sequence] = tile_name
                    tile_info[tile_name] = {
                        "seq": sequence,
                        "numSharing": num_sharing
                    }

                # Map this tile to the canonical tile_id for this sequence
                canonical_id = tile_sequences[sequence]
                tile_proteins[canonical_id].add(protein_id)

    print(f"  Total rows processed: {row_count:,}")
    print(f"  Unique shared tile sequences: {len(tile_sequences):,}")

    return protein_tiles, tile_info, tile_proteins

def build_search_index(viruses, proteins, proteins_by_virus, output_dir):
    """Build search indexes - one light for viruses, per-virus for proteins."""

    # Light index with just viruses (loads fast)
    virus_index = []
    for virus in viruses.values():
        virus_index.append({
            "id": virus["id"],
            "name": virus["name"],
            "hostSpecies": virus.get("hostSpecies", ["human"]),
        })

    with open(output_dir / "search-viruses.json", "w") as f:
        json.dump(virus_index, f)

    # Per-virus protein search indexes
    search_dir = output_dir / "search"
    search_dir.mkdir(exist_ok=True)

    for virus_id, virus_proteins in proteins_by_virus.items():
        protein_index = []
        for protein in virus_proteins:
            protein_index.append({
                "id": protein["id"],
                "name": protein["nameClean"],
            })
        with open(search_dir / f"{virus_id}.json", "w") as f:
            json.dump(protein_index, f)

    # Full search index (for deep search - loaded on demand)
    full_index = {
        "viruses": virus_index,
        "proteins": []
    }
    for protein in proteins.values():
        full_index["proteins"].append({
            "id": protein["id"],
            "name": protein["nameClean"],
            "virusId": protein["virusId"],
            "virusName": protein["virusName"]
        })

    with open(output_dir / "search-index.json", "w") as f:
        json.dump(full_index, f)

def main():
    # Create output directories
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "proteins").mkdir(exist_ok=True)
    (OUTPUT_DIR / "tiles").mkdir(exist_ok=True)

    print("Loading virus summary...")
    viruses, virus_name_to_id = load_virus_summary()
    print(f"  Loaded {len(viruses)} viruses")

    print("Loading protein summary...")
    proteins, proteins_by_virus = load_protein_summary(virus_name_to_id)
    print(f"  Loaded {len(proteins)} proteins")

    # Process tiles
    protein_tiles, tile_info, tile_proteins = process_tiles()

    # Calculate unique tiles per virus
    print("Calculating virus statistics...")
    for virus_id, virus_proteins in proteins_by_virus.items():
        unique_tiles = set()
        shared_count = 0
        for protein in virus_proteins:
            pid = protein["id"]
            if pid in protein_tiles:
                for tile in protein_tiles[pid]:
                    unique_tiles.add(tile["seq"])
                    if tile["isShared"]:
                        shared_count += 1

        if virus_id in viruses:
            viruses[virus_id]["uniqueTiles"] = len(unique_tiles)
            # Note: sharedTiles here is count of tile instances that are shared

    # Write viruses.json
    print("Writing viruses.json...")
    virus_list = sorted(viruses.values(), key=lambda x: x["tileCount"], reverse=True)
    with open(OUTPUT_DIR / "viruses.json", "w") as f:
        json.dump(virus_list, f)

    # Write per-virus protein files
    print("Writing per-virus protein files...")
    for virus_id, virus_proteins in proteins_by_virus.items():
        # Add tile data to each protein
        enriched_proteins = []
        for protein in virus_proteins:
            pid = protein["id"]
            tiles = protein_tiles.get(pid, [])
            # Sort tiles by start position
            tiles = sorted(tiles, key=lambda x: x["start"])
            enriched_proteins.append({
                **protein,
                "tiles": tiles
            })

        # Sort by tile count descending
        enriched_proteins.sort(key=lambda x: x["tileCount"], reverse=True)

        with open(OUTPUT_DIR / "proteins" / f"{virus_id}.json", "w") as f:
            json.dump(enriched_proteins, f)

    # Write protein index (for search/lookup)
    print("Writing protein index...")
    protein_index = {}
    for pid, protein in proteins.items():
        protein_index[pid] = {
            "id": protein["id"],
            "name": protein["nameClean"],
            "virusId": protein["virusId"],
            "virusName": protein["virusName"],
            "length": protein["length"]
        }
    with open(OUTPUT_DIR / "proteins" / "index.json", "w") as f:
        json.dump(protein_index, f)

    # Write shared tiles index with virus information
    print("Writing shared tiles index...")
    shared_tiles = {}
    for tile_id, info in tile_info.items():
        proteins_list = list(tile_proteins.get(tile_id, []))
        if len(proteins_list) > 1:  # Only include if truly shared
            # Group proteins by virus
            viruses_sharing = defaultdict(list)
            for pid in proteins_list:
                if pid in protein_index:
                    virus_id = protein_index[pid]["virusId"]
                    viruses_sharing[virus_id].append(pid)

            shared_tiles[info["seq"]] = {
                "id": tile_id,
                "proteins": proteins_list,
                "virusesSummary": {
                    vid: {
                        "count": len(pids),
                        "virusName": proteins.get(pids[0], {}).get("virusName", vid)
                    }
                    for vid, pids in viruses_sharing.items()
                },
                "numViruses": len(viruses_sharing),
                "isCrossVirus": len(viruses_sharing) > 1
            }

    with open(OUTPUT_DIR / "tiles" / "shared.json", "w") as f:
        json.dump(shared_tiles, f)

    # Write search indexes
    print("Writing search indexes...")
    build_search_index(viruses, proteins, proteins_by_virus, OUTPUT_DIR)

    # Write library statistics with enhanced info
    print("Writing library statistics...")
    with open(ANALYSIS_DIR / "library_statistics.json", "r") as f:
        stats = json.load(f)

    # Add cross-virus sharing statistics
    cross_virus_tiles = sum(1 for t in shared_tiles.values() if t["isCrossVirus"])
    same_virus_tiles = len(shared_tiles) - cross_virus_tiles

    stats["sharing_details"] = {
        "cross_virus_tiles": cross_virus_tiles,
        "same_virus_tiles": same_virus_tiles,
        "total_shared_tiles": len(shared_tiles)
    }

    # Add host species breakdown
    host_breakdown = defaultdict(lambda: {"viruses": 0, "proteins": 0, "tiles": 0})
    for virus in viruses.values():
        for host in virus.get("hostSpecies", ["human"]):
            host_breakdown[host]["viruses"] += 1
            host_breakdown[host]["proteins"] += virus["proteinCount"]
            host_breakdown[host]["tiles"] += virus["tileCount"]
    stats["host_species_breakdown"] = dict(host_breakdown)

    with open(OUTPUT_DIR / "statistics.json", "w") as f:
        json.dump(stats, f)

    print("\nData transformation complete!")
    print(f"Output directory: {OUTPUT_DIR}")

    # Print file sizes
    print("\nGenerated files:")
    for path in sorted(OUTPUT_DIR.rglob("*.json")):
        size = path.stat().st_size
        if size > 1024 * 1024:
            print(f"  {path.relative_to(OUTPUT_DIR)}: {size / 1024 / 1024:.1f} MB")
        else:
            print(f"  {path.relative_to(OUTPUT_DIR)}: {size / 1024:.1f} KB")

if __name__ == "__main__":
    main()
