"""
Upload data to Modal volume

This script uploads the public/data directory to the Modal volume.
Run with: modal run upload_data.py
"""

import modal
from pathlib import Path

app = modal.App("phipseq-data-upload")

# Reference the same volume
data_volume = modal.Volume.from_name(
    "phipseq-data",
    create_if_missing=True,
)

# Mount the local data directory
# This makes the local files available inside the Modal function
data_mount = modal.Mount.from_local_dir(
    local_path=Path(__file__).parent.parent / "public" / "data",
    remote_path="/source_data",
)


@app.function(
    volumes={"/data": data_volume},
    mounts=[data_mount],
    timeout=600,
)
def upload_files():
    """Copy files from mounted local directory to volume"""
    from pathlib import Path
    import shutil

    print("🔄 Copying data to Modal volume...")

    source_dir = Path("/source_data")
    dest_dir = Path("/data")

    if not source_dir.exists():
        print(f"❌ Source directory not found: {source_dir}")
        return {"status": "error", "message": "Source not found"}

    print(f"📂 Source: {source_dir}")
    print(f"📁 Destination: {dest_dir}")

    # Count files first
    source_files = list(source_dir.rglob("*.json"))
    print(f"   Found {len(source_files)} JSON files to copy")

    # Copy all files
    copied = 0
    for src_file in source_files:
        # Compute relative path
        rel_path = src_file.relative_to(source_dir)
        dst_file = dest_dir / rel_path

        # Create parent directory
        dst_file.parent.mkdir(parents=True, exist_ok=True)

        # Copy file
        shutil.copy2(src_file, dst_file)
        copied += 1

        if copied % 500 == 0:
            print(f"   Copied {copied}/{len(source_files)} files...")

    # Commit the volume to persist changes
    data_volume.commit()

    print(f"✅ Successfully copied {copied} files")
    return {"status": "success", "files_copied": copied}


@app.local_entrypoint()
def main():
    """Main entry point"""
    print("🚀 Starting data upload to Modal volume...")

    result = upload_files.remote()

    print(f"\n✅ Upload complete!")
    print(f"   Status: {result['status']}")
    if result.get("files_copied"):
        print(f"   Files: {result['files_copied']}")
