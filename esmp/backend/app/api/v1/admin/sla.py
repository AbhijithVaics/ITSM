"""
SLA Configuration Admin API router.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import Role, require_roles
from app.schemas.sla import (
    SlaPolicyCreate,
    SlaPolicyResponse,
    BusinessCalendarCreate,
    BusinessCalendarResponse,
)
from app.services.sla_service import SlaService

router = APIRouter()

admin_only = require_roles(Role.ADMIN)


@router.get("/policies", response_model=List[SlaPolicyResponse])
def list_sla_policies(
    db: Session = Depends(get_db),
    current_user=Depends(admin_only),
):
    """
    List all SLA policies.
    """
    policies = SlaService.get_policies(db)
    return [SlaPolicyResponse.model_validate(p) for p in policies]


@router.post("/policies", response_model=SlaPolicyResponse, status_code=status.HTTP_201_CREATED)
def create_sla_policy(
    payload: SlaPolicyCreate,
    db: Session = Depends(get_db),
    current_user=Depends(admin_only),
):
    """
    Create a new SLA policy.
    """
    policy = SlaService.create_policy(db, payload)
    return SlaPolicyResponse.model_validate(policy)


@router.put("/policies/{policy_id}", response_model=SlaPolicyResponse)
def update_sla_policy(
    policy_id: UUID,
    payload: SlaPolicyCreate,
    db: Session = Depends(get_db),
    current_user=Depends(admin_only),
):
    """
    Update an existing SLA policy.
    """
    policy = SlaService.update_policy(db, policy_id, payload)
    return SlaPolicyResponse.model_validate(policy)


@router.delete("/policies/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sla_policy(
    policy_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(admin_only),
):
    """
    Delete an SLA policy.
    """
    SlaService.delete_policy(db, policy_id)
    return None


@router.get("/calendars", response_model=List[BusinessCalendarResponse])
def list_business_calendars(
    db: Session = Depends(get_db),
    current_user=Depends(admin_only),
):
    """
    List all business calendars.
    """
    calendars = SlaService.get_calendars(db)
    res = []
    for c in calendars:
        c_res = BusinessCalendarResponse(
            id=c.id,
            name=c.name,
            timezone=c.timezone,
            working_days=c.working_days,
            start_time=c.start_time.isoformat(),
            end_time=c.end_time.isoformat(),
            is_default=c.is_default,
            holidays=[]
        )
        res.append(c_res)
    return res


@router.post("/calendars", response_model=BusinessCalendarResponse, status_code=status.HTTP_201_CREATED)
def create_business_calendar(
    payload: BusinessCalendarCreate,
    db: Session = Depends(get_db),
    current_user=Depends(admin_only),
):
    """
    Create a new business calendar.
    """
    c = SlaService.create_calendar(db, payload)
    return BusinessCalendarResponse(
        id=c.id,
        name=c.name,
        timezone=c.timezone,
        working_days=c.working_days,
        start_time=c.start_time.isoformat(),
        end_time=c.end_time.isoformat(),
        is_default=c.is_default,
        holidays=[]
    )


@router.put("/calendars/{calendar_id}", response_model=BusinessCalendarResponse)
def update_business_calendar(
    calendar_id: UUID,
    payload: BusinessCalendarCreate,
    db: Session = Depends(get_db),
    current_user=Depends(admin_only),
):
    """
    Update an existing business calendar.
    """
    c = SlaService.update_calendar(db, calendar_id, payload)
    return BusinessCalendarResponse(
        id=c.id,
        name=c.name,
        timezone=c.timezone,
        working_days=c.working_days,
        start_time=c.start_time.isoformat(),
        end_time=c.end_time.isoformat(),
        is_default=c.is_default,
        holidays=[]
    )


@router.delete("/calendars/{calendar_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_business_calendar(
    calendar_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(admin_only),
):
    """
    Delete a business calendar.
    """
    SlaService.delete_calendar(db, calendar_id)
    return None
