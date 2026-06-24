"""
Approval Service: handles CAB member list assignment and decision handling.
"""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID
import structlog

from sqlalchemy.orm import Session

from app.core.exceptions import ValidationError, NotFoundError
from app.domain.enums import ChangeStatus, ApprovalStatus, ApprovalDecision
from app.models.identity import User, Group
from app.models.approval import Approval
from app.models.work_item import WorkItem
from app.services.audit_service import AuditService
from app.services.notification_service import NotificationService

logger = structlog.get_logger()


class ApprovalService:
    """
    Manages change approvals routing and decision state machine logic.
    """

    @staticmethod
    def request_approval(db: Session, work_item_id: UUID) -> None:
        """
        Creates approval records for all active CAB group members.
        """
        work_item = db.query(WorkItem).filter(WorkItem.id == work_item_id).first()
        if not work_item:
            raise ValidationError("Work item not found")

        # Find the CAB group
        cab_group = db.query(Group).filter(Group.type == "cab", Group.is_active == True).first()
        if not cab_group:
            # Fallback to any group named "CAB"
            cab_group = db.query(Group).filter(Group.name.ilike("%cab%"), Group.is_active == True).first()

        if not cab_group or not cab_group.members:
            raise ValidationError(
                "Cannot request approval: No CAB group members found. "
                "Please configure a Group of type 'cab' with members first."
            )

        logger.info(
            "Routing approval to CAB members",
            work_item_id=str(work_item_id),
            cab_group=cab_group.name,
            member_count=len(cab_group.members)
        )

        for member in cab_group.members:
            # Check if approval already exists
            existing = db.query(Approval).filter(
                Approval.change_id == work_item_id,
                Approval.approver_id == member.id
            ).first()
            if existing:
                existing.status = ApprovalStatus.PENDING.value
                existing.responded_at = None
                existing.comment = None
            else:
                approval = Approval(
                    change_id=work_item_id,
                    approver_id=member.id,
                    status=ApprovalStatus.PENDING.value,
                )
                db.add(approval)

            # In-app notification
            NotificationService.dispatch(
                db=db,
                user_id=member.id,
                event_type="approval_requested",
                entity_id=work_item_id,
                entity_type="work_item",
                title=f"Change Approval Required: {work_item.display_id}",
                message=f"Change Request '{work_item.title}' requires your review and approval decision."
            )

        db.flush()

    @staticmethod
    def list_pending_for_user(db: Session, user_id: UUID) -> List[Approval]:
        """
        List all pending approvals assigned to a CAB member.
        """
        return db.query(Approval).filter(
            Approval.approver_id == user_id,
            Approval.status == ApprovalStatus.PENDING.value
        ).all()

    @staticmethod
    def decide(
        db: Session,
        approver: User,
        approval_id: UUID,
        decision: ApprovalDecision,
        comment: Optional[str] = None
    ) -> Approval:
        """
        Submits an approval decision (approve or reject) by a CAB member.
        Transitions the change request state immediately:
        - Rejection -> transitions change to rejected
        - Approval -> transitions change to approved
        """
        approval = db.query(Approval).filter(Approval.id == approval_id).first()
        if not approval:
            raise NotFoundError("Approval request not found")

        if approval.approver_id != approver.id:
            raise ValidationError("You are not authorized to make a decision on this approval request")

        if approval.status != ApprovalStatus.PENDING.value:
            raise ValidationError(f"This approval request has already been resolved as '{approval.status}'")

        now = datetime.now(timezone.utc)
        status_value = ApprovalStatus.APPROVED.value if decision == ApprovalDecision.APPROVE else ApprovalStatus.REJECTED.value
        
        approval.status = status_value
        approval.comment = comment
        approval.responded_at = now

        # Audit
        AuditService.log(
            db,
            entity_type="approval",
            entity_id=approval.id,
            action="responded",
            actor_id=approver.id,
            actor_display=approver.login,
            new_values={
                "change_id": str(approval.change_id),
                "decision": status_value,
                "comment": comment,
            },
        )

        # Retrieve the change request
        change = db.query(WorkItem).filter(WorkItem.id == approval.change_id).first()
        if not change:
            raise ValidationError("Linked change request not found")

        # Apply state transitions directly
        old_status = change.status

        if decision == ApprovalDecision.REJECT:
            # Transition immediately to rejected
            change.status = ChangeStatus.REJECTED.value
            logger.info("Change rejected by CAB member", change_id=str(change.id), approver=approver.login)
            
            # Audit on change work_item
            AuditService.log(
                db,
                entity_type="work_item",
                entity_id=change.id,
                action="status_changed",
                actor_id=approver.id,
                actor_display=approver.login,
                old_values={"status": old_status},
                new_values={"status": ChangeStatus.REJECTED.value, "reason": f"CAB Rejection: {comment or ''}"},
            )

            # Notify change reporter/manager
            if change.reported_by_id:
                NotificationService.dispatch(
                    db=db,
                    user_id=change.reported_by_id,
                    event_type="approval_responded",
                    entity_id=change.id,
                    entity_type="work_item",
                    title=f"Change Rejected: {change.display_id}",
                    message=f"Change Request was rejected by CAB member {approver.login}. Comment: {comment or 'None'}"
                )

            # Cancel other pending approvals for this run
            other_pending = db.query(Approval).filter(
                Approval.change_id == change.id,
                Approval.status == ApprovalStatus.PENDING.value
            ).all()
            for p in other_pending:
                p.status = "cancelled"

        elif decision == ApprovalDecision.APPROVE:
            # Transition immediately to approved (any single CAB approval rule)
            change.status = ChangeStatus.APPROVED.value
            logger.info("Change approved by CAB member", change_id=str(change.id), approver=approver.login)

            # Audit on change work_item
            AuditService.log(
                db,
                entity_type="work_item",
                entity_id=change.id,
                action="status_changed",
                actor_id=approver.id,
                actor_display=approver.login,
                old_values={"status": old_status},
                new_values={"status": ChangeStatus.APPROVED.value, "reason": f"CAB Approved: {comment or ''}"},
            )

            # Notify change reporter/manager
            if change.reported_by_id:
                NotificationService.dispatch(
                    db=db,
                    user_id=change.reported_by_id,
                    event_type="approval_responded",
                    entity_id=change.id,
                    entity_type="work_item",
                    title=f"Change Approved: {change.display_id}",
                    message=f"Change Request was approved by CAB member {approver.login}."
                )

            # Update other pending approvals to cancelled since decision is reached
            other_pending = db.query(Approval).filter(
                Approval.change_id == change.id,
                Approval.status == ApprovalStatus.PENDING.value
            ).all()
            for p in other_pending:
                p.status = "cancelled"

        db.commit()
        db.refresh(approval)
        return approval
