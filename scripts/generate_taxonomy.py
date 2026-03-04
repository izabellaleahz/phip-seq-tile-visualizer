#!/usr/bin/env python3
"""
Generate taxonomy data for the PhIP-seq Tile Visualizer.
Fetches taxonomy information from NCBI and creates viral_tree.json with hierarchy.
"""

import json
import time
from pathlib import Path
from collections import defaultdict
from Bio import Entrez

# Configure Entrez
Entrez.email = "phipseq@example.com"

DATA_DIR = Path(__file__).parent / "public" / "data"

# Baltimore classification based on genome type - includes both orders and families
BALTIMORE_CLASSIFICATION = {
    # Group I: dsDNA viruses
    "Herpesvirales": {"baltimore": "I", "genome": "dsDNA", "color": "#e74c3c"},
    "Chitovirales": {"baltimore": "I", "genome": "dsDNA", "color": "#e74c3c"},  # Poxviridae
    "Rowavirales": {"baltimore": "I", "genome": "dsDNA", "color": "#e74c3c"},   # Adenoviridae
    "Zurhausenvirales": {"baltimore": "I", "genome": "dsDNA", "color": "#e74c3c"},  # Papillomaviridae
    "Sepolyvirales": {"baltimore": "I", "genome": "dsDNA", "color": "#e74c3c"},  # Polyomaviridae
    "Orthoherpesviridae": {"baltimore": "I", "genome": "dsDNA", "color": "#e74c3c"},
    "Herpesviridae": {"baltimore": "I", "genome": "dsDNA", "color": "#e74c3c"},
    "Poxviridae": {"baltimore": "I", "genome": "dsDNA", "color": "#e74c3c"},
    "Adenoviridae": {"baltimore": "I", "genome": "dsDNA", "color": "#e74c3c"},
    "Papillomaviridae": {"baltimore": "I", "genome": "dsDNA", "color": "#e74c3c"},
    "Polyomaviridae": {"baltimore": "I", "genome": "dsDNA", "color": "#e74c3c"},

    # Group II: ssDNA viruses
    "Piccovirales": {"baltimore": "II", "genome": "ssDNA", "color": "#e67e22"},  # Parvoviridae
    "Cirlivirales": {"baltimore": "II", "genome": "ssDNA", "color": "#e67e22"},  # Anelloviridae
    "Parvoviridae": {"baltimore": "II", "genome": "ssDNA", "color": "#e67e22"},
    "Anelloviridae": {"baltimore": "II", "genome": "ssDNA", "color": "#e67e22"},

    # Group III: dsRNA viruses
    "Reovirales": {"baltimore": "III", "genome": "dsRNA", "color": "#f1c40f"},
    "Durnavirales": {"baltimore": "III", "genome": "dsRNA", "color": "#f1c40f"},  # Picobirnaviridae
    "Reoviridae": {"baltimore": "III", "genome": "dsRNA", "color": "#f1c40f"},
    "Picobirnaviridae": {"baltimore": "III", "genome": "dsRNA", "color": "#f1c40f"},
    "Sedoreoviridae": {"baltimore": "III", "genome": "dsRNA", "color": "#f1c40f"},
    "Spinareoviridae": {"baltimore": "III", "genome": "dsRNA", "color": "#f1c40f"},

    # Group IV: (+)ssRNA viruses
    "Picornavirales": {"baltimore": "IV", "genome": "(+)ssRNA", "color": "#2ecc71"},
    "Amarillovirales": {"baltimore": "IV", "genome": "(+)ssRNA", "color": "#2ecc71"},  # Flaviviridae
    "Martellivirales": {"baltimore": "IV", "genome": "(+)ssRNA", "color": "#2ecc71"},  # Togaviridae
    "Nidovirales": {"baltimore": "IV", "genome": "(+)ssRNA", "color": "#2ecc71"},  # Coronaviridae
    "Stellavirales": {"baltimore": "IV", "genome": "(+)ssRNA", "color": "#2ecc71"},  # Astroviridae
    "Hepelivirales": {"baltimore": "IV", "genome": "(+)ssRNA", "color": "#2ecc71"},  # Hepeviridae
    "Picornaviridae": {"baltimore": "IV", "genome": "(+)ssRNA", "color": "#2ecc71"},
    "Flaviviridae": {"baltimore": "IV", "genome": "(+)ssRNA", "color": "#2ecc71"},
    "Togaviridae": {"baltimore": "IV", "genome": "(+)ssRNA", "color": "#2ecc71"},
    "Coronaviridae": {"baltimore": "IV", "genome": "(+)ssRNA", "color": "#2ecc71"},
    "Caliciviridae": {"baltimore": "IV", "genome": "(+)ssRNA", "color": "#2ecc71"},
    "Astroviridae": {"baltimore": "IV", "genome": "(+)ssRNA", "color": "#2ecc71"},
    "Hepeviridae": {"baltimore": "IV", "genome": "(+)ssRNA", "color": "#2ecc71"},
    "Matonaviridae": {"baltimore": "IV", "genome": "(+)ssRNA", "color": "#2ecc71"},

    # Group V: (-)ssRNA viruses
    "Articulavirales": {"baltimore": "V", "genome": "(-)ssRNA", "color": "#3498db"},  # Orthomyxoviridae
    "Mononegavirales": {"baltimore": "V", "genome": "(-)ssRNA", "color": "#3498db"},  # Paramyxoviridae, Rhabdoviridae, Filoviridae, Pneumoviridae
    "Elliovirales": {"baltimore": "V", "genome": "(-)ssRNA", "color": "#3498db"},  # Arenaviridae
    "Hareavirales": {"baltimore": "V", "genome": "(-)ssRNA", "color": "#3498db"},  # Bunyavirales families
    "Bunyavirales": {"baltimore": "V", "genome": "(-)ssRNA", "color": "#3498db"},
    "Orthomyxoviridae": {"baltimore": "V", "genome": "(-)ssRNA", "color": "#3498db"},
    "Paramyxoviridae": {"baltimore": "V", "genome": "(-)ssRNA", "color": "#3498db"},
    "Rhabdoviridae": {"baltimore": "V", "genome": "(-)ssRNA", "color": "#3498db"},
    "Filoviridae": {"baltimore": "V", "genome": "(-)ssRNA", "color": "#3498db"},
    "Arenaviridae": {"baltimore": "V", "genome": "(-)ssRNA", "color": "#3498db"},
    "Hantaviridae": {"baltimore": "V", "genome": "(-)ssRNA", "color": "#3498db"},
    "Nairoviridae": {"baltimore": "V", "genome": "(-)ssRNA", "color": "#3498db"},
    "Peribunyaviridae": {"baltimore": "V", "genome": "(-)ssRNA", "color": "#3498db"},
    "Phenuiviridae": {"baltimore": "V", "genome": "(-)ssRNA", "color": "#3498db"},
    "Pneumoviridae": {"baltimore": "V", "genome": "(-)ssRNA", "color": "#3498db"},

    # Group VI: ssRNA-RT (Retroviruses)
    "Ortervirales": {"baltimore": "VI", "genome": "ssRNA-RT", "color": "#9b59b6"},  # Retroviridae
    "Retroviridae": {"baltimore": "VI", "genome": "ssRNA-RT", "color": "#9b59b6"},

    # Group VII: dsDNA-RT
    "Blubervirales": {"baltimore": "VII", "genome": "dsDNA-RT", "color": "#1abc9c"},  # Hepadnaviridae
    "Hepadnaviridae": {"baltimore": "VII", "genome": "dsDNA-RT", "color": "#1abc9c"},

    # Satellites / Other
    "Kolmioviridae": {"baltimore": "satellite", "genome": "ssRNA(-)", "color": "#95a5a6"},  # HDV-like

    # Additional orders found
    "Geplafuvirales": {"baltimore": "II", "genome": "ssDNA", "color": "#e67e22"},  # Genomoviridae
    "Recrevirales": {"baltimore": "II", "genome": "ssDNA", "color": "#e67e22"},  # Redondoviridae
    "Cremevirales": {"baltimore": "IV", "genome": "(+)ssRNA", "color": "#2ecc71"},  # Caliciviridae family
    "Sanitavirales": {"baltimore": "V", "genome": "(-)ssRNA", "color": "#3498db"},  # Peribunyaviridae
    "Lineavirales": {"baltimore": "IV", "genome": "(+)ssRNA", "color": "#2ecc71"},  # positive-sense RNA
    "Ringavirales": {"baltimore": "V", "genome": "(-)ssRNA", "color": "#3498db"},  # Tulasvirales
}

