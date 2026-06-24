"""
Pydantic schemas for audit log API responses.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    """Single audit log entry response."""
    id: UUID
    entity_type: str
    entity_id: UUID
    action: str
    actor_id: Optional[UUID] = None
    actor_display: Optional[str] = None
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    """Paginated list of audit log entries."""
    items: List[AuditLogResponse]
    total: int
    page: int
    page_size: int
