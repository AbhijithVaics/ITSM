"""
Work items API router.
Handles CRUD operations and listing with filters + pagination.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import Role, require_roles
from app.core.security import get_current_user
from app.domain.enums import WorkItemType
from app.models.identity import User
from app.schemas.incident import (
    AvailableActionsResponse,
    IncidentCreate,
    TransitionRequest,
    TransitionResponse,
)
from app.schemas.work_item import (
    WorkItemListResponse,
    WorkItemResponse,
    WorkItemUpdate,
    UserBrief,
    GroupBrief,
)
from app.services.incident_service import IncidentService
from app.services.work_item_service import WorkItemService
from app.services.workflow_service import WorkflowService

router = APIRouter()


def _to_response(work_item, user: Optional[User] = None) -> WorkItemResponse:
    """Convert a WorkItem ORM object to a response schema."""
    extension = None
    if work_item.incident_extension:
        ext = work_item.incident_extension
        extension = {
            "urgency": ext.urgency,
            "impact": ext.impact,
            "category": ext.category,
            "subcategory": ext.subcategory,
            "resolution_code": ext.resolution_code,
            "resolution_note": ext.resolution_note,
        }
    elif work_item.change_extension:
        ext = work_item.change_extension
        extension = {
            "risk_level": ext.risk_level,
            "expedited": ext.expedited,
            "scheduled_start": ext.scheduled_start.isoformat() if ext.scheduled_start else None,
            "scheduled_end": ext.scheduled_end.isoformat() if ext.scheduled_end else None,
            "implementation_plan": ext.implementation_plan,
            "backout_plan": ext.backout_plan,
            "validation_plan": ext.validation_plan,
        }

    available_actions = None
    if user:
        actions = WorkflowService.get_available_actions(work_item, user)
        available_actions = [a["action"] for a in actions]

    return WorkItemResponse(
        id=work_item.id,
        display_id=work_item.display_id,
        work_item_type=work_item.work_item_type,
        title=work_item.title,
        description=work_item.description or "",
        status=work_item.status,
        priority=work_item.priority,
        source=work_item.source,
        reported_by=UserBrief(id=work_item.reported_by.id, login=work_item.reported_by.login, email=work_item.reported_by.email) if work_item.reported_by else None,
        assigned_to=UserBrief(id=work_item.assigned_to.id, login=work_item.assigned_to.login, email=work_item.assigned_to.email) if work_item.assigned_to else None,
        assigned_group=GroupBrief(id=work_item.assigned_group.id, name=work_item.assigned_group.name) if work_item.assigned_group else None,
        resolution_deadline=work_item.resolution_deadline,
        first_response_at=work_item.first_response_at,
        resolved_at=work_item.resolved_at,
        closed_at=work_item.closed_at,
        created_at=work_item.created_at,
        updated_at=work_item.updated_at,
        extension=extension,
        available_actions=available_actions,
        sla_clocks=work_item.sla_clocks if hasattr(work_item, "sla_clocks") else None,
    )


@router.get("", response_model=WorkItemListResponse)
def list_work_items(
    work_item_type: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    assigned_group_id: Optional[UUID] = Query(default=None),
    assigned_to_id: Optional[UUID] = Query(default=None),
    reported_by_id: Optional[UUID] = Query(default=None),
    source: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None, description="Search display_id, title"),
    limit: int = Query(default=50, ge=1, le=100),
    cursor: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List work items with scope-based filtering and keyset pagination."""
    items, next_cursor = WorkItemService.list_work_items(
        db,
        current_user,
        work_item_type=work_item_type,
        status=status,
        assigned_group_id=assigned_group_id,
        assigned_to_id=assigned_to_id,
        reported_by_id=reported_by_id,
        source=source,
        q=q,
        limit=limit,
        cursor=cursor,
    )
    return WorkItemListResponse(
        items=[_to_response(wi, current_user) for wi in items],
        next_cursor=next_cursor,
    )


@router.post("/incidents", response_model=WorkItemResponse, status_code=201)
def create_incident(
    payload: IncidentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(Role.REQUESTER, Role.AGENT, Role.MANAGER, Role.ADMIN)
    ),
):
    """Create a new incident."""
    work_item = IncidentService.create_incident(
        db,
        current_user,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        subcategory=payload.subcategory,
        urgency=payload.urgency,
        impact=payload.impact,
        assigned_to_id=payload.assigned_to_id,
        assigned_group_id=payload.assigned_group_id,
        source=payload.source,
    )
    return _to_response(work_item, current_user)


@router.get("/{work_item_id}", response_model=WorkItemResponse)
def get_work_item(
    work_item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single work item by ID (scope-checked)."""
    work_item = WorkItemService.get_scoped(db, current_user, work_item_id)
    return _to_response(work_item, current_user)


@router.patch("/{work_item_id}", response_model=WorkItemResponse)
def update_work_item(
    work_item_id: UUID,
    payload: WorkItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(Role.AGENT, Role.MANAGER, Role.ADMIN)
    ),
):
    """Partially update a work item's fields."""
    work_item = WorkItemService.update_work_item(
        db,
        current_user,
        work_item_id,
        title=payload.title,
        description=payload.description,
        assigned_to_id=payload.assigned_to_id,
        assigned_group_id=payload.assigned_group_id,
        priority=payload.priority,
    )
    return _to_response(work_item, current_user)


@router.get("/{work_item_id}/transitions", response_model=AvailableActionsResponse)
def get_available_transitions(
    work_item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get available workflow actions for the current user on this work item."""
    work_item = WorkItemService.get_scoped(db, current_user, work_item_id)
    actions = WorkflowService.get_available_actions(work_item, current_user)
    return AvailableActionsResponse(actions=actions)


@router.post("/{work_item_id}/transitions", response_model=TransitionResponse)
def execute_transition(
    work_item_id: UUID,
    payload: TransitionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Execute a workflow transition on a work item."""
    old_status = WorkItemService.get_scoped(db, current_user, work_item_id).status

    work_item = WorkflowService.execute_transition(
        db,
        current_user,
        work_item_id,
        payload.action,
        comment=payload.comment,
        resolution_code=payload.resolution_code,
        resolution_note=payload.resolution_note,
        assigned_to_id=payload.assigned_to_id,
        assigned_group_id=payload.assigned_group_id,
    )

    return TransitionResponse(
        work_item_id=work_item.id,
        display_id=work_item.display_id,
        previous_status=old_status,
        new_status=work_item.status,
        action=payload.action,
    )


# ── Nested Routers ──
from app.api.v1.comments import router as comments_router
from app.api.v1.attachments import router as attachments_router

router.include_router(comments_router, prefix="/{work_item_id}/comments", tags=["Comments"])
router.include_router(attachments_router, prefix="/{work_item_id}/attachments", tags=["Attachments"])

