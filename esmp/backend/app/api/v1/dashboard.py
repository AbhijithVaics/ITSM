"""
Dashboard API endpoints.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import Role, require_roles
from app.models.identity import User
from app.services.dashboard_service import DashboardService

router = APIRouter()

# Dashboard restricted to staff and admins
dashboard_access = require_roles(
    Role.AGENT, Role.MANAGER, Role.CHANGE_MANAGER, Role.CAB_MEMBER, Role.ADMIN
)


@router.get("/open-by-status")
def get_open_by_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(dashboard_access),
):
    """
    Get counts of work items grouped by status.
    """
    return DashboardService.open_by_status(db, current_user)


@router.get("/sla-summary")
def get_sla_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(dashboard_access),
):
    """
    Get SLA clocks breach/at-risk/healthy summary.
    """
    return DashboardService.sla_summary(db, current_user)


@router.get("/workload")
def get_workload(
    db: Session = Depends(get_db),
    current_user: User = Depends(dashboard_access),
):
    """
    Get workload counts grouped by group and assignee.
    """
    return DashboardService.workload(db, current_user)
