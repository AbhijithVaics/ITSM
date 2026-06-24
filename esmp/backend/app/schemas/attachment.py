"""
Pydantic schemas for attachments response.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from app.schemas.work_item import UserBrief


class AttachmentResponse(BaseModel):
    """Response schema for file attachment metadata."""
    id: UUID
    work_item_id: UUID
    uploaded_by: Optional[UserBrief] = None
    filename: str
    content_type: Optional[str] = None
    file_size: int  # size in bytes
    created_at: datetime

    class Config:
        from_attributes = True
