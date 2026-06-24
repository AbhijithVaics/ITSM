"""
Audit Log Admin API router.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import Role, require_roles
from app.schemas.audit import AuditLogListResponse, AuditLogResponse
from app.services.audit_service import AuditService

router = APIRouter()

admin_only = require_roles(Role.ADMIN)


@router.get("", response_model=AuditLogListResponse)
def list_audit_logs(
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[UUID] = Query(None),
    actor_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(admin_only),
):
    """
    List system-wide audit logs with filters and pagination.
    """
    items, total = AuditService.query(
        db,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_id=actor_id,
        page=page,
        page_size=page_size,
    )
    return AuditLogListResponse(
        items=[AuditLogResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )
