#!/usr/bin/env python3
"""
Generate combined analysis CSVs from human, bat, and bird virus data.

Reads:
  - Bat/bird/human metadata TSVs (for protein info and host classification)
  - Combined tiles.json (for tile-protein mappings)

Outputs to analysis_output/:
  - virus_summary.csv
  - protein_summary.csv
  - tiles_by_protein.csv
  - library_statistics.json
  - host_mapping.json
"""

import json
import csv
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path
from statistics import mean, median

# Paths
PIPELINE_DIR = Path("/large_storage/gilbertlab/izabella/phip_seq/phip_seq_oligo_generator")
INPUTS_DIR = PIPELINE_DIR / "outputs/inputs"
TILES_JSON = PIPELINE_DIR / "outputs/combined_library_2026/tile_clusters/collapsed_tiles.json"
COLLAPSED_FASTA = PIPELINE_DIR / "outputs/combined_library_2026/protein_clusters/proteins_collapsed_99.fasta"
OUTPUT_DIR = PIPELINE_DIR / "analysis_output"
BACKUP_DIR = OUTPUT_DIR.parent / "analysis_output_human_only_backup"

# Control definitions — must match scripts/add_controls.py in the pipeline repo
CONTROL_PEPTIDES = [
    {
        "id": "CONTROL_GFAP_F5",
        "gene": "GFAP",
        "sequence": "RELRLRLDQLTANSARLEVERDNLAQDLATVRQKLQDETNLRLEAENNL",
        "source": "NP_001229305.1 glial fibrillary acidic protein isoform 3 [Homo sapiens]",
    },
    {
        "id": "CONTROL_GFAP_F11",
        "gene": "GFAP",
        "sequence": "TDAAARNAELLRQAKHEANDYRRQLQSLTCDLESLRGTNESLERQMREQ",
        "source": "NP_001229305.1 glial fibrillary acidic protein isoform 3 [Homo sapiens]",
    },
    {
        "id": "CONTROL_MYC_F17",
        "gene": "MYC",
        "sequence": "PKVVILKKATAYILSVQAEEQKLISEEDLLRKRREQLKHKLEQLRNSCA",
        "source": "NP_002458.2 myc proto-oncogene protein [Homo sapiens]",
    },
]
NUM_STOP_CODON_PHAGES = 50


def clean_protein_name(name):
    """Clean protein name by removing qualifiers."""
    if not name or name == 'nan':
        return 'Unknown'
    cleaned = re.sub(r'\s*\(Fragment\)\s*$', '', name)
    cleaned = re.sub(r'\s*\(Precursor\)\s*$', '', cleaned)
    return cleaned.strip() or 'Unknown'


def make_virus_abbrev(name):
    """Generate a short abbreviation from virus name."""
    words = name.split()
    if len(words) >= 2:
        return ''.join(w[0].upper() for w in words[:3])
    return name[:5].upper()


def compute_coverage(tiles, protein_length):
    """Compute coverage using merged intervals."""
    if not tiles or protein_length <= 0:
        return 0.0, 0, 0

    intervals = sorted((t['tile_start'], min(t['tile_end'], protein_length)) for t in tiles)

    merged = [intervals[0]]
    for start, end in intervals[1:]:
        if start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))

    covered = sum(end - start for start, end in merged)
    coverage_pct = round(min(covered / protein_length * 100, 100.0), 1)
    coverage_start = merged[0][0]
    coverage_end = merged[-1][1]

    return coverage_pct, coverage_start, coverage_end


def collect_taxon_ids(tsv_path):
    """Fast pass to collect all taxon_ids from a metadata TSV."""
    taxon_ids = set()
    with open(tsv_path, 'r') as f:
        reader = csv.DictReader(f, delimiter='\t')
        for row in reader:
            taxon_ids.add(row['taxon_id'])
    return taxon_ids


def load_metadata_filtered(tsv_path, needed_pids):
    """Load metadata for only the needed protein IDs."""
    proteins = {}
    with open(tsv_path, 'r') as f:
        reader = csv.DictReader(f, delimiter='\t')
        for row in reader:
            acc = row['accession']
            if acc in needed_pids:
                proteins[acc] = {
                    'organism': row['organism'],
                    'taxon_id': row['taxon_id'],
                    'protein_name': row['protein_name'],
                    'length': int(row['length']),
                    'database': row.get('database', 'Unknown'),
                }
    return proteins


