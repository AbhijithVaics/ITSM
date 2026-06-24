"""
Pydantic schemas for Change Management.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class ChangeCreate(BaseModel):
    """Payload to create a new change request."""
    title: str = Field(..., min_length=3, max_length=500)
    description: str = Field(default="", max_length=10000)
    risk_level: str = Field(default="low", pattern="^(low|medium|high|critical)$")
    expedited: bool = Field(default=False)
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    implementation_plan: Optional[str] = None
    backout_plan: Optional[str] = None
    validation_plan: Optional[str] = None
    assigned_to_id: Optional[UUID] = None
    assigned_group_id: Optional[UUID] = None


class ChangePlanUpdate(BaseModel):
    """Payload to update plans, risk, and dates for a change."""
    risk_level: Optional[str] = Field(default=None, pattern="^(low|medium|high|critical)$")
    expedited: Optional[bool] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    implementation_plan: Optional[str] = None
    backout_plan: Optional[str] = None
    validation_plan: Optional[str] = None
