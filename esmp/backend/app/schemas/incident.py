"""
Pydantic schemas for incident API.
"""

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class IncidentCreate(BaseModel):
    """Create a new incident via portal."""
    title: str = Field(..., min_length=3, max_length=500)
    description: str = Field(default="", max_length=10000)
    category: Optional[str] = None
    subcategory: Optional[str] = None
    urgency: Optional[int] = Field(default=None, ge=1, le=3)  # 1=High, 2=Medium, 3=Low
    impact: Optional[int] = Field(default=None, ge=1, le=3)   # 1=High, 2=Medium, 3=Low
    assigned_to_id: Optional[UUID] = None
    assigned_group_id: Optional[UUID] = None
    source: str = Field(default="portal", pattern="^(portal|email|agent)$")


class IncidentUpdate(BaseModel):
    """Partial update of incident-specific fields."""
    category: Optional[str] = None
    subcategory: Optional[str] = None
    urgency: Optional[int] = Field(default=None, ge=1, le=3)
    impact: Optional[int] = Field(default=None, ge=1, le=3)


class TransitionRequest(BaseModel):
    """Request to execute a workflow transition."""
    action: str = Field(..., description="Transition action name (e.g., 'assign', 'resolve')")
    comment: Optional[str] = Field(default=None, max_length=5000, description="Optional comment explaining the transition")
    resolution_code: Optional[str] = Field(default=None, description="Required for 'resolve' action")
    resolution_note: Optional[str] = Field(default=None, max_length=10000)
    assigned_to_id: Optional[UUID] = Field(default=None, description="Required for 'assign' action")
    assigned_group_id: Optional[UUID] = Field(default=None, description="Required for 'assign' action")


class TransitionResponse(BaseModel):
    """Response after executing a transition."""
    work_item_id: UUID
    display_id: str
    previous_status: str
    new_status: str
    action: str


class AvailableActionsResponse(BaseModel):
    """List of available workflow actions for the current user."""
    actions: list[dict]
