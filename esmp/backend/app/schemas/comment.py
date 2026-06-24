"""
Pydantic schemas for comments API requests and responses.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.domain.enums import CommentVisibility
from app.schemas.work_item import UserBrief


class CommentCreate(BaseModel):
    """Request schema to create a comment on a work item."""
    text: str = Field(..., min_length=1, max_length=10000)
    visibility: CommentVisibility = Field(default=CommentVisibility.PUBLIC)


class CommentResponse(BaseModel):
    """Response schema for a comment."""
    id: UUID
    work_item_id: UUID
    author: Optional[UserBrief] = None
    text: str
    visibility: CommentVisibility
    created_at: datetime

    class Config:
        from_attributes = True
