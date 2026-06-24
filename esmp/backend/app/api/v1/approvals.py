"""
Approvals API Router.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import Role, require_roles
from app.core.security import get_current_user
from app.models.identity import User
from app.models.approval import Approval
from app.schemas.approval import ApprovalDecisionRequest, ApprovalResponse
from app.services.approval_service import ApprovalService
from app.services.work_item_service import WorkItemService
from app.domain.enums import ApprovalDecision

router = APIRouter()


@router.get("/my-pending", response_model=List[ApprovalResponse])
def get_my_pending_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(Role.CAB_MEMBER, Role.CHANGE_MANAGER, Role.ADMIN)
    ),
):
    """List all pending approvals assigned to the current user."""
    return ApprovalService.list_pending_for_user(db, current_user.id)


@router.post("/{approval_id}/decide", response_model=ApprovalResponse)
def make_approval_decision(
    approval_id: UUID,
    payload: ApprovalDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(Role.CAB_MEMBER, Role.ADMIN)
    ),
):
    """Submit approval decision (approve or reject) on a pending change request."""
    try:
        decision_enum = ApprovalDecision(payload.decision)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid decision value '{payload.decision}'"
        )

    approval = ApprovalService.decide(
        db=db,
        approver=current_user,
        approval_id=approval_id,
        decision=decision_enum,
        comment=payload.comment,
    )
    return approval


@router.get("/change/{change_id}", response_model=List[ApprovalResponse])
def get_change_approvals(
    change_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(Role.AGENT, Role.MANAGER, Role.CHANGE_MANAGER, Role.CAB_MEMBER, Role.ADMIN)
    ),
):
    """Retrieve all approvals (pending, approved, rejected, cancelled) for a Change Request."""
    # Enforce scope check on the change request itself
    WorkItemService.get_scoped(db, current_user, change_id)
    return db.query(Approval).filter(Approval.change_id == change_id).order_by(Approval.created_at.asc()).all()
