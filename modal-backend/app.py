"""
PhIP-seq Visualizer Modal Backend

This Modal app provides serverless API endpoints for the PhIP-seq visualizer,
replacing static JSON files and client-side SQLite with fast server-side queries.
"""

import modal
import os

# Create Modal app
app = modal.App("phipseq-visualizer")

# Define container image with all dependencies
# Mount the entire backend directory for access to api/, models/, services/
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install_from_requirements("requirements.txt")
    .add_local_python_source("api")
    .add_local_python_source("models")
    .add_local_python_source("services")
)


# Mount FastAPI app to Modal
@app.function(
    image=image,
    secrets=[modal.Secret.from_name("postgres-url")],
)
@modal.asgi_app()
def serve():
    """Serve the FastAPI application"""
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    # Create FastAPI app inside the function
    web_app = FastAPI(
        title="PhIP-seq Visualizer API",
        version="1.0.0",
        description="Serverless API for PhIP-seq tile library visualization",
    )

    # Configure CORS for GitHub Pages + local development
    web_app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "https://izabellaleahz.github.io",
            "http://localhost:5173",
            "http://localhost:3000",
        ],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    @web_app.get("/")
    async def root():
        """Health check endpoint"""
        return {
            "status": "ok",
            "service": "PhIP-seq Visualizer API",
            "version": "1.0.0",
        }

    @web_app.get("/health")
    async def health():
        """Detailed health check"""
        return {
            "status": "healthy",
            "database": os.environ.get("POSTGRES_URL", "not configured")[:20] + "...",
            "cache": "in-memory",
        }

    # Import and register API routers
    from api import search, data

    web_app.include_router(search.router, prefix="/api/search", tags=["search"])
    web_app.include_router(data.router, prefix="/api/data", tags=["data"])

    return web_app


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("postgres-url")],
)
async def init_database():
    """Initialize database tables on Supabase"""
    import os
    from services.database import init_db

    # Debug: Check database URL (mask password)
    db_url = os.environ.get("POSTGRES_URL", "NOT SET")
    if "@" in db_url:
        # Show protocol and host info only
        protocol = db_url.split("://")[0] if "://" in db_url else "unknown"
        host_part = db_url.split("@")[1] if "@" in db_url else "unknown"
        print(f"Database connection: {protocol}://***@{host_part}")
    else:
        print(f"Database URL format unexpected: {db_url[:20]}...")

    print("\nCreating database tables...")
    await init_db()
    print("✓ Tables created successfully!")
    print("  - viruses")
    print("  - proteins")
    print("  - tile_positions")
    print("  - search_fts")
    print("\nReady for data migration!")
