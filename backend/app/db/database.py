"""
SynapseEdge Backend — Database Connection

Async SQLAlchemy engine configuration for Cloud SQL with pgvector.

Architecture:
    FastAPI → AsyncSession → SQLAlchemy → asyncpg → PostgreSQL + pgvector

Key design decisions:
- Async-first: Uses asyncpg driver for non-blocking I/O
- Connection pooling: SQLAlchemy pool manages connection lifecycle
- Session dependency: FastAPI dependency injection provides per-request sessions
"""

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

settings = get_settings()

# ============================================================================
# Async Engine
# ============================================================================
# asyncpg driver provides non-blocking PostgreSQL access.
# Pool configuration tuned for Cloud Run container lifecycle:
# - pool_size=5: Conservative for serverless (container may be cold-started)
# - max_overflow=10: Allows bursting during ingestion spikes
# - pool_recycle=1800: Recycle connections every 30 min (Cloud SQL proxy compat)
# ============================================================================

engine = create_async_engine(
    settings.database_url,
    echo=False,          # Set True for SQL query logging during development
    pool_size=5,
    max_overflow=10,
    pool_recycle=1800,
    pool_pre_ping=True,  # Verify connection health before use
)

# Session factory — creates new AsyncSession instances
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ============================================================================
# Base Model
# ============================================================================

class Base(DeclarativeBase):
    """SQLAlchemy declarative base for all ORM models."""
    pass


# ============================================================================
# Dependency — Per-Request Session
# ============================================================================

async def get_db() -> AsyncSession:
    """
    FastAPI dependency that provides an async database session.
    
    Usage in routes:
    ```python
    @router.post("/example")
    async def example(db: AsyncSession = Depends(get_db)):
        result = await db.execute(select(Model))
        ...
    ```
    
    The session is automatically closed after the request completes,
    even if an exception occurs.
    """
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


# ============================================================================
# Initialization
# ============================================================================

async def init_db():
    """
    Initialize database tables.
    
    In production, use Alembic migrations instead of create_all().
    This is a convenience for rapid prototyping.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    """Gracefully close the database engine and connection pool."""
    await engine.dispose()
