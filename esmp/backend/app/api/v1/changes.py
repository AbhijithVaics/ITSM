"""
Change Requests API Router.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import Role, require_roles
from app.core.security import get_current_user
from app.models.identity import User
from app.models.work_item import WorkItem
from app.models.change import ChangeExtension
from app.schemas.change import ChangeCreate, ChangePlanUpdate
from app.schemas.work_item import WorkItemResponse
from app.services.change_service import ChangeService
from app.services.work_item_service import WorkItemService
from app.api.v1.work_items import _to_response

router = APIRouter()


@router.post("", response_model=WorkItemResponse, status_code=201)
def create_change(
    payload: ChangeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(Role.AGENT, Role.MANAGER, Role.CHANGE_MANAGER, Role.ADMIN)
    ),
):
    """Create a new Change Request in draft status."""
    work_item = ChangeService.create_change(
        db,
        current_user,
        title=payload.title,
        description=payload.description,
        risk_level=payload.risk_level,
        expedited=payload.expedited,
        scheduled_start=payload.scheduled_start,
        scheduled_end=payload.scheduled_end,
        implementation_plan=payload.implementation_plan,
        backout_plan=payload.backout_plan,
        validation_plan=payload.validation_plan,
        assigned_to_id=payload.assigned_to_id,
        assigned_group_id=payload.assigned_group_id,
    )
    return _to_response(work_item, current_user)


@router.patch("/{work_item_id}/plans", response_model=WorkItemResponse)
def update_change_plans(
    work_item_id: UUID,
    payload: ChangePlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(Role.AGENT, Role.MANAGER, Role.CHANGE_MANAGER, Role.ADMIN)
    ),
):
    """Update plans, risk, and schedule dates for a Change Request."""
    work_item = ChangeService.update_plans(
        db,
        current_user,
        work_item_id,
        risk_level=payload.risk_level,
        expedited=payload.expedited,
        scheduled_start=payload.scheduled_start,
        scheduled_end=payload.scheduled_end,
        implementation_plan=payload.implementation_plan,
        backout_plan=payload.backout_plan,
        validation_plan=payload.validation_plan,
    )
    return _to_response(work_item, current_user)


@router.get("/calendar", response_model=List[WorkItemResponse])
def get_change_calendar(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(Role.AGENT, Role.MANAGER, Role.CHANGE_MANAGER, Role.CAB_MEMBER, Role.ADMIN)
    ),
):
    """Get all scheduled changes for calendar visualization."""
    query = (
        db.query(WorkItem)
        .join(ChangeExtension)
        .filter(
            WorkItem.work_item_type == "change",
            WorkItem.soft_deleted_at == None,
            ChangeExtension.scheduled_start != None,
        )
    )

    # Enforce scope check
    user_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if user_role == Role.REQUESTER.value:
        return []
    elif user_role == Role.AGENT.value:
        user_group_ids = [g.id for g in current_user.groups]
        query = query.filter(
            (WorkItem.assigned_to_id == current_user.id)
            | (WorkItem.assigned_group_id.in_(user_group_ids))
            | (WorkItem.reported_by_id == current_user.id)
        )

    items = query.all()
    return [_to_response(wi, current_user) for wi in items]
