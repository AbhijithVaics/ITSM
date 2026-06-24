"""
Workflow service: validates and executes transitions for work items.
Uses code-defined state machines from domain/workflows/.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError, ValidationError
from app.core.permissions import Role
from app.domain.enums import IncidentStatus, ChangeStatus, WorkItemType
from app.domain.workflows.incident import (
    INCIDENT_TRANSITIONS,
    get_available_actions as get_incident_actions,
    validate_transition as validate_incident_transition,
)
from app.domain.workflows.change import (
    CHANGE_TRANSITIONS,
    get_available_actions as get_change_actions,
    validate_transition as validate_change_transition,
)
from app.models.identity import User
from app.models.work_item import WorkItem
from app.models.incident import IncidentExtension
from app.services.audit_service import AuditService
from app.services.work_item_service import WorkItemService
from app.services.sla_service import SlaService
from app.services.notification_service import NotificationService


class WorkflowService:
    """
    Orchestrates workflow transitions for all work item types.
    1. Load work item + extension
    2. Resolve transition from workflow definition
    3. Validate role + status + guards
    4. Apply status change + timestamps
    5. Write audit
    6. (Future) Trigger side effects: SLA, notifications
    """

    @staticmethod
    def get_available_actions(work_item: WorkItem, user: User) -> list[dict]:
        """
        Returns available transition actions for the current user on this work item.
        """
        user_role = user.role.value if hasattr(user.role, "value") else str(user.role)

        if work_item.work_item_type == WorkItemType.INCIDENT.value:
            try:
                current_status = IncidentStatus(work_item.status)
            except ValueError:
                return []
            action_names = get_incident_actions(current_status, Role(user_role))
            return [
                {
                    "action": name,
                    "to_status": INCIDENT_TRANSITIONS[name]["to_status"].value,
                    "description": INCIDENT_TRANSITIONS[name].get("description", ""),
                }
                for name in action_names
            ]

        if work_item.work_item_type == WorkItemType.CHANGE.value:
            try:
                current_status = ChangeStatus(work_item.status)
            except ValueError:
                return []
            action_names = get_change_actions(current_status, Role(user_role))
            return [
                {
                    "action": name,
                    "to_status": CHANGE_TRANSITIONS[name]["to_status"].value,
                    "description": CHANGE_TRANSITIONS[name].get("description", ""),
                }
                for name in action_names
            ]

        return []

    @staticmethod
    def execute_transition(
        db: Session,
        user: User,
        work_item_id: UUID,
        action: str,
        *,
        comment: Optional[str] = None,
        resolution_code: Optional[str] = None,
        resolution_note: Optional[str] = None,
        assigned_to_id: Optional[UUID] = None,
        assigned_group_id: Optional[UUID] = None,
    ) -> WorkItem:
        """
        Execute a workflow transition on a work item.

        Steps:
        1. Load and scope-check the work item
        2. Validate the transition (status + role + guards)
        3. Apply status change and relevant timestamps
        4. Write audit log
        5. (Future) Trigger side effects

        Returns the updated work item.
        """
        work_item = WorkItemService.get_scoped(db, user, work_item_id)
        user_role = user.role.value if hasattr(user.role, "value") else str(user.role)

        # ── Resolve transition definition ──
        if work_item.work_item_type == WorkItemType.INCIDENT.value:
            current_status = IncidentStatus(work_item.status)
            try:
                transition = validate_incident_transition(current_status, action, Role(user_role))
            except ValueError as e:
                raise ValidationError(str(e))
        elif work_item.work_item_type == WorkItemType.CHANGE.value:
            current_status = ChangeStatus(work_item.status)
            try:
                transition = validate_change_transition(current_status, action, Role(user_role))
            except ValueError as e:
                raise ValidationError(str(e))
        else:
            raise ValidationError(f"Workflow transitions not implemented for type '{work_item.work_item_type}'")

        # ── Apply guards ──
        guard = transition.get("guard")
        if guard == "require_assignee":
            if not assigned_to_id and not assigned_group_id and not work_item.assigned_to_id and not work_item.assigned_group_id:
                raise ValidationError("Assignment required: provide assigned_to_id or assigned_group_id")

        if guard == "require_resolution":
            if not resolution_code:
                raise ValidationError("Resolution code is required to resolve an incident")

        if guard == "require_plans":
            ext = work_item.change_extension
            if not ext or not ext.implementation_plan or not ext.backout_plan or not ext.validation_plan or not ext.implementation_plan.strip() or not ext.backout_plan.strip() or not ext.validation_plan.strip():
                raise ValidationError("Implementation, backout, and validation plans are required to request approval")

        if guard == "require_schedule_dates":
            ext = work_item.change_extension
            if not ext or not ext.scheduled_start or not ext.scheduled_end:
                raise ValidationError("Scheduled start and end dates are required to schedule the change")

        # ── Apply status change ──
        old_status = work_item.status
        new_status = transition["to_status"].value
        work_item.status = new_status

        # ── Apply assignment if provided ──
        if assigned_to_id:
            work_item.assigned_to_id = assigned_to_id
        if assigned_group_id:
            work_item.assigned_group_id = assigned_group_id

        # ── Apply timestamps ──
        now = datetime.now(timezone.utc)

        if new_status == IncidentStatus.RESOLVED.value:
            work_item.resolved_at = now
            # Update extension with resolution details
            if work_item.incident_extension:
                work_item.incident_extension.resolution_code = resolution_code
                work_item.incident_extension.resolution_note = resolution_note

        if new_status == IncidentStatus.CLOSED.value or new_status == ChangeStatus.CLOSED.value:
            work_item.closed_at = now

        if work_item.work_item_type == WorkItemType.CHANGE.value and new_status == ChangeStatus.COMPLETED.value:
            work_item.resolved_at = now

        # ── Audit ──
        audit_new_values = {
            "status": new_status,
            "action": action,
        }
        if comment:
            audit_new_values["transition_comment"] = comment
        if resolution_code:
            audit_new_values["resolution_code"] = resolution_code
        if assigned_to_id:
            audit_new_values["assigned_to_id"] = str(assigned_to_id)
        if assigned_group_id:
            audit_new_values["assigned_group_id"] = str(assigned_group_id)

        AuditService.log(
            db,
            entity_type="work_item",
            entity_id=work_item.id,
            action="status_changed",
            actor_id=user.id,
            actor_display=user.login,
            old_values={"status": old_status},
            new_values=audit_new_values,
        )

        # ── Side effects ──
        side_effects = transition.get("side_effects", [])
        for effect in side_effects:
            if effect == "sla_pause":
                SlaService.on_status_change(db, work_item, "pending_user")
            elif effect == "sla_resume":
                SlaService.on_status_change(db, work_item, "in_progress")
            elif effect == "sla_stop_resolution":
                SlaService.on_status_change(db, work_item, "resolved")
            elif effect == "sla_restart":
                SlaService.on_status_change(db, work_item, "reopen")
            elif effect == "notify_requester" and work_item.reported_by_id:
                NotificationService.dispatch(
                    db=db,
                    user_id=work_item.reported_by_id,
                    event_type="status_changed",
                    entity_id=work_item.id,
                    entity_type="work_item",
                    title=f"Ticket Updated: {work_item.display_id}",
                    message=f"Incident '{work_item.title}' transitioned to '{new_status}'."
                )
            elif effect == "notify_assignee" and work_item.assigned_to_id:
                NotificationService.dispatch(
                    db=db,
                    user_id=work_item.assigned_to_id,
                    event_type="status_changed",
                    entity_id=work_item.id,
                    entity_type="work_item",
                    title=f"Incident Assigned: {work_item.display_id}",
                    message=f"Incident '{work_item.title}' has been assigned/transitioned to you."
                )
            elif effect == "create_approvals":
                from app.services.approval_service import ApprovalService
                ApprovalService.request_approval(db, work_item.id)
            elif effect == "notify_change_manager" and work_item.reported_by_id:
                NotificationService.dispatch(
                    db=db,
                    user_id=work_item.reported_by_id,
                    event_type="status_changed",
                    entity_id=work_item.id,
                    entity_type="work_item",
                    title=f"Change Request Update: {work_item.display_id}",
                    message=f"Change Request '{work_item.title}' transitioned to '{new_status}'."
                )

        db.commit()
        db.refresh(work_item)
        return work_item
