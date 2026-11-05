"""
Initialize database tables on Supabase

Run this BEFORE running the migration script to create all tables.
"""

import modal
from pathlib import Path

# Import the Modal app
app = modal.App.lookup("phipseq-visualizer", create_if_missing=False)


@app.function()
async def create_tables():
    """Create all database tables"""
    from services.database import init_db

    print("Creating database tables...")
    await init_db()
    print("✓ Tables created successfully!")


@app.local_entrypoint()
def main():
    """Run database initialization"""
    create_tables.remote()


if __name__ == "__main__":
    main()