def get_all_taxon_ids():
    """Extract all unique taxon IDs from viruses.json."""
    with open(DATA_DIR / "viruses.json") as f:
        viruses = json.load(f)

    taxon_ids = set()
    for virus in viruses:
        for tid in virus.get("taxonIds", []):
            taxon_ids.add(tid)

    return list(taxon_ids)

def fetch_taxonomy_batch(taxon_ids, batch_size=200):
    """Fetch taxonomy data from NCBI in batches."""
    taxonomy_data = {}

    for i in range(0, len(taxon_ids), batch_size):
        batch = taxon_ids[i:i+batch_size]
        print(f"  Fetching batch {i//batch_size + 1}/{(len(taxon_ids)-1)//batch_size + 1}...")

        try:
            handle = Entrez.efetch(db="taxonomy", id=batch, retmode="xml")
            records = Entrez.read(handle)
            handle.close()

            for record in records:
                taxid = record["TaxId"]
                lineage = record.get("Lineage", "")

                # Extract family from lineage
                family = "Unknown"
                lineage_parts = lineage.split("; ")
                for part in lineage_parts:
                    if part.endswith("viridae") or part.endswith("virales"):
                        family = part
                        break

                taxonomy_data[taxid] = {
                    "name": record.get("ScientificName", ""),
                    "lineage": lineage,
                    "rank": record.get("Rank", ""),
                    "family": family,
                    "division": record.get("Division", ""),
                }

            time.sleep(0.4)  # Rate limiting

        except Exception as e:
            print(f"    Error fetching batch: {e}")
            time.sleep(2)

    return taxonomy_data

