"""
Pydantic schemas for in-app Notifications.
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    event_type: str
    entity_id: Optional[UUID] = None
    entity_type: Optional[str] = None
    title: str
    message: str
    is_read: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    unread_count: int
