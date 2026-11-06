"""
PhIP-seq Visualizer Modal Backend (SQLite Version)

This Modal app provides serverless API endpoints using SQLite for fast queries.
No external database needed - SQLite database embedded in container!
"""

import modal

# Create Modal app
app = modal.App("phipseq-visualizer-sqlite")

# Define container image with SQLite database
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi==0.104.1",
        "uvicorn==0.24.0",
    )
    .add_local_python_source("api")
    .add_local_python_source("services")
    # Add the SQLite database to the image
    .add_local_file(
        local_path="phipseq.db",
        remote_path="/phipseq.db",
    )
)


# Mount FastAPI app to Modal
@app.function(
    image=image,
    timeout=300,  # 5 minutes
)
@modal.asgi_app()
def serve():
    """Serve the FastAPI application"""
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    # Create FastAPI app inside the function
    web_app = FastAPI(
        title="PhIP-seq Visualizer API",
        version="3.0.0",
        description="Serverless API for PhIP-seq tile library visualization (SQLite-based)",
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

    # Include API routers
    from api import search_sqlite, data_sqlite
    web_app.include_router(search_sqlite.router, prefix="/api/search", tags=["search"])
    web_app.include_router(data_sqlite.router, prefix="/api/data", tags=["data"])

    # Health check endpoint
    @web_app.get("/health")
    async def health_check():
        """Health check endpoint"""
        from pathlib import Path
        db_path = Path("/phipseq.db")
        db_exists = db_path.exists()
        db_size_mb = db_path.stat().st_size / (1024 * 1024) if db_exists else 0

        return {
            "status": "healthy",
            "data_source": "SQLite database",
            "database_exists": db_exists,
            "database_size_mb": round(db_size_mb, 1),
        }

    return web_app
