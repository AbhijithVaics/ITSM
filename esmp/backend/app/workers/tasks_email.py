"""
Celery asynchronous tasks for processing and sending email messages.
"""

from uuid import UUID
import structlog

from app.workers.celery_app import celery_app
from app.core.database import SessionLocal
from app.services.email.graph_ingest_service import GraphIngestService
from app.services.email.graph_send_service import GraphSendService

logger = structlog.get_logger()


@celery_app.task(name="app.workers.tasks_email.process_inbound_email")
def process_inbound_email(message_id: str) -> str:
    """
    Task to ingest and parse an inbound email notification.
    """
    logger.info("Starting inbound email processing task", message_id=message_id)
    db = SessionLocal()
    try:
        email_msg = GraphIngestService.process_message(db, message_id)
        if email_msg:
            return f"Processed email {message_id} mapped to work item {email_msg.work_item_id}"
        return f"Skipped or quarantined email {message_id}"
    except Exception as e:
        logger.error("Error in process_inbound_email task", message_id=message_id, error=str(e))
        db.rollback()
        raise e
    finally:
        db.close()


@celery_app.task(name="app.workers.tasks_email.send_auto_ack")
def send_auto_ack(work_item_id: str) -> str:
    """
    Task to dispatch the auto-acknowledgement email for a new ticket.
    """
    logger.info("Starting auto-acknowledgement dispatch task", work_item_id=work_item_id)
    db = SessionLocal()
    try:
        GraphSendService.send_auto_ack(db, UUID(work_item_id))
        return f"Sent auto-acknowledgement email for ticket {work_item_id}"
    except Exception as e:
        logger.error("Error in send_auto_ack task", work_item_id=work_item_id, error=str(e))
        db.rollback()
        raise e
    finally:
        db.close()


@celery_app.task(name="app.workers.tasks_email.send_notification_email")
def send_notification_email(user_id: str, event_type: str, title: str, message: str) -> str:
    """
    Task to send an email notification to a user.
    """
    logger.info("Starting email notification dispatch task", user_id=user_id, event_type=event_type)
    db = SessionLocal()
    try:
        from app.models.identity import User
        user = db.query(User).filter(User.id == UUID(user_id)).first()
        if not user or not user.email:
            logger.warn("Skipping email notification: User or email not found", user_id=user_id)
            return f"User {user_id} not found or email missing"
        
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #dddddd; border-radius: 8px;">
                <h2 style="color: #6366f1; border-bottom: 2px solid #6366f1; padding-bottom: 10px;">{title}</h2>
                <p>Hello <strong>{user.login}</strong>,</p>
                <p>{message}</p>
                
                <p>Please log in to the ESMP Portal to view details and take actions.</p>
                
                <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eeeeee; font-size: 12px; color: #6b7280;">
                    This is an automated message from the Enterprise Service Spine (ESMP).
                </div>
            </div>
        </body>
        </html>
        """
        GraphSendService.send_notification_email(user.email, title, html_body)
        return f"Sent email notification to {user.email}"
    except Exception as e:
        logger.error("Error in send_notification_email task", user_id=user_id, error=str(e))
        db.rollback()
        raise e
    finally:
        db.close()
