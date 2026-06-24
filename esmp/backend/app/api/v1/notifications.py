"""
Notifications API Router: endpoints to list, read, and clear in-app notifications.
"""

from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.identity import User
from app.schemas.notification import NotificationListResponse, NotificationResponse
from app.services.notification_service import NotificationService
from app.core.exceptions import NotFoundError

router = APIRouter()


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    unread_only: bool = Query(False, description="Filter for unread notifications only"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List in-app notifications for the logged-in user.
    """
    notifications, unread_count = NotificationService.list_for_user(
        db, current_user.id, unread_only=unread_only
    )
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }


@router.post("/{notification_id}/read", response_model=NotificationResponse)
def mark_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mark a notification as read.
    """
    notification = NotificationService.mark_as_read(db, current_user.id, notification_id)
    if not notification:
        raise NotFoundError("Notification not found or access denied")
    return notification


@router.post("/read-all")
def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mark all unread notifications as read.
    """
    count = NotificationService.mark_all_read(db, current_user.id)
    return {
        "message": f"Successfully marked {count} notifications as read",
        "count": count
    }