def build_viral_tree(viruses, taxonomy_data):
    """Build hierarchical tree structure grouped by family."""
    # Group viruses by family
    families = defaultdict(lambda: {"viruses": [], "baltimore": None, "genome": None, "color": "#6c757d"})

    for virus in viruses:
        # Get family from first taxon ID
        family = "Unclassified"
        for tid in virus.get("taxonIds", []):
            if tid in taxonomy_data:
                family = taxonomy_data[tid].get("family", "Unclassified")
                if family != "Unknown":
                    break

        families[family]["viruses"].append({
            "id": virus["id"],
            "name": virus["name"],
            "proteins": virus["proteinCount"],
            "tiles": virus["tileCount"],
            "taxonIds": virus.get("taxonIds", [])
        })

        # Add Baltimore classification info
        if family in BALTIMORE_CLASSIFICATION:
            info = BALTIMORE_CLASSIFICATION[family]
            families[family]["baltimore"] = info["baltimore"]
            families[family]["genome"] = info["genome"]
            families[family]["color"] = info["color"]

    # Sort viruses within each family by tile count
    for family_data in families.values():
        family_data["viruses"].sort(key=lambda v: v["tiles"], reverse=True)

    # Calculate summary statistics
    total_families = len(families)
    total_viruses = sum(len(f["viruses"]) for f in families.values())
    total_tiles = sum(sum(v["tiles"] for v in f["viruses"]) for f in families.values())

    # Group families by Baltimore classification
    by_baltimore = defaultdict(list)
    for family_name, family_data in families.items():
        baltimore = family_data.get("baltimore") or "Unclassified"
        by_baltimore[baltimore].append(family_name)

    return {
        "families": dict(families),
        "by_baltimore": dict(by_baltimore),
        "summary": {
            "total_families": total_families,
            "total_viruses": total_viruses,
            "total_tiles": total_tiles,
        },
        "baltimore_info": {
            "I": {"name": "dsDNA viruses", "description": "Double-stranded DNA"},
            "II": {"name": "ssDNA viruses", "description": "Single-stranded DNA"},
            "III": {"name": "dsRNA viruses", "description": "Double-stranded RNA"},
            "IV": {"name": "(+)ssRNA viruses", "description": "Positive-sense single-stranded RNA"},
            "V": {"name": "(-)ssRNA viruses", "description": "Negative-sense single-stranded RNA"},
            "VI": {"name": "ssRNA-RT viruses", "description": "Single-stranded RNA with reverse transcription"},
            "VII": {"name": "dsDNA-RT viruses", "description": "Double-stranded DNA with reverse transcription"},
        }
    }

def main():
    print("Loading viruses.json...")
    with open(DATA_DIR / "viruses.json") as f:
        viruses = json.load(f)
    print(f"  Found {len(viruses)} viruses")

    print("\nExtracting taxon IDs...")
    taxon_ids = get_all_taxon_ids()
    print(f"  Found {len(taxon_ids)} unique taxon IDs")

    print("\nFetching taxonomy from NCBI...")
    taxonomy_data = fetch_taxonomy_batch(taxon_ids)
    print(f"  Retrieved taxonomy for {len(taxonomy_data)} taxon IDs")

    # Save taxonomy data
    print("\nSaving taxonomy.json...")
    with open(DATA_DIR / "taxonomy.json", "w") as f:
        json.dump(taxonomy_data, f, indent=2)

    print("\nBuilding viral tree...")
    tree = build_viral_tree(viruses, taxonomy_data)

    # Save viral tree
    print("Saving viral_tree.json...")
    with open(DATA_DIR / "viral_tree.json", "w") as f:
        json.dump(tree, f, indent=2)

    print("\nDone!")
    print(f"  Families: {tree['summary']['total_families']}")
    print(f"  Viruses: {tree['summary']['total_viruses']}")
    print(f"  Total tiles: {tree['summary']['total_tiles']:,}")

    # Print Baltimore classification breakdown
    print("\nBaltimore classification breakdown:")
    for baltimore, families in sorted(tree["by_baltimore"].items()):
        info = tree["baltimore_info"].get(baltimore, {"name": baltimore})
        print(f"  Group {baltimore} ({info['name']}): {len(families)} families")

if __name__ == "__main__":
    main()
