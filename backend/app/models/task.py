"""
SynapseEdge Backend — Pydantic Models for Field Tasks

Request/Response schemas for the task ingestion and matching endpoints.
These models enforce validation at the API boundary, ensuring only
well-formed data enters the vector routing pipeline.
"""

from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional


# ============================================================================
# Request Models — Incoming from Android/Firebase
# ============================================================================

class TaskIngestRequest(BaseModel):
    """
    Incoming field task from the Android app (via Firebase sync).

    This is the payload structure that arrives after the Snap-to-Semantics
    engine has processed a handwritten field note. The AI extraction fields
    (intent, urgency, skills_needed, description) have been populated
    on-device by Gemini Nano/Pro.

    Example payload:
    ```json
    {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "raw_text": "Need medicine for 3 children with fever...",
        "intent": "medical_supply_request",
        "urgency": 4,
        "skills_needed": ["medical_first_aid", "logistics"],
        "description": "Urgent medical supplies needed...",
        "location_lat": 28.6139,
        "location_lng": 77.2090,
        "source_device_id": "pixel-8-field-001",
        "sync_hops": 2
    }
    ```
    """
    id: UUID = Field(default_factory=uuid4, description="Globally unique task ID (generated on-device)")
    raw_text: str = Field(..., min_length=1, description="Raw OCR text from handwritten field note")
    intent: Optional[str] = Field(None, description="AI-extracted intent category")
    urgency: int = Field(3, ge=1, le=5, description="Urgency level: 1=low, 5=life-threatening")
    skills_needed: list[str] = Field(default_factory=list, description="AI-extracted implicit skills")
    description: Optional[str] = Field(None, description="AI-generated summary for embedding")
    location_lat: Optional[float] = Field(None, ge=-90, le=90, description="GPS latitude")
    location_lng: Optional[float] = Field(None, ge=-180, le=180, description="GPS longitude")
    source_device_id: Optional[str] = Field(None, description="Originating device identifier")
    sync_hops: int = Field(0, ge=0, description="Number of mesh relay hops")


class TaskUpdateRequest(BaseModel):
    """Request to update task status."""
    status: str = Field(..., description="New status: matched, dispatched, resolved")


# ============================================================================
# Response Models — Outgoing to Dashboard/Client
# ============================================================================

class TaskResponse(BaseModel):
    """Full task representation in API responses."""
    id: UUID
    raw_text: str
    intent: Optional[str] = None
    urgency: int = 3
    skills_needed: list[str] = []
    description: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    source_device_id: Optional[str] = None
    sync_hops: int = 0
    status: str = "unmatched"
    has_embedding: bool = False
    created_at: datetime
    matched_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TaskMatchResult(BaseModel):
    """A single task-to-volunteer match with similarity score."""
    volunteer_id: UUID
    volunteer_name: str
    volunteer_bio: str
    volunteer_skills: list[str]
    similarity_score: float = Field(..., ge=0.0, le=1.0, description="Cosine similarity (0-1)")
    distance_km: Optional[float] = Field(None, description="Geographic distance in km")


class TaskIngestResponse(BaseModel):
    """Response after successfully ingesting a field task."""
    task: TaskResponse
    matches: list[TaskMatchResult] = []
    message: str = "Task ingested and matched successfully"
