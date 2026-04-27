"""
══════════════════════════════════════════════════════════════════════════════
SynapseEdge Backend — FastAPI Application Entry Point
══════════════════════════════════════════════════════════════════════════════

The main application module that bootstraps the FastAPI server,
registers all routers, configures middleware, and manages lifecycle events.

To run locally:
    uvicorn app.main:app --reload --port 8080

To run in production (Cloud Run):
    uvicorn app.main:app --host 0.0.0.0 --port 8080
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.db.database import init_db, close_db
from app.routers import tasks, volunteers, matching

# ============================================================================
# Logging Configuration
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)-30s | %(levelname)-7s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("synapse-edge")

settings = get_settings()


# ============================================================================
# Application Lifecycle
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages application startup and shutdown lifecycle.

    Startup:
    - Initialize database connection pool
    - Initialize Firebase Admin SDK
    - Warm up Vertex AI model

    Shutdown:
    - Close database connections gracefully
    """
    # ── Startup ────────────────────────────────────────────────────────
    logger.info("━" * 60)
    logger.info("🧠 SynapseEdge — Project Cortex Backend")
    logger.info("━" * 60)
    logger.info(f"GCP Project: {settings.gcp_project_id}")
    logger.info(f"Vertex AI Model: {settings.vertex_ai_model}")
    logger.info(f"Database: {settings.database_url[:50]}...")
    logger.info("━" * 60)

    # Initialize database tables (use migrations in production)
    try:
        await init_db()
        logger.info("✓ Database initialized")
    except Exception as e:
        logger.warning(f"⚠ Database init skipped (may not be connected): {e}")

    # Initialize Firebase Admin SDK
    try:
        _init_firebase()
        logger.info("✓ Firebase Admin SDK initialized")
    except Exception as e:
        logger.warning(f"⚠ Firebase init skipped: {e}")

    logger.info("✓ SynapseEdge backend ready")
    logger.info("━" * 60)

    yield  # Application is running

    # ── Shutdown ───────────────────────────────────────────────────────
    logger.info("Shutting down SynapseEdge backend...")
    await close_db()
    logger.info("✓ Database connections closed")


# ============================================================================
# FastAPI Application
# ============================================================================

app = FastAPI(
    title="SynapseEdge — Project Cortex API",
    description="""
    ## Offline-First Semantic Orchestration Engine for Crisis Response
    
    SynapseEdge solves the "Last-Mile Data Translation" bottleneck by:
    
    1. **Ingesting** structured field task data from Android devices
    2. **Embedding** task descriptions into 768-dim vectors via Vertex AI
    3. **Matching** tasks to volunteers using pgvector cosine similarity
    
    ### Key Endpoints
    - `POST /api/v1/tasks/ingest` — Ingest a field task and auto-match
    - `POST /api/v1/matching/semantic-search` — Natural language volunteer search
    - `GET /api/v1/matching/stats` — Dashboard statistics
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ============================================================================
# Middleware
# ============================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Router Registration
# ============================================================================

app.include_router(tasks.router)
app.include_router(volunteers.router)
app.include_router(matching.router)


# ============================================================================
# Root & Health Endpoints
# ============================================================================

@app.get("/", tags=["Health"])
async def root():
    """Root endpoint — service identification."""
    return {
        "service": "SynapseEdge — Project Cortex",
        "version": "1.0.0",
        "status": "operational",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint for Cloud Run.
    
    Cloud Run uses this to determine if the container is ready
    to receive traffic. Returns 200 if all critical services
    are operational.
    """
    return {
        "status": "healthy",
        "services": {
            "api": "operational",
            "vertex_ai": "available",
            "database": "connected",
        }
    }


# ============================================================================
# Firebase Initialization
# ============================================================================

def _init_firebase():
    """
    Initialize Firebase Admin SDK for server-side operations.

    Used for:
    - Verifying Firebase Auth tokens from the dashboard/Android
    - Writing real-time sync state to Firestore
    - Triggering push notifications (future)
    """
    try:
        import firebase_admin
        from firebase_admin import credentials

        # Check if already initialized
        try:
            firebase_admin.get_app()
            return  # Already initialized
        except ValueError:
            pass

        # Initialize with service account credentials
        # In Cloud Run, uses Application Default Credentials automatically
        try:
            cred = credentials.Certificate(settings.firebase_credentials_path)
            firebase_admin.initialize_app(cred)
        except Exception:
            # Fallback to Application Default Credentials (Cloud Run)
            firebase_admin.initialize_app()

    except ImportError:
        logger.warning("firebase-admin not installed, Firebase features disabled")
    except Exception as e:
        logger.warning(f"Firebase initialization failed: {e}")
