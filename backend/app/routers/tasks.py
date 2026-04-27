"""
══════════════════════════════════════════════════════════════════════════════
SynapseEdge Backend — Task Ingestion Router (PILLAR 3 API)
══════════════════════════════════════════════════════════════════════════════

REST API endpoints for ingesting field tasks from Android devices
(via Firebase sync) and triggering the vector matching pipeline.

Primary flow:
    POST /api/v1/tasks/ingest
        → Validate incoming task JSON
        → Store task in Cloud SQL
        → Generate Vertex AI embedding
        → Query pgvector for top-K volunteer matches
        → Return matches to caller
"""

import logging
from uuid import UUID
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends, HTTPException, status

from app.db.database import get_db
from app.models.task import (
    TaskIngestRequest,
    TaskIngestResponse,
    TaskResponse,
    TaskMatchResult,
    TaskUpdateRequest,
)
from app.services.matching_service import get_matching_service
from app.services.embedding_service import get_embedding_service
from app.services.dispatch_service import get_dispatch_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/tasks", tags=["Tasks"])


# ============================================================================
# POST /api/v1/tasks/ingest — Core Ingestion Endpoint
# ============================================================================

@router.post(
    "/ingest",
    response_model=TaskIngestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest a field task and find volunteer matches",
    description="""
    Accept a structured task JSON from the Android app (post-AI extraction)
    and run the full vector matching pipeline:
    
    1. Store the task in Cloud SQL
    2. Generate a Vertex AI embedding from the task description
    3. Query pgvector to find semantically matching volunteers
    4. Return the top-K matches with similarity scores
    """
)
async def ingest_task(
    request: TaskIngestRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Ingest a field task and find the best volunteer matches.

    This is the main entry point for field data flowing from the edge
    (Android → Firebase → this endpoint). The matching pipeline runs
    synchronously, returning matches in the same response.

    For high-urgency tasks (4-5), the response should trigger
    push notifications to matched volunteers (future enhancement).
    """
    logger.info(
        f"━━━ Ingesting task {request.id} ━━━\n"
        f"  Intent: {request.intent}\n"
        f"  Urgency: {request.urgency}/5\n"
        f"  Skills: {request.skills_needed}\n"
        f"  Sync hops: {request.sync_hops}"
    )

    matching_service = get_matching_service()
    embedding_service = get_embedding_service()

    try:
        # ── Step 1: Store task in Cloud SQL ───────────────────────────────
        now = datetime.utcnow()
        insert_query = text("""
            INSERT INTO field_tasks (
                id, raw_text, intent, urgency, skills_needed,
                description, location_lat, location_lng,
                source_device_id, sync_hops, status, created_at
            ) VALUES (
                :id, :raw_text, :intent, :urgency, :skills_needed,
                :description, :location_lat, :location_lng,
                :source_device_id, :sync_hops, 'unmatched', :created_at
            )
            ON CONFLICT (id) DO UPDATE SET
                intent = EXCLUDED.intent,
                urgency = EXCLUDED.urgency,
                skills_needed = EXCLUDED.skills_needed,
                description = EXCLUDED.description,
                status = 'unmatched'
        """)

        await db.execute(insert_query, {
            "id": str(request.id),
            "raw_text": request.raw_text,
            "intent": request.intent,
            "urgency": request.urgency,
            "skills_needed": request.skills_needed,
            "description": request.description,
            "location_lat": request.location_lat,
            "location_lng": request.location_lng,
            "source_device_id": request.source_device_id,
            "sync_hops": request.sync_hops,
            "created_at": now,
        })
        await db.commit()
        logger.info(f"✓ Task {request.id} stored in database")

        # ── Step 2: Generate embedding ────────────────────────────────────
        # Use the AI-generated description for embedding (richer semantics)
        # Fall back to raw_text if description is empty
        embed_text = request.description or request.raw_text
        task_embedding = await matching_service.embed_and_store_task(
            db, request.id, embed_text
        )
        logger.info(f"✓ Embedding generated ({len(task_embedding)} dimensions)")

        # ── Step 3: Find volunteer matches ────────────────────────────────
        task_location = None
        if request.location_lat and request.location_lng:
            task_location = (request.location_lat, request.location_lng)

        matches = await matching_service.find_matches(
            db,
            task_embedding=task_embedding,
            limit=5,
            threshold=0.3,
            task_location=task_location,
        )
        logger.info(f"✓ Found {len(matches)} volunteer matches")

        # ── Step 4: Persist matches & Telegram dispatch ─────────────────
        if matches:
            await matching_service.save_matches(db, request.id, matches)

            update_query = text("""
                UPDATE field_tasks 
                SET status = 'dispatched', matched_at = NOW()
                WHERE id = :task_id
            """)
            await db.execute(update_query, {"task_id": str(request.id)})
            await db.commit()

            # Dispatch top match via Telegram
            top = matches[0]
            dispatch_svc = get_dispatch_service()
            await dispatch_svc.dispatch_to_volunteer(
                task_id=request.id,
                task_intent=request.intent,
                task_description=request.description or request.raw_text,
                urgency=request.urgency,
                skills_needed=request.skills_needed,
                volunteer_name=top.volunteer_name,
                volunteer_id=top.volunteer_id,
                similarity_score=top.similarity_score,
                telegram_chat_id=None,  # populated from DB in production
            )

        # ── Build response ────────────────────────────────────────────────
        task_response = TaskResponse(
            id=request.id,
            raw_text=request.raw_text,
            intent=request.intent,
            urgency=request.urgency,
            skills_needed=request.skills_needed,
            description=request.description,
            location_lat=request.location_lat,
            location_lng=request.location_lng,
            source_device_id=request.source_device_id,
            sync_hops=request.sync_hops,
            status="matched" if matches else "unmatched",
            has_embedding=True,
            created_at=now,
            matched_at=datetime.utcnow() if matches else None,
        )

        return TaskIngestResponse(
            task=task_response,
            matches=matches,
            message=f"Task ingested. Found {len(matches)} volunteer matches."
        )

    except Exception as e:
        logger.error(f"✗ Task ingestion failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Task ingestion failed: {str(e)}"
        )


# ============================================================================
# GET /api/v1/tasks — List all tasks
# ============================================================================

@router.get(
    "/",
    response_model=list[TaskResponse],
    summary="List all field tasks"
)
async def list_tasks(
    status_filter: str | None = None,
    urgency_min: int | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """List all field tasks with optional filtering."""
    conditions = ["1=1"]
    params = {"limit": limit}

    if status_filter:
        conditions.append("status = :status")
        params["status"] = status_filter

    if urgency_min:
        conditions.append("urgency >= :urgency_min")
        params["urgency_min"] = urgency_min

    where_clause = " AND ".join(conditions)

    query = text(f"""
        SELECT id, raw_text, intent, urgency, skills_needed, description,
               location_lat, location_lng, source_device_id, sync_hops,
               status, embedding IS NOT NULL as has_embedding,
               created_at, matched_at
        FROM field_tasks
        WHERE {where_clause}
        ORDER BY urgency DESC, created_at DESC
        LIMIT :limit
    """)

    result = await db.execute(query, params)
    rows = result.fetchall()

    return [
        TaskResponse(
            id=row.id,
            raw_text=row.raw_text,
            intent=row.intent,
            urgency=row.urgency,
            skills_needed=row.skills_needed or [],
            description=row.description,
            location_lat=row.location_lat,
            location_lng=row.location_lng,
            source_device_id=row.source_device_id,
            sync_hops=row.sync_hops,
            status=row.status,
            has_embedding=row.has_embedding,
            created_at=row.created_at,
            matched_at=row.matched_at,
        )
        for row in rows
    ]


# ============================================================================
# GET /api/v1/tasks/{task_id} — Get single task with matches
# ============================================================================

@router.get(
    "/{task_id}",
    response_model=TaskIngestResponse,
    summary="Get a task with its matches"
)
async def get_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Retrieve a single task with its volunteer match results."""
    # Fetch task
    task_query = text("""
        SELECT id, raw_text, intent, urgency, skills_needed, description,
               location_lat, location_lng, source_device_id, sync_hops,
               status, embedding IS NOT NULL as has_embedding,
               created_at, matched_at
        FROM field_tasks
        WHERE id = :task_id
    """)
    result = await db.execute(task_query, {"task_id": str(task_id)})
    row = result.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found"
        )

    task_response = TaskResponse(
        id=row.id,
        raw_text=row.raw_text,
        intent=row.intent,
        urgency=row.urgency,
        skills_needed=row.skills_needed or [],
        description=row.description,
        location_lat=row.location_lat,
        location_lng=row.location_lng,
        source_device_id=row.source_device_id,
        sync_hops=row.sync_hops,
        status=row.status,
        has_embedding=row.has_embedding,
        created_at=row.created_at,
        matched_at=row.matched_at,
    )

    # Fetch matches
    matches_query = text("""
        SELECT tm.volunteer_id, tm.similarity_score,
               v.name, v.bio, v.skills_raw
        FROM task_matches tm
        JOIN volunteers v ON tm.volunteer_id = v.id
        WHERE tm.task_id = :task_id
        ORDER BY tm.similarity_score DESC
    """)
    match_result = await db.execute(matches_query, {"task_id": str(task_id)})
    match_rows = match_result.fetchall()

    matches = [
        TaskMatchResult(
            volunteer_id=mr.volunteer_id,
            volunteer_name=mr.name,
            volunteer_bio=mr.bio,
            volunteer_skills=mr.skills_raw or [],
            similarity_score=mr.similarity_score,
        )
        for mr in match_rows
    ]

    return TaskIngestResponse(
        task=task_response,
        matches=matches,
        message=f"Task retrieved with {len(matches)} matches"
    )


# ============================================================================
# PATCH /api/v1/tasks/{task_id}/status — Update task status
# ============================================================================

@router.patch(
    "/{task_id}/status",
    summary="Update task status"
)
async def update_task_status(
    task_id: UUID,
    request: TaskUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Update the lifecycle status of a task (matched → dispatched → resolved)."""
    valid_statuses = {"unmatched", "matched", "dispatched", "resolved", "failed"}
    if request.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {valid_statuses}"
        )

    query = text("""
        UPDATE field_tasks SET status = :status WHERE id = :task_id
    """)
    await db.execute(query, {
        "task_id": str(task_id),
        "status": request.status,
    })
    await db.commit()

    return {"message": f"Task {task_id} status updated to '{request.status}'"}
