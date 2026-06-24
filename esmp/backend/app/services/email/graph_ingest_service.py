"""
Graph ingest service: process inbound email notifications from Microsoft Graph.
"""

import re
import structlog
from typing import Optional
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.identity import User
from app.models.email import EmailMessage, EmailQuarantine
from app.models.work_item import WorkItem
from app.domain.enums import WorkItemType
from app.services.email.graph_client import graph_client
from app.services.email.email_thread_matcher import EmailThreadMatcher
from app.services.work_item_service import WorkItemService
from app.services.incident_service import IncidentService
from app.services.comment_service import CommentService

logger = structlog.get_logger()


class GraphIngestService:
    """
    Ingests and parses emails retrieved from the monitored inbox.
    Decides whether to attach a public comment to an existing ticket,
    create a new incident, or quarantine the email.
    """

    @staticmethod
    def is_auto_reply(subject: str, body: str) -> bool:
        """
        Detects if an email is an automatic out-of-office reply or receipt acknowledgement
        to prevent feedback loops.
        """
        subj_upper = subject.upper()
        
        # Check standard headers or subject keywords
        auto_patterns = [
            "AUTOMATIC REPLY:",
            "OUT OF OFFICE:",
            "AUTO-REPLY",
            "AUTOREPLY",
            "DELIVERY STATUS NOTIFICATION",
            "UNDELIVERABLE:",
            "AUTO: "
        ]
        for pattern in auto_patterns:
            if subj_upper.startswith(pattern) or pattern in subj_upper:
                return True
        return False

    @staticmethod
    def detect_type(subject: str) -> str:
        """
        Detect the type of ticket candidate based on keywords in the subject.
        """
        subj_upper = subject.upper()
        if "CHANGE" in subj_upper or "CHG" in subj_upper:
            return "change"
        return "incident"

    @staticmethod
    def process_message(db: Session, message_id: str) -> Optional[EmailMessage]:
        """
        Process a single message by ID. Fetches from Graph, performs threading checks,
        and modifies database state.
        """
        # 1. Fetch email payload
        from app.core.config import settings
        mailbox = settings.GRAPH_MAILBOX or "service-desk@company.com"
        
        try:
            msg = graph_client.get_message(mailbox, message_id)
        except Exception as e:
            logger.error("Failed to retrieve email details from Graph", message_id=message_id, error=str(e))
            return None

        internet_msg_id = msg.get("id") or message_id
        from_address = msg.get("from", {}).get("emailAddress", {}).get("address", "").strip()
        subject = msg.get("subject", "").strip()
        body = msg.get("body", {}).get("content", "").strip()
        
        # Fallback to bodyPreview if body is empty
        if not body:
            body = msg.get("bodyPreview", "").strip()

        # 2. Duplicate Detection
        existing_email = db.query(EmailMessage).filter(EmailMessage.message_id == internet_msg_id).first()
        if existing_email:
            logger.info("Skipping duplicate email message", message_id=internet_msg_id)
            return existing_email

        # 3. Auto-Reply Loop Protection
        if GraphIngestService.is_auto_reply(subject, body):
            logger.info("Quarantining auto-reply message", message_id=internet_msg_id)
            quarantine = EmailQuarantine(
                message_id=internet_msg_id,
                sender=from_address,
                subject=subject,
                reason="auto_reply_detected"
            )
            db.add(quarantine)
            db.commit()
            return None

        # 4. Search for User
        user = db.query(User).filter(User.email == from_address, User.is_active == True).first()
        if not user:
            logger.warn("Inbound email from unregistered or inactive user", sender=from_address)
            quarantine = EmailQuarantine(
                message_id=internet_msg_id,
                sender=from_address,
                subject=subject,
                reason="unregistered_user"
            )
            db.add(quarantine)
            db.commit()
            return None

        # 5. Thread Matching Strategy
        # Extract headers if available, or fetch them from the message properties
        # For simplicity, Graph client retrieves simple message attributes. In-Reply-To / References can be fetched if present.
        in_reply_to = msg.get("inReplyTo")
        references = msg.get("references")

        work_item = EmailThreadMatcher.match_thread(
            db,
            subject=subject,
            body=body,
            in_reply_to=in_reply_to,
            references=references
        )

        if work_item:
            # Check if user is authorized to view/comment on this work_item
            try:
                # Forces scoped permission checks on the matched work item
                WorkItemService.get_scoped(db, user, work_item.id)
            except (ForbiddenError, NotFoundError):
                logger.warn("Unauthorized attempt to comment via email", sender=from_address, display_id=work_item.display_id)
                quarantine = EmailQuarantine(
                    message_id=internet_msg_id,
                    sender=from_address,
                    subject=subject,
                    reason=f"unauthorized_access_to_{work_item.display_id}"
                )
                db.add(quarantine)
                db.commit()
                return None

            # User is authorized, append email body as public comment
            # Strip subject tags when writing comment text
            clean_text = body
            CommentService.add_comment(
                db,
                actor=user,
                work_item_id=work_item.id,
                text=clean_text,
                visibility="public"
            )
            logger.info("Added public comment from email", display_id=work_item.display_id, sender=from_address)
            
            # Record processed email
            email_msg = EmailMessage(
                message_id=internet_msg_id,
                work_item_id=work_item.id,
                sender=from_address,
                subject=subject,
                body_preview=body[:1000]
            )
            db.add(email_msg)
            db.commit()
            return email_msg

        else:
            # Strategy: Create new ticket
            # Requesters can only create Incidents via email (Changes require planning/CAB)
            ticket_type = GraphIngestService.detect_type(subject)
            
            if ticket_type == "change":
                # Regular employees cannot draft changes via email
                logger.warn("Unauthorized change creation attempt via email", sender=from_address)
                quarantine = EmailQuarantine(
                    message_id=internet_msg_id,
                    sender=from_address,
                    subject=subject,
                    reason="change_creation_unauthorized_via_email"
                )
                db.add(quarantine)
                db.commit()
                return None

            # Create incident
            new_incident = IncidentService.create_incident(
                db,
                actor=user,
                title=subject[:500],
                description=body,
                category="Other",
                subcategory="General Inquiry",
                urgency=3,  # Low
                impact=3,   # Low
                source="email"
            )
            logger.info("Created new incident from email", display_id=new_incident.display_id, sender=from_address)

            # Record processed email
            email_msg = EmailMessage(
                message_id=internet_msg_id,
                work_item_id=new_incident.id,
                sender=from_address,
                subject=subject,
                body_preview=body[:1000]
            )
            db.add(email_msg)
            db.commit()

            # Trigger async auto-acknowledgement task
            try:
                from app.workers.tasks_email import send_auto_ack
                send_auto_ack.delay(str(new_incident.id))
            except Exception as e:
                logger.error("Failed to enqueue auto-ack Celery task", work_item_id=str(new_incident.id), error=str(e))

            return email_msg
