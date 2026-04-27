"""
SynapseEdge Backend — Volunteer Management Router

CRUD endpoints for volunteer profiles. When a volunteer is created or
their bio is updated, an embedding is automatically generated and stored
for semantic matching.
"""

import logging
from uuid import UUID
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends, HTTPException, status

from app.db.database import get_db
from app.models.volunteer import (
    VolunteerCreateRequest,
    VolunteerUpdateRequest,
    VolunteerResponse,
    VolunteerListResponse,
)
from app.services.matching_service import get_matching_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/volunteers", tags=["Volunteers"])


# ============================================================================
# POST /api/v1/volunteers — Create volunteer
# ============================================================================

@router.post(
    "/",
    response_model=VolunteerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new volunteer"
)
async def create_volunteer(
    request: VolunteerCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new volunteer and auto-generate their bio embedding.

    The volunteer's [bio] text is the primary source for latent skill
    detection. Upon creation, the bio is embedded into a 768-dim vector
    via Vertex AI and stored for semantic matching.
    """
    matching_service = get_matching_service()
    now = datetime.utcnow()

    try:
        # Insert volunteer record
        query = text("""
            INSERT INTO volunteers (
                name, email, phone, bio, skills_raw,
                location_lat, location_lng, availability, created_at, updated_at
            ) VALUES (
                :name, :email, :phone, :bio, :skills_raw,
                :location_lat, :location_lng, :availability, :created_at, :updated_at
            )
            RETURNING id
        """)

        result = await db.execute(query, {
            "name": request.name,
            "email": request.email,
            "phone": request.phone,
            "bio": request.bio,
            "skills_raw": request.skills_raw,
            "location_lat": request.location_lat,
            "location_lng": request.location_lng,
            "availability": request.availability,
            "created_at": now,
            "updated_at": now,
        })
        volunteer_id = result.fetchone()[0]
        await db.commit()

        logger.info(f"✓ Volunteer '{request.name}' created with ID {volunteer_id}")

        # Auto-generate bio embedding
        try:
            await matching_service.embed_and_store_volunteer(
                db, volunteer_id, request.bio
            )
            logger.info(f"✓ Embedding generated for volunteer {volunteer_id}")
        except Exception as e:
            logger.warning(
                f"⚠ Failed to generate embedding for volunteer {volunteer_id}: {e}"
            )

        return VolunteerResponse(
            id=volunteer_id,
            name=request.name,
            email=request.email,
            phone=request.phone,
            bio=request.bio,
            skills_raw=request.skills_raw,
            location_lat=request.location_lat,
            location_lng=request.location_lng,
            availability=request.availability,
            has_embedding=True,
            created_at=now,
            updated_at=now,
        )

    except Exception as e:
        if "unique" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Volunteer with email '{request.email}' already exists"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create volunteer: {str(e)}"
        )


# ============================================================================
# GET /api/v1/volunteers — List volunteers
# ============================================================================

@router.get(
    "/",
    response_model=VolunteerListResponse,
    summary="List all volunteers"
)
async def list_volunteers(
    available_only: bool = False,
    page: int = 1,
    per_page: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """List all registered volunteers with pagination."""
    offset = (page - 1) * per_page
    availability_filter = "WHERE availability = true" if available_only else ""

    # Count total
    count_query = text(f"SELECT COUNT(*) FROM volunteers {availability_filter}")
    count_result = await db.execute(count_query)
    total = count_result.scalar()

    # Fetch page
    query = text(f"""
        SELECT id, name, email, phone, bio, skills_raw,
               location_lat, location_lng, availability,
               embedding IS NOT NULL as has_embedding,
               created_at, updated_at
        FROM volunteers
        {availability_filter}
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """)

    result = await db.execute(query, {"limit": per_page, "offset": offset})
    rows = result.fetchall()

    volunteers = [
        VolunteerResponse(
            id=row.id,
            name=row.name,
            email=row.email,
            phone=row.phone,
            bio=row.bio,
            skills_raw=row.skills_raw or [],
            location_lat=row.location_lat,
            location_lng=row.location_lng,
            availability=row.availability,
            has_embedding=row.has_embedding,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
        for row in rows
    ]

    return VolunteerListResponse(
        volunteers=volunteers,
        total=total,
        page=page,
        per_page=per_page,
    )


# ============================================================================
# GET /api/v1/volunteers/{volunteer_id} — Get single volunteer
# ============================================================================

@router.get(
    "/{volunteer_id}",
    response_model=VolunteerResponse,
    summary="Get a volunteer by ID"
)
async def get_volunteer(
    volunteer_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Retrieve a single volunteer profile."""
    query = text("""
        SELECT id, name, email, phone, bio, skills_raw,
               location_lat, location_lng, availability,
               embedding IS NOT NULL as has_embedding,
               created_at, updated_at
        FROM volunteers
        WHERE id = :volunteer_id
    """)

    result = await db.execute(query, {"volunteer_id": str(volunteer_id)})
    row = result.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Volunteer {volunteer_id} not found"
        )

    return VolunteerResponse(
        id=row.id,
        name=row.name,
        email=row.email,
        phone=row.phone,
        bio=row.bio,
        skills_raw=row.skills_raw or [],
        location_lat=row.location_lat,
        location_lng=row.location_lng,
        availability=row.availability,
        has_embedding=row.has_embedding,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


# ============================================================================
# PATCH /api/v1/volunteers/{volunteer_id} — Update volunteer
# ============================================================================

@router.patch(
    "/{volunteer_id}",
    response_model=VolunteerResponse,
    summary="Update a volunteer's profile"
)
async def update_volunteer(
    volunteer_id: UUID,
    request: VolunteerUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Update volunteer profile fields. If the bio is updated,
    a new embedding is automatically generated.
    """
    matching_service = get_matching_service()

    # Build dynamic SET clause
    updates = []
    params = {"volunteer_id": str(volunteer_id)}

    if request.name is not None:
        updates.append("name = :name")
        params["name"] = request.name
    if request.phone is not None:
        updates.append("phone = :phone")
        params["phone"] = request.phone
    if request.bio is not None:
        updates.append("bio = :bio")
        params["bio"] = request.bio
    if request.skills_raw is not None:
        updates.append("skills_raw = :skills_raw")
        params["skills_raw"] = request.skills_raw
    if request.location_lat is not None:
        updates.append("location_lat = :location_lat")
        params["location_lat"] = request.location_lat
    if request.location_lng is not None:
        updates.append("location_lng = :location_lng")
        params["location_lng"] = request.location_lng
    if request.availability is not None:
        updates.append("availability = :availability")
        params["availability"] = request.availability

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )

    updates.append("updated_at = NOW()")
    set_clause = ", ".join(updates)

    query = text(f"UPDATE volunteers SET {set_clause} WHERE id = :volunteer_id")
    await db.execute(query, params)
    await db.commit()

    # Re-embed if bio was updated
    if request.bio is not None:
        try:
            await matching_service.embed_and_store_volunteer(
                db, volunteer_id, request.bio
            )
            logger.info(f"✓ Re-embedded volunteer {volunteer_id} bio")
        except Exception as e:
            logger.warning(f"⚠ Re-embedding failed for {volunteer_id}: {e}")

    # Return updated volunteer
    return await get_volunteer(volunteer_id, db)


# ============================================================================
# PATCH /api/v1/volunteers/{volunteer_id}/availability — Toggle availability
# ============================================================================

@router.patch(
    "/{volunteer_id}/availability",
    summary="Toggle volunteer availability"
)
async def toggle_availability(
    volunteer_id: UUID,
    available: bool,
    db: AsyncSession = Depends(get_db)
):
    """Toggle a volunteer's availability for dispatch."""
    query = text("""
        UPDATE volunteers 
        SET availability = :available, updated_at = NOW()
        WHERE id = :volunteer_id
    """)
    await db.execute(query, {
        "volunteer_id": str(volunteer_id),
        "available": available,
    })
    await db.commit()

    return {
        "message": f"Volunteer {volunteer_id} availability set to {available}"
    }


# ============================================================================
# POST /api/v1/volunteers/embed-all — Batch embed all volunteers
# ============================================================================

@router.post(
    "/embed-all",
    summary="Generate embeddings for all volunteers without one"
)
async def embed_all_volunteers(
    db: AsyncSession = Depends(get_db)
):
    """
    Batch operation: generate embeddings for all volunteers that
    don't have one yet. Useful after initial data import.
    """
    matching_service = get_matching_service()

    query = text("""
        SELECT id, bio FROM volunteers WHERE embedding IS NULL
    """)
    result = await db.execute(query)
    rows = result.fetchall()

    success_count = 0
    for row in rows:
        try:
            await matching_service.embed_and_store_volunteer(
                db, row.id, row.bio
            )
            success_count += 1
        except Exception as e:
            logger.error(f"Failed to embed volunteer {row.id}: {e}")

    return {
        "message": f"Embedded {success_count}/{len(rows)} volunteers",
        "total": len(rows),
        "success": success_count,
        "failed": len(rows) - success_count,
    }
