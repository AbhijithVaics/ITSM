"""
Change Service: business logic for change requests creation and plan updates.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
import structlog

from sqlalchemy.orm import Session

from app.core.exceptions import ValidationError
from app.domain.enums import ChangeStatus, WorkItemType
from app.models.identity import User
from app.models.change import ChangeExtension
from app.models.work_item import WorkItem
from app.services.audit_service import AuditService
from app.services.work_item_service import WorkItemService

logger = structlog.get_logger()


class ChangeService:
    """
    Business logic layer for Change Requests.
    Delegates generic spine creation to WorkItemService.
    """

    @staticmethod
    def create_change(
        db: Session,
        actor: User,
        *,
        title: str,
        description: str = "",
        risk_level: str = "low",
        expedited: bool = False,
        scheduled_start: Optional[datetime] = None,
        scheduled_end: Optional[datetime] = None,
        implementation_plan: Optional[str] = None,
        backout_plan: Optional[str] = None,
        validation_plan: Optional[str] = None,
        assigned_to_id: Optional[UUID] = None,
        assigned_group_id: Optional[UUID] = None,
    ) -> WorkItem:
        """
        Create a new Change Request in 'draft' status.
        """
        logger.info("Creating new Change Request", risk_level=risk_level, expedited=expedited)

        # Generate display ID
        display_id = WorkItemService.generate_display_id(db, WorkItemType.CHANGE.value)

        # Initial status is draft
        initial_status = ChangeStatus.DRAFT.value

        # Create core work item
        work_item = WorkItem(
            display_id=display_id,
            work_item_type=WorkItemType.CHANGE.value,
            title=title,
            description=description,
            status=initial_status,
            priority=None,  # Changes do not use priority P1-P4 matrix
            reported_by_id=actor.id,
            assigned_to_id=assigned_to_id,
            assigned_group_id=assigned_group_id,
            source="portal",
        )
        db.add(work_item)
        db.flush()

        # Create change extension
        extension = ChangeExtension(
            work_item_id=work_item.id,
            risk_level=risk_level,
            expedited=expedited,
            scheduled_start=scheduled_start,
            scheduled_end=scheduled_end,
            implementation_plan=implementation_plan,
            backout_plan=backout_plan,
            validation_plan=validation_plan,
        )
        db.add(extension)

        # Audit
        AuditService.log(
            db,
            entity_type="work_item",
            entity_id=work_item.id,
            action="created",
            actor_id=actor.id,
            actor_display=actor.login,
            new_values={
                "display_id": display_id,
                "type": "change",
                "title": title,
                "status": initial_status,
                "risk_level": risk_level,
                "expedited": expedited,
            },
        )

        db.commit()
        db.refresh(work_item)
        return work_item

    @staticmethod
    def update_plans(
        db: Session,
        actor: User,
        work_item_id: UUID,
        *,
        risk_level: Optional[str] = None,
        expedited: Optional[bool] = None,
        scheduled_start: Optional[datetime] = None,
        scheduled_end: Optional[datetime] = None,
        implementation_plan: Optional[str] = None,
        backout_plan: Optional[str] = None,
        validation_plan: Optional[str] = None,
    ) -> WorkItem:
        """
        Updates change extension fields (plans, scheduled dates, risk) on a change.
        """
        work_item = WorkItemService.get_scoped(db, actor, work_item_id)
        if work_item.work_item_type != WorkItemType.CHANGE.value:
            raise ValidationError("Work item is not a Change Request")

        if work_item.status == ChangeStatus.CLOSED.value:
            raise ValidationError("Cannot update plans on a closed Change Request")

        ext = work_item.change_extension
        if not ext:
            # Create extension if missing (should not happen normally)
            ext = ChangeExtension(work_item_id=work_item.id)
            db.add(ext)

        old_values = {}
        new_values = {}

        if risk_level is not None:
            old_values["risk_level"] = ext.risk_level
            ext.risk_level = risk_level
            new_values["risk_level"] = risk_level

        if expedited is not None:
            old_values["expedited"] = ext.expedited
            ext.expedited = expedited
            new_values["expedited"] = expedited

        if scheduled_start is not None:
            old_values["scheduled_start"] = str(ext.scheduled_start) if ext.scheduled_start else None
            ext.scheduled_start = scheduled_start
            new_values["scheduled_start"] = str(scheduled_start)

        if scheduled_end is not None:
            old_values["scheduled_end"] = str(ext.scheduled_end) if ext.scheduled_end else None
            ext.scheduled_end = scheduled_end
            new_values["scheduled_end"] = str(scheduled_end)

        if implementation_plan is not None:
            old_values["implementation_plan"] = ext.implementation_plan
            ext.implementation_plan = implementation_plan
            new_values["implementation_plan"] = implementation_plan

        if backout_plan is not None:
            old_values["backout_plan"] = ext.backout_plan
            ext.backout_plan = backout_plan
            new_values["backout_plan"] = backout_plan

        if validation_plan is not None:
            old_values["validation_plan"] = ext.validation_plan
            ext.validation_plan = validation_plan
            new_values["validation_plan"] = validation_plan

        AuditService.log(
            db,
            entity_type="work_item",
            entity_id=work_item.id,
            action="plans_updated",
            actor_id=actor.id,
            actor_display=actor.login,
            old_values=old_values,
            new_values=new_values,
        )

        db.commit()
        db.refresh(work_item)
        return work_item
