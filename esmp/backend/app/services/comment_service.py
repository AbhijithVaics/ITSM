"""
Comment service: manage public and internal comments on work items with scope-based RBAC.
"""

from typing import List
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ValidationError
from app.core.permissions import Role
from app.domain.enums import CommentVisibility
from app.models.comment import Comment
from app.models.identity import User
from app.services.audit_service import AuditService
from app.services.work_item_service import WorkItemService
from app.services.sla_service import SlaService
from app.services.notification_service import NotificationService


class CommentService:
    """
    Service layer for comments management.
    Enforces that:
    - Requesters can only view/add public comments on work items they have access to.
    - Agents and admins can view/add both public and internal comments.
    """

    @staticmethod
    def list_for_work_item(db: Session, actor: User, work_item_id: UUID) -> List[Comment]:
        """
        List comments on a work item.
        Requires the actor to have read scope for the work item.
        Filters out internal comments if the actor is a requester.
        """
        # Load and verify scoped access to work item
        WorkItemService.get_scoped(db, actor, work_item_id)

        query = db.query(Comment).filter(Comment.work_item_id == work_item_id)

        actor_role = actor.role.value if hasattr(actor.role, "value") else str(actor.role)

        # Requesters can only see public comments
        if actor_role == Role.REQUESTER.value:
            query = query.filter(Comment.visibility == CommentVisibility.PUBLIC.value)

        return query.order_by(Comment.created_at.asc()).all()

    @staticmethod
    def add_comment(
        db: Session,
        actor: User,
        work_item_id: UUID,
        text: str,
        visibility: CommentVisibility = CommentVisibility.PUBLIC,
    ) -> Comment:
        """
        Add a comment to a work item.
        Requires the actor to have access to the work item.
        Enforces that requesters cannot add internal comments.
        """
        # Load and verify scoped access to work item
        WorkItemService.get_scoped(db, actor, work_item_id)

        actor_role = actor.role.value if hasattr(actor.role, "value") else str(actor.role)

        # Requesters cannot add internal comments
        if actor_role == Role.REQUESTER.value and visibility == CommentVisibility.INTERNAL:
            raise ValidationError("Requesters are not authorized to create internal comments")

        comment = Comment(
            work_item_id=work_item_id,
            author_id=actor.id,
            text=text,
            visibility=visibility.value if hasattr(visibility, "value") else str(visibility),
        )
        db.add(comment)

        # Commit so comment gets an ID for audit trail
        db.flush()

        AuditService.log(
            db,
            entity_type="comment",
            entity_id=comment.id,
            action="created",
            actor_id=actor.id,
            actor_display=actor.login,
            new_values={
                "work_item_id": str(work_item_id),
                "visibility": comment.visibility,
                "text_preview": text[:50] + "..." if len(text) > 50 else text,
            },
        )

        # Trigger first response hook on SLA service
        SlaService.on_first_response(db, work_item_id, actor)

        db.commit()
        db.refresh(comment)

        # Dispatch comment notifications
        is_internal = comment.visibility == "internal"
        
        # If public comment, and author is not reporter, notify reporter
        if not is_internal and actor.id != work_item.reported_by_id:
            if work_item.reported_by_id:
                NotificationService.dispatch(
                    db=db,
                    user_id=work_item.reported_by_id,
                    event_type="comment_added",
                    entity_id=work_item.id,
                    entity_type="work_item",
                    title=f"New Comment on {work_item.display_id}",
                    message=f"A new public comment was added to your ticket: '{text[:60]}...'"
                )
        
        # If comment author is reporter, notify assignee or group
        if actor.id == work_item.reported_by_id:
            if work_item.assigned_to_id:
                NotificationService.dispatch(
                    db=db,
                    user_id=work_item.assigned_to_id,
                    event_type="comment_added",
                    entity_id=work_item.id,
                    entity_type="work_item",
                    title=f"New Comment on {work_item.display_id}",
                    message=f"The reporter added a comment: '{text[:60]}...'"
                )
            elif work_item.assigned_group_id:
                # Notify group members
                from app.models.identity import Group
                group = db.query(Group).filter(Group.id == work_item.assigned_group_id).first()
                if group and group.members:
                    for member in group.members:
                        NotificationService.dispatch(
                            db=db,
                            user_id=member.id,
                            event_type="comment_added",
                            entity_id=work_item.id,
                            entity_type="work_item",
                            title=f"New Group Comment: {work_item.display_id}",
                            message=f"A comment was added by the reporter: '{text[:60]}...'"
                        )
    
        # If internal comment and author is not assignee, notify assignee
        if is_internal and work_item.assigned_to_id and actor.id != work_item.assigned_to_id:
            NotificationService.dispatch(
                db=db,
                user_id=work_item.assigned_to_id,
                event_type="comment_added",
                entity_id=work_item.id,
                entity_type="work_item",
                title=f"New Internal Note: {work_item.display_id}",
                message=f"An internal comment was added by {actor.login}: '{text[:60]}...'"
            )

        return comment
