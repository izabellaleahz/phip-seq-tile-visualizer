"""
PhIP-seq Visualizer Modal Backend (Simplified JSON Version)

This Modal app provides serverless API endpoints that read directly from JSON files
instead of using a database. Much simpler setup!
"""

import modal

# Create Modal app
app = modal.App("phipseq-visualizer-simple")

# Define container image with minimal dependencies
# Include the data directory in the image for simplicity
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi==0.104.1",
        "uvicorn==0.24.0",
    )
    .add_local_python_source("api")
    .add_local_python_source("services")
    # Add the data directory to the image at /data
    .add_local_dir(
        local_path="../public/data",
        remote_path="/data",
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
        version="2.0.0",
        description="Serverless API for PhIP-seq tile library visualization (JSON-based)",
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
            "version": "2.0.0 (JSON-based)",
            "data_source": "Static JSON files",
        }

    @web_app.get("/health")
    async def health():
        """Detailed health check"""
        import os
        from pathlib import Path

        data_dir = Path("/data")
        viruses_file = data_dir / "viruses.json"

        return {
            "status": "healthy",
            "data_source": "JSON files",
            "data_directory_exists": data_dir.exists(),
            "viruses_file_exists": viruses_file.exists(),
        }

    # Import and register simplified API routers
    from api import search_simple, data_simple

    web_app.include_router(search_simple.router, prefix="/api/search", tags=["search"])
    web_app.include_router(data_simple.router, prefix="/api/data", tags=["data"])

    return web_app
