"""
Pydantic schemas for work item API requests and responses.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ── Nested response models ──

class UserBrief(BaseModel):
    """Minimal user representation for embedded references."""
    id: UUID
    login: str
    email: str

    class Config:
        from_attributes = True


class GroupBrief(BaseModel):
    """Minimal group representation for embedded references."""
    id: UUID
    name: str

    class Config:
        from_attributes = True


# ── Request schemas ──

class WorkItemCreate(BaseModel):
    """Create a new work item (generic — use IncidentCreate for incidents)."""
    work_item_type: str = Field(..., pattern="^(incident|change)$")
    title: str = Field(..., min_length=3, max_length=500)
    description: str = Field(default="", max_length=10000)
    source: str = Field(default="portal", pattern="^(portal|email|agent)$")
    assigned_to_id: Optional[UUID] = None
    assigned_group_id: Optional[UUID] = None


class WorkItemUpdate(BaseModel):
    """Partial update of a work item's fields."""
    title: Optional[str] = Field(default=None, min_length=3, max_length=500)
    description: Optional[str] = Field(default=None, max_length=10000)
    assigned_to_id: Optional[UUID] = None
    assigned_group_id: Optional[UUID] = None
    priority: Optional[str] = None


# ── Response schemas ──

class SlaClockResponse(BaseModel):
    id: UUID
    metric: str
    status: str
    started_at: datetime
    paused_at: Optional[datetime] = None
    deadline: datetime
    breached_at: Optional[datetime] = None
    is_breached: bool

    class Config:
        from_attributes = True


class WorkItemResponse(BaseModel):
    """Full work item response."""
    id: UUID
    display_id: str
    work_item_type: str
    title: str
    description: str
    status: str
    priority: Optional[str] = None
    source: str
    reported_by: Optional[UserBrief] = None
    assigned_to: Optional[UserBrief] = None
    assigned_group: Optional[GroupBrief] = None
    resolution_deadline: Optional[datetime] = None
    first_response_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    # Extension data (incident or change specific)
    extension: Optional[Dict[str, Any]] = None

    # Available workflow transitions for current user
    available_actions: Optional[List[str]] = None

    # SLA Clocks
    sla_clocks: Optional[List[SlaClockResponse]] = None

    class Config:
        from_attributes = True



class WorkItemListResponse(BaseModel):
    """Paginated list of work items."""
    items: List[WorkItemResponse]
    next_cursor: Optional[str] = None
    total: Optional[int] = None
