"""
Incident service: incident creation with priority matrix, category validation.
"""

from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ValidationError
from app.domain.constants import ALL_CATEGORIES, ALL_SUBCATEGORIES
from app.domain.enums import IncidentStatus, WorkItemType
from app.models.identity import User
from app.models.incident import IncidentExtension
from app.models.work_item import WorkItem
from app.services.audit_service import AuditService
from app.services.work_item_service import WorkItemService
from app.services.sla_service import SlaService
from app.services.notification_service import NotificationService


# ── Priority matrix ──
# Ported from server/src/services/priorityMatrix.js
# urgency (rows) × impact (columns) → priority
# 1=High, 2=Medium, 3=Low

PRIORITY_MATRIX = {
    (1, 1): "P1",  # High urgency, High impact → P1
    (1, 2): "P1",  # High urgency, Medium impact → P1
    (1, 3): "P2",  # High urgency, Low impact → P2
    (2, 1): "P1",  # Medium urgency, High impact → P1
    (2, 2): "P2",  # Medium urgency, Medium impact → P2
    (2, 3): "P3",  # Medium urgency, Low impact → P3
    (3, 1): "P2",  # Low urgency, High impact → P2
    (3, 2): "P3",  # Low urgency, Medium impact → P3
    (3, 3): "P4",  # Low urgency, Low impact → P4
}


class IncidentService:
    """
    Incident-specific business logic.
    Delegates work item creation to WorkItemService.
    """

    @staticmethod
    def apply_priority_matrix(urgency: Optional[int], impact: Optional[int]) -> str:
        """
        Calculate priority from urgency × impact matrix.
        Returns P4 (lowest) as default when dimensions are missing.
        """
        if urgency is None or impact is None:
            return "P4"
        return PRIORITY_MATRIX.get((urgency, impact), "P4")

    @staticmethod
    def create_incident(
        db: Session,
        actor: User,
        *,
        title: str,
        description: str = "",
        category: Optional[str] = None,
        subcategory: Optional[str] = None,
        urgency: Optional[int] = None,
        impact: Optional[int] = None,
        assigned_to_id: Optional[UUID] = None,
        assigned_group_id: Optional[UUID] = None,
        source: str = "portal",
    ) -> WorkItem:
        """
        Create a new incident:
        1. Generate display ID
        2. Calculate priority from matrix
        3. Create work_item row
        4. Create incident_extension row
        5. Write audit log
        6. (Future) Start SLA clocks
        """

        # Validate category
        if category and category not in ALL_CATEGORIES:
            raise ValidationError(f"Invalid category: '{category}'")
        if subcategory and subcategory not in ALL_SUBCATEGORIES:
            raise ValidationError(f"Invalid subcategory: '{subcategory}'")

        # Calculate priority
        priority = IncidentService.apply_priority_matrix(urgency, impact)

        # Generate display ID
        display_id = WorkItemService.generate_display_id(db, WorkItemType.INCIDENT.value)

        # Determine initial status
        initial_status = IncidentStatus.NEW.value
        if assigned_to_id or assigned_group_id:
            initial_status = IncidentStatus.ASSIGNED.value

        # Create work item
        work_item = WorkItem(
            display_id=display_id,
            work_item_type=WorkItemType.INCIDENT.value,
            title=title,
            description=description,
            status=initial_status,
            priority=priority,
            reported_by_id=actor.id,
            assigned_to_id=assigned_to_id,
            assigned_group_id=assigned_group_id,
            source=source,
        )
        db.add(work_item)
        db.flush()  # Get the work_item.id

        # Create incident extension
        extension = IncidentExtension(
            work_item_id=work_item.id,
            urgency=urgency,
            impact=impact,
            category=category,
            subcategory=subcategory,
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
                "type": "incident",
                "title": title,
                "status": initial_status,
                "priority": priority,
                "category": category,
                "source": source,
            },
        )

        # Start SLA Clocks
        SlaService.start_clocks(db, work_item)

        db.commit()
        db.refresh(work_item)

        # Dispatch Notifications
        if work_item.assigned_to_id:
            NotificationService.dispatch(
                db=db,
                user_id=work_item.assigned_to_id,
                event_type="assigned",
                entity_id=work_item.id,
                entity_type="work_item",
                title=f"Incident Assigned: {work_item.display_id}",
                message=f"Incident '{work_item.title}' has been assigned to you."
            )

        if work_item.assigned_group_id:
            from app.models.identity import Group
            group = db.query(Group).filter(Group.id == work_item.assigned_group_id).first()
            if group and group.members:
                for member in group.members:
                    if member.id != work_item.assigned_to_id:
                        NotificationService.dispatch(
                            db=db,
                            user_id=member.id,
                            event_type="assigned",
                            entity_id=work_item.id,
                            entity_type="work_item",
                            title=f"Group Incident: {work_item.display_id}",
                            message=f"Incident '{work_item.title}' has been assigned to your group '{group.name}'."
                        )

        return work_item
