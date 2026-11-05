"""
Database connection and session management

Handles PostgreSQL connections via SQLAlchemy with async support.
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, AsyncEngine
from sqlalchemy.orm import sessionmaker
from contextlib import asynccontextmanager
import os

# Lazy initialization - engine created on first use
_engine: AsyncEngine | None = None
_session_factory = None


def get_engine() -> AsyncEngine:
    """Get or create the async database engine"""
    global _engine
    if _engine is None:
        # Get database URL from environment (Modal secrets are exposed as env vars)
        database_url = os.environ.get(
            "POSTGRES_URL",
            "postgresql+asyncpg://postgres:password@localhost/phipseq"  # Fallback for local dev
        )

        # Ensure we're using asyncpg driver
        if database_url.startswith("postgresql://"):
            database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif not database_url.startswith("postgresql+asyncpg://"):
            # If it doesn't start with postgresql at all, something is wrong
            raise ValueError(f"Invalid PostgreSQL URL format: {database_url[:30]}...")

        # Create async engine
        _engine = create_async_engine(
            database_url,
            echo=False,  # Set to True for SQL query logging
            pool_size=20,
            max_overflow=10,
        )
    return _engine


def get_session_factory():
    """Get or create the async session factory"""
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(
            get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _session_factory


@asynccontextmanager
async def get_db():
    """
    Async context manager for database sessions.

    Usage:
        async with get_db() as db:
            result = await db.execute(query)
    """
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Initialize database tables"""
    from models.database import Base

    engine = get_engine()
    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
