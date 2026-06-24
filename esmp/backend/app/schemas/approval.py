"""
Pydantic schemas for Change Approvals.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class ApprovalDecisionRequest(BaseModel):
    """Payload submitted by a CAB member to approve or reject a change."""
    decision: str = Field(..., pattern="^(approve|reject)$")
    comment: Optional[str] = Field(default=None, max_length=2000)


class ApproverBrief(BaseModel):
    id: UUID
    login: str
    email: str

    class Config:
        from_attributes = True


class ApprovalResponse(BaseModel):
    """Details of a change approval entry."""
    id: UUID
    change_id: UUID
    approver_id: UUID
    status: str
    comment: Optional[str] = None
    responded_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    approver: Optional[ApproverBrief] = None

    class Config:
        from_attributes = True
