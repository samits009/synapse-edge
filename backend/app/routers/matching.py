"""
SynapseEdge Backend — Matching Router

Endpoints for direct vector matching queries, independent of
the task ingestion flow. Used by the dashboard for ad-hoc matching.
"""

import logging
from uuid import UUID
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends, HTTPException, status

from app.db.database import get_db
from app.models.task import TaskMatchResult
from app.services.matching_service import get_matching_service
from app.services.embedding_service import get_embedding_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/matching", tags=["Matching"])


# ============================================================================
# POST /api/v1/matching/semantic-search — Free-text volunteer search
# ============================================================================

@router.post(
    "/semantic-search",
    response_model=list[TaskMatchResult],
    summary="Search volunteers by semantic text query"
)
async def semantic_search(
    query_text: str,
    limit: int = 10,
    threshold: float = 0.3,
    db: AsyncSession = Depends(get_db)
):
    """
    Perform a semantic search over volunteer bios using free-text input.

    This enables natural language searches like:
    - "someone who can fix water pumps and speaks Hindi"
    - "nurse with disaster zone experience"
    - "truck driver familiar with flood regions"

    The query text is embedded and compared against all volunteer
    bio embeddings using cosine similarity.
    """
    embedding_service = get_embedding_service()
    matching_service = get_matching_service()

    # Generate embedding for search query
    query_embedding = await embedding_service.generate_embedding(
        query_text,
        task_type="RETRIEVAL_QUERY"
    )

    # Search volunteers
    matches = await matching_service.find_matches(
        db,
        task_embedding=query_embedding,
        limit=limit,
        threshold=threshold,
    )

    logger.info(
        f"Semantic search for '{query_text[:50]}...' "
        f"returned {len(matches)} results"
    )
    return matches


# ============================================================================
# GET /api/v1/matching/task/{task_id}/rematch — Re-run matching
# ============================================================================

@router.post(
    "/task/{task_id}/rematch",
    response_model=list[TaskMatchResult],
    summary="Re-run matching for an existing task"
)
async def rematch_task(
    task_id: UUID,
    limit: int = 5,
    threshold: float = 0.3,
    db: AsyncSession = Depends(get_db)
):
    """
    Re-run the volunteer matching pipeline for an existing task.

    Useful when:
    - New volunteers have been added since the original match
    - Volunteer availability has changed
    - The dispatcher wants more match options
    """
    matching_service = get_matching_service()

    # Fetch task embedding
    query = text("""
        SELECT embedding, location_lat, location_lng
        FROM field_tasks
        WHERE id = :task_id AND embedding IS NOT NULL
    """)
    result = await db.execute(query, {"task_id": str(task_id)})
    row = result.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found or has no embedding"
        )

    task_location = None
    if row.location_lat and row.location_lng:
        task_location = (row.location_lat, row.location_lng)

    # Convert pgvector string back to list of floats
    embedding_str = str(row.embedding)
    task_embedding = [
        float(v) for v in embedding_str.strip("[]").split(",")
    ]

    # Find new matches
    matches = await matching_service.find_matches(
        db,
        task_embedding=task_embedding,
        limit=limit,
        threshold=threshold,
        task_location=task_location,
    )

    # Save matches
    if matches:
        await matching_service.save_matches(db, task_id, matches)

    return matches


# ============================================================================
# GET /api/v1/matching/stats — Matching statistics
# ============================================================================

@router.get(
    "/stats",
    summary="Get matching statistics"
)
async def get_matching_stats(
    db: AsyncSession = Depends(get_db)
):
    """
    Get overall statistics for the matching engine.
    Used by the dashboard for KPI visualization.
    """
    stats_query = text("""
        SELECT 
            (SELECT COUNT(*) FROM field_tasks) as total_tasks,
            (SELECT COUNT(*) FROM field_tasks WHERE status = 'unmatched') as unmatched_tasks,
            (SELECT COUNT(*) FROM field_tasks WHERE status = 'matched') as matched_tasks,
            (SELECT COUNT(*) FROM field_tasks WHERE status = 'dispatched') as dispatched_tasks,
            (SELECT COUNT(*) FROM field_tasks WHERE status = 'resolved') as resolved_tasks,
            (SELECT COUNT(*) FROM volunteers) as total_volunteers,
            (SELECT COUNT(*) FROM volunteers WHERE availability = true) as available_volunteers,
            (SELECT COUNT(*) FROM volunteers WHERE embedding IS NOT NULL) as embedded_volunteers,
            (SELECT COUNT(*) FROM task_matches) as total_matches,
            (SELECT AVG(similarity_score) FROM task_matches) as avg_similarity,
            (SELECT AVG(urgency) FROM field_tasks WHERE status = 'unmatched') as avg_unmatched_urgency
    """)

    result = await db.execute(stats_query)
    row = result.fetchone()

    return {
        "tasks": {
            "total": row.total_tasks,
            "unmatched": row.unmatched_tasks,
            "matched": row.matched_tasks,
            "dispatched": row.dispatched_tasks,
            "resolved": row.resolved_tasks,
        },
        "volunteers": {
            "total": row.total_volunteers,
            "available": row.available_volunteers,
            "embedded": row.embedded_volunteers,
        },
        "matching": {
            "total_matches": row.total_matches,
            "avg_similarity": round(float(row.avg_similarity or 0), 4),
            "avg_unmatched_urgency": round(float(row.avg_unmatched_urgency or 0), 1),
        }
    }