def compute_x_regions(sequence):
    """Find contiguous X (unknown residue) regions in a protein sequence."""
    regions = []
    i = 0
    while i < len(sequence):
        if sequence[i] == 'X':
            start = i
            while i < len(sequence) and sequence[i] == 'X':
                i += 1
            regions.append({"start": start, "end": i})
        else:
            i += 1
    return regions


def load_protein_sequences(fasta_path, needed_pids):
    """Load protein sequences from a FASTA file for needed protein IDs."""
    sequences = {}
    current_id = None
    current_seq = []
    with open(fasta_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line.startswith('>'):
                if current_id and current_id in needed_pids:
                    sequences[current_id] = ''.join(current_seq)
                current_id = line[1:].split()[0]
                current_seq = []
            else:
                current_seq.append(line)
        if current_id and current_id in needed_pids:
            sequences[current_id] = ''.join(current_seq)
    return sequences


def inject_controls(virus_organisms, protein_summaries, protein_tiles, all_meta, active_proteins):
    """Inject control entries into the data structures."""
    control_organism = "Controls (non-viral)"

    # Add peptide controls as proteins
    gene_tiles = defaultdict(list)  # gene -> list of tiles
    for ctrl in CONTROL_PEPTIDES:
        tile_entry = {
            'tile_id': ctrl['id'],
            'tile_start': 0,
            'tile_end': len(ctrl['sequence']),
            'tile_sequence': ctrl['sequence'],
            'tile_length': len(ctrl['sequence']),
            'num_shared_proteins': 1,
            'is_merged': False,
        }
        gene_tiles[ctrl['gene']].append(tile_entry)

    # Add stop codon phage tiles under one "protein"
    for i in range(1, NUM_STOP_CODON_PHAGES + 1):
        gene_tiles["STOP_CODON"].append({
            'tile_id': f'CONTROL_STOP_{i:03d}',
            'tile_start': 0,
            'tile_end': 0,
            'tile_sequence': f'[stop codon phage #{i}]',
            'tile_length': 49,
            'num_shared_proteins': 1,
            'is_merged': False,
        })

    # Register as a virus
    virus_organisms[control_organism]['taxon_ids'].add("0")
    control_proteins_added = 0

    for gene, tiles in gene_tiles.items():
        pid = f"CONTROL_{gene}"
        protein_tiles[pid] = tiles
        active_proteins.add(pid)
        virus_organisms[control_organism]['proteins'].append(pid)
        virus_organisms[control_organism]['protein_names'].append(gene)
        control_proteins_added += 1

        if gene == "STOP_CODON":
            prot_length = 0
            prot_name = "Stop codon phages (empty display)"
        else:
            prot_length = len(CONTROL_PEPTIDES[0]['sequence'])  # 49 AA
            prot_name = next(c['source'] for c in CONTROL_PEPTIDES if c['gene'] == gene)

        all_meta[pid] = {
            'organism': control_organism,
            'taxon_id': '0',
            'protein_name': prot_name,
            'length': prot_length,
            'database': 'Control',
        }

        protein_summaries.append({
            'protein_id': pid,
            'virus_full_name': control_organism,
            'virus_abbrev': 'CTRL',
            'protein_name': prot_name,
            'protein_name_clean': gene,
            'tile_count': len(tiles),
            'shared_tiles': 0,
            'length': prot_length,
            'coverage_pct': 100.0 if prot_length > 0 else 0.0,
            'coverage_start': 0,
            'coverage_end': prot_length,
            'database': 'Control',
            'x_regions': '[]',
        })

    print(f"  Injected {control_proteins_added} control proteins ({sum(len(t) for t in gene_tiles.values())} tiles)")


def main():
    # Backup existing output
    if OUTPUT_DIR.exists() and not BACKUP_DIR.exists():
        print(f"Backing up existing analysis_output to {BACKUP_DIR}...")
        shutil.copytree(OUTPUT_DIR, BACKUP_DIR)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Step 1: Collect taxon_ids for host mapping (fast pass over all metadata)
    print("Collecting taxon IDs for host mapping...")
    human_taxons = collect_taxon_ids(INPUTS_DIR / "human_combined_metadata.tsv")
    print(f"  Human: {len(human_taxons)} taxon IDs")
    bat_taxons = collect_taxon_ids(INPUTS_DIR / "bat_viruses_metadata.tsv")
    print(f"  Bat: {len(bat_taxons)} taxon IDs")
    bird_taxons = collect_taxon_ids(INPUTS_DIR / "bird_viruses_metadata.tsv")
    print(f"  Bird: {len(bird_taxons)} taxon IDs")

    # Build host mapping
    host_mapping = {}
    for tid in human_taxons:
        host_mapping.setdefault(tid, [])
        if "human" not in host_mapping[tid]:
            host_mapping[tid].append("human")
    for tid in bat_taxons:
        host_mapping.setdefault(tid, [])
        if "bat" not in host_mapping[tid]:
            host_mapping[tid].append("bat")
    for tid in bird_taxons:
        host_mapping.setdefault(tid, [])
        if "bird" not in host_mapping[tid]:
            host_mapping[tid].append("bird")

    print(f"  Total host mapping entries: {len(host_mapping)}")

    # Write host_mapping.json early (doesn't depend on tiles)
    print("Writing host_mapping.json...")
    with open(OUTPUT_DIR / "host_mapping.json", 'w') as f:
        json.dump(host_mapping, f)

    # Step 2: Load tiles.json
    print("\nLoading tiles.json (345 MB, this may take a few minutes)...")
    sys.stdout.flush()
    with open(TILES_JSON, 'r') as f:
        tiles_data = json.load(f)
    print(f"  {len(tiles_data):,} tiles loaded")

    # Build per-protein tile lists and identify needed proteins
    print("Building per-protein tile data...")
    protein_tiles = defaultdict(list)
    needed_pids = set()

    for i, tile in enumerate(tiles_data):
        if (i + 1) % 100000 == 0:
            print(f"  Processed {i + 1:,} tiles...")
            sys.stdout.flush()

        tile_id = tile['id']
        sequence = tile['sequence']
        primary_pid = tile['protein_id']
        start = tile['start_pos']
        end = tile['end_pos']
        source_proteins = tile.get('source_proteins', [primary_pid])
        num_proteins = tile.get('num_proteins', 1)
        is_merged = tile.get('is_merged', False)

        entry = {
            'tile_id': tile_id,
            'tile_start': start,
            'tile_end': end,
            'tile_sequence': sequence,
            'tile_length': len(sequence),
            'num_shared_proteins': num_proteins,
            'is_merged': is_merged,
        }

        # Add to primary protein with exact positions
        protein_tiles[primary_pid].append(entry)
        needed_pids.add(primary_pid)

        # Add to source proteins (approximate positions for merged tiles)
        for sp in source_proteins:
            if sp != primary_pid:
                protein_tiles[sp].append(entry)
                needed_pids.add(sp)

    # Free tiles data
    del tiles_data
    print(f"  Proteins with tiles: {len(protein_tiles):,}")

    # Step 3: Load metadata for proteins that have tiles
    print("\nLoading metadata for tiled proteins...")
    print("  Loading human metadata...")
    sys.stdout.flush()
    human_meta = load_metadata_filtered(
        INPUTS_DIR / "human_combined_metadata.tsv", needed_pids)
    print(f"    {len(human_meta):,} human proteins matched")

    print("  Loading bat metadata...")
    bat_meta = load_metadata_filtered(
        INPUTS_DIR / "bat_viruses_metadata.tsv", needed_pids)
    print(f"    {len(bat_meta):,} bat proteins matched")

    print("  Loading bird metadata...")
    bird_meta = load_metadata_filtered(
        INPUTS_DIR / "bird_viruses_metadata.tsv", needed_pids)
    print(f"    {len(bird_meta):,} bird proteins matched")

    # Combine metadata
    all_meta = {}
    all_meta.update(human_meta)
    all_meta.update(bat_meta)
    all_meta.update(bird_meta)

    active_proteins = set(protein_tiles.keys()) & set(all_meta.keys())
    orphan = set(protein_tiles.keys()) - set(all_meta.keys())
    print(f"\n  Proteins with tiles AND metadata: {len(active_proteins):,}")
    if orphan:
        print(f"  WARNING: {len(orphan):,} proteins have tiles but no metadata (skipping)")

    # Step 3b: Load protein sequences for X region detection
    print("\nLoading protein sequences for X region detection...")
    protein_sequences = {}
    if COLLAPSED_FASTA.exists():
        protein_sequences = load_protein_sequences(COLLAPSED_FASTA, active_proteins)
        x_count = sum(1 for pid in protein_sequences if 'X' in protein_sequences[pid])
        print(f"  Loaded {len(protein_sequences):,} sequences ({x_count:,} contain X residues)")
    else:
        print(f"  WARNING: {COLLAPSED_FASTA} not found, X regions will be empty")

    # Step 4: Generate outputs
    # Group by organism for virus_summary
    print("\nGrouping proteins by organism...")
    virus_organisms = defaultdict(lambda: {
        'taxon_ids': set(),
        'proteins': [],
        'protein_names': [],
    })

    protein_summaries = []

    for pid in sorted(active_proteins):
        meta = all_meta[pid]
        organism = meta['organism']
        tiles = protein_tiles[pid]

        virus_organisms[organism]['taxon_ids'].add(meta['taxon_id'])
        virus_organisms[organism]['proteins'].append(pid)
        virus_organisms[organism]['protein_names'].append(meta['protein_name'])

        # Compute protein stats
        shared_count = sum(
            1 for t in tiles
            if t['num_shared_proteins'] > 1 or t['is_merged']
        )
        coverage_pct, cov_start, cov_end = compute_coverage(tiles, meta['length'])

        # Compute X regions from protein sequence
        seq = protein_sequences.get(pid, '')
        x_regions = compute_x_regions(seq) if seq else []

        protein_summaries.append({
            'protein_id': pid,
            'virus_full_name': organism,
            'virus_abbrev': make_virus_abbrev(organism),
            'protein_name': meta['protein_name'],
            'protein_name_clean': clean_protein_name(meta['protein_name']),
            'tile_count': len(tiles),
            'shared_tiles': shared_count,
            'length': meta['length'],
            'coverage_pct': coverage_pct,
            'coverage_start': cov_start,
            'coverage_end': cov_end,
            'database': meta.get('database', 'Unknown'),
            'x_regions': json.dumps(x_regions),
        })

    print(f"  {len(virus_organisms):,} viruses, {len(protein_summaries):,} proteins")

    # Inject controls
    print("\nInjecting controls...")
    inject_controls(virus_organisms, protein_summaries, protein_tiles, all_meta, active_proteins)
    print(f"  Now: {len(virus_organisms):,} viruses, {len(protein_summaries):,} proteins")

    # Write virus_summary.csv
    print("\nWriting virus_summary.csv...")
    with open(OUTPUT_DIR / "virus_summary.csv", 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            'virus_name', 'taxon_ids', 'protein_count', 'tile_count',
            'proteins', 'protein_names'
        ])
        for organism in sorted(virus_organisms.keys()):
            data = virus_organisms[organism]
            tile_count = sum(
                len(protein_tiles.get(p, [])) for p in data['proteins']
            )
            writer.writerow([
                organism,
                ';'.join(sorted(data['taxon_ids'])),
                len(data['proteins']),
                tile_count,
                ','.join(data['proteins']),
                ','.join(data['protein_names']),
            ])
    print(f"  {len(virus_organisms):,} viruses written")

    # Write protein_summary.csv
    print("Writing protein_summary.csv...")
    with open(OUTPUT_DIR / "protein_summary.csv", 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'protein_id', 'virus_full_name', 'virus_abbrev', 'protein_name',
            'protein_name_clean', 'tile_count', 'shared_tiles', 'length',
            'coverage_pct', 'coverage_start', 'coverage_end', 'database',
            'x_regions'
        ])
        writer.writeheader()
        for ps in protein_summaries:
            writer.writerow(ps)
    print(f"  {len(protein_summaries):,} proteins written")

    # Write tiles_by_protein.csv
    print("Writing tiles_by_protein.csv...")
    row_count = 0
    with open(OUTPUT_DIR / "tiles_by_protein.csv", 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            'protein_id', 'protein_length', 'organism', 'protein_name',
            'tile_id', 'tile_start', 'tile_end', 'tile_sequence',
            'tile_length', 'num_shared_proteins', 'is_merged', 'database'
        ])
        for pid in sorted(active_proteins):
            meta = all_meta[pid]
            for tile in protein_tiles[pid]:
                writer.writerow([
                    pid,
                    meta['length'],
                    meta['organism'],
                    meta['protein_name'],
                    tile['tile_id'],
                    tile['tile_start'],
                    tile['tile_end'],
                    tile['tile_sequence'],
                    tile['tile_length'],
                    tile['num_shared_proteins'],
                    tile['is_merged'],
                    meta.get('database', 'Unknown'),
                ])
                row_count += 1
            if row_count % 200000 == 0:
                print(f"  Written {row_count:,} rows...")
                sys.stdout.flush()
    print(f"  {row_count:,} tile-protein rows written")

    # Compute library statistics
    print("\nComputing library statistics...")
    unique_tile_seqs = set()
    merged_count = 0
    single_count = 0
    proteins_per_tile = []

    for pid in active_proteins:
        for tile in protein_tiles[pid]:
            seq = tile['tile_sequence']
            if seq not in unique_tile_seqs:
                unique_tile_seqs.add(seq)
                n = tile['num_shared_proteins']
                if n > 1 or tile['is_merged']:
                    merged_count += 1
                    proteins_per_tile.append(n)
                else:
                    single_count += 1
                    proteins_per_tile.append(1)

    lengths = [all_meta[pid]['length'] for pid in active_proteins]
    coverages = [ps['coverage_pct'] for ps in protein_summaries]
    full_coverage = sum(1 for c in coverages if c >= 100.0)
    gap_coverage = sum(1 for c in coverages if c < 100.0)
    tiles_per_protein = [len(protein_tiles[pid]) for pid in active_proteins]

    stats = {
        "library_summary": {
            "total_tiles": len(unique_tile_seqs),
            "total_unique_tiles": len(unique_tile_seqs),
            "total_proteins_covered": len(active_proteins),
            "total_tile_protein_mappings": row_count,
            "total_proteins_in_metadata": len(all_meta),
            "unique_viruses": len(virus_organisms),
        },
        "coverage_statistics": {
            "mean_coverage_pct": round(mean(coverages), 2) if coverages else 0,
            "median_coverage_pct": round(median(coverages), 1) if coverages else 0,
            "min_coverage_pct": min(coverages) if coverages else 0,
            "max_coverage_pct": max(coverages) if coverages else 0,
            "proteins_fully_covered": full_coverage,
            "proteins_with_full_coverage": full_coverage,
            "proteins_with_100_pct": full_coverage,
            "proteins_with_gaps": gap_coverage,
            "mean_coverage_depth": round(
                mean(tiles_per_protein), 2) if tiles_per_protein else 0,
        },
        "coverage": {
            "proteins_with_100_pct": full_coverage,
            "proteins_with_full_coverage": full_coverage,
            "proteins_with_gaps": gap_coverage,
            "mean_coverage_depth": round(
                mean(tiles_per_protein), 2) if tiles_per_protein else 0,
        },
        "tile_statistics": {
            "total_unique_tiles": len(unique_tile_seqs),
            "merged_tiles": merged_count,
            "shared_tiles": merged_count,
            "single_protein_tiles": single_count,
            "multi_protein_tiles": merged_count,
            "mean_proteins_per_tile": round(
                mean(proteins_per_tile), 2) if proteins_per_tile else 0,
            "mean_proteins_per_shared_tile": round(
                mean([p for p in proteins_per_tile if p > 1]), 2
            ) if any(p > 1 for p in proteins_per_tile) else 0,
        },
        "protein_statistics": {
            "total_proteins": len(active_proteins),
            "mean_length": round(mean(lengths), 1) if lengths else 0,
            "mean_protein_length": round(mean(lengths), 1) if lengths else 0,
            "median_length": round(median(lengths), 1) if lengths else 0,
            "median_protein_length": round(median(lengths), 1) if lengths else 0,
            "min_length": min(lengths) if lengths else 0,
            "min_protein_length": min(lengths) if lengths else 0,
            "max_length": max(lengths) if lengths else 0,
            "max_protein_length": max(lengths) if lengths else 0,
            "mean_tiles_per_protein": round(
                mean(tiles_per_protein), 2) if tiles_per_protein else 0,
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
            "notes": "Combined library covering human, bat, and bird host viruses",
        },
    }

    print("Writing library_statistics.json...")
    with open(OUTPUT_DIR / "library_statistics.json", 'w') as f:
        json.dump(stats, f, indent=2)

    # Summary
    print(f"\n{'='*60}")
    print(f"Generation complete!")
    print(f"  Output directory: {OUTPUT_DIR}")
    print(f"  Viruses: {len(virus_organisms):,}")
    print(f"  Proteins: {len(active_proteins):,}")
    print(f"  Unique tiles: {len(unique_tile_seqs):,}")
    print(f"  Tile-protein mappings: {row_count:,}")
    print(f"  Host mapping entries: {len(host_mapping)}")
    print(f"{'='*60}")

    # Print output file sizes
    print("\nOutput files:")
    for path in sorted(OUTPUT_DIR.glob("*")):
        if path.is_file():
            size = path.stat().st_size
            if size > 1024 * 1024:
                print(f"  {path.name}: {size / 1024 / 1024:.1f} MB")
            else:
                print(f"  {path.name}: {size / 1024:.1f} KB")


if __name__ == '__main__':
    main()
