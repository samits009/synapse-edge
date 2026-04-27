"""
SynapseEdge Backend — Pydantic Models for Volunteers

Request/Response schemas for volunteer management endpoints.
Volunteers are the "supply side" of the matching equation — their
unstructured bios are embedded into vectors for semantic skill matching.
"""

from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from uuid import UUID, uuid4
from typing import Optional


# ============================================================================
# Request Models
# ============================================================================

class VolunteerCreateRequest(BaseModel):
    """
    Request to register a new volunteer.

    The [bio] field is the most important input — it's the unstructured text
    that gets embedded into a 768-dimensional vector for semantic matching.

    Good bio example:
    "I'm a retired trauma surgeon who speaks Hindi and Arabic. I've set up
    field hospitals in three disaster zones and can drive heavy vehicles.
    Also trained in water purification and solar panel installation."

    This bio contains LATENT skills that no checkbox system would capture:
    - Implicit multilingual capability
    - Crisis zone experience
    - Cross-domain skills (medical + logistics + engineering)
    """
    name: str = Field(..., min_length=1, max_length=255, description="Full name")
    email: str = Field(..., description="Contact email (unique)")
    phone: Optional[str] = Field(None, max_length=50, description="Phone number")
    bio: str = Field(..., min_length=10, description="Unstructured bio — source of latent skills")
    skills_raw: list[str] = Field(default_factory=list, description="Optional explicit skill tags")
    location_lat: Optional[float] = Field(None, ge=-90, le=90)
    location_lng: Optional[float] = Field(None, ge=-180, le=180)
    availability: bool = Field(True, description="Currently available for dispatch?")


class VolunteerUpdateRequest(BaseModel):
    """Request to update a volunteer's profile."""
    name: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    bio: Optional[str] = Field(None, min_length=10)
    skills_raw: Optional[list[str]] = None
    location_lat: Optional[float] = Field(None, ge=-90, le=90)
    location_lng: Optional[float] = Field(None, ge=-180, le=180)
    availability: Optional[bool] = None


# ============================================================================
# Response Models
# ============================================================================

class VolunteerResponse(BaseModel):
    """Full volunteer representation in API responses."""
    id: UUID
    name: str
    email: str
    phone: Optional[str] = None
    bio: str
    skills_raw: list[str] = []
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    availability: bool = True
    has_embedding: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VolunteerListResponse(BaseModel):
    """Paginated list of volunteers."""
    volunteers: list[VolunteerResponse]
    total: int
    page: int = 1
    per_page: int = 50
