"""
Notification Service: dispatches in-app and email notifications.
"""

from typing import List, Optional
from uuid import UUID
import structlog

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.notification import Notification
from app.models.identity import User

logger = structlog.get_logger()


class NotificationService:
    """
    Handles dispatching notifications in-app (to the notifications table)
    and triggering async tasks to send email notifications.
    """

    @staticmethod
    def dispatch(
        db: Session,
        user_id: UUID,
        event_type: str,
        entity_id: Optional[UUID],
        entity_type: Optional[str],
        title: str,
        message: str,
    ) -> Notification:
        """
        Creates and stores an in-app notification for a user.
        Also enqueues an asynchronous email notification task via Celery.
        """
        logger.info(
            "Dispatching notification",
            user_id=str(user_id),
            event_type=event_type,
            title=title
        )

        notification = Notification(
            user_id=user_id,
            event_type=event_type,
            entity_id=entity_id,
            entity_type=entity_type,
            title=title,
            message=message,
            is_read=False,
        )
        db.add(notification)
        db.flush()

        # Enqueue email task asynchronously if Celery is imported/active
        try:
            from app.workers.celery_app import celery_app
            # Trigger tasks_email send task
            celery_app.send_task(
                "app.workers.tasks_email.send_notification_email",
                args=[str(user_id), event_type, title, message],
            )
        except Exception as e:
            logger.warn("Failed to enqueue email notification task", error=str(e))

        return notification

    @staticmethod
    def list_for_user(
        db: Session,
        user_id: UUID,
        unread_only: bool = False
    ) -> tuple[List[Notification], int]:
        """
        Lists notifications for a user, returning the list and unread count.
        """
        query = db.query(Notification).filter(Notification.soft_deleted_at == None) if hasattr(Notification, "soft_deleted_at") else db.query(Notification)
        query = query.filter(Notification.user_id == user_id)

        unread_count = db.query(func.count(Notification.id)).filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).scalar()

        if unread_only:
            query = query.filter(Notification.is_read == False)

        notifications = query.order_by(Notification.created_at.desc()).limit(100).all()
        return notifications, unread_count

    @staticmethod
    def mark_as_read(db: Session, user_id: UUID, notification_id: UUID) -> Optional[Notification]:
        """
        Mark a specific notification as read.
        """
        notification = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id
        ).first()

        if notification:
            notification.is_read = True
            db.commit()
            db.refresh(notification)
        return notification

    @staticmethod
    def mark_all_read(db: Session, user_id: UUID) -> int:
        """
        Mark all unread notifications for a user as read.
        """
        unread_notifications = db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).all()

        for notification in unread_notifications:
            notification.is_read = True
        
        count = len(unread_notifications)
        db.commit()
        return count
