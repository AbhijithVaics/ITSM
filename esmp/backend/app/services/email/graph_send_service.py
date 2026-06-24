"""
Graph send service: handles outbound auto-acknowledgements and system email notifications.
"""

import structlog
from uuid import UUID
from sqlalchemy.orm import Session

from app.models.work_item import WorkItem
from app.services.email.graph_client import graph_client

logger = structlog.get_logger()


class GraphSendService:
    """
    Renders email templates and triggers outbound delivery via Microsoft Graph.
    """

    @staticmethod
    def send_auto_ack(db: Session, work_item_id: UUID) -> None:
        """
        Send an auto-acknowledgement email to the reporter of a newly created ticket.
        Includes ticket reference in the subject line to enable thread tracking.
        """
        work_item = db.query(WorkItem).filter(WorkItem.id == work_item_id).first()
        if not work_item:
            logger.error("Auto-ack failed: WorkItem not found", work_item_id=str(work_item_id))
            return

        reporter = work_item.reported_by
        if not reporter or not reporter.email:
            logger.warn("Auto-ack skipped: Reporter or reporter email missing", display_id=work_item.display_id)
            return

        subject = f"[{work_item.display_id}] Ticket Received: {work_item.title}"

        # Simple high-fidelity HTML email template
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #dddddd; border-radius: 8px;">
                <h2 style="color: #6366f1; border-bottom: 2px solid #6366f1; padding-bottom: 10px;">Support Request Acknowledged</h2>
                <p>Hello <strong>{reporter.login}</strong>,</p>
                <p>We have received your support request and registered it in our system.</p>
                
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eeeeee; font-weight: bold; width: 120px;">Ticket ID:</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eeeeee; font-family: monospace; font-size: 14px; color: #6366f1;">{work_item.display_id}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eeeeee; font-weight: bold;">Summary:</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eeeeee;">{work_item.title}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid #eeeeee; font-weight: bold;">Priority:</td>
                        <td style="padding: 8px; border-bottom: 1px solid #eeeeee;">{work_item.priority or "Not Assigned"}</td>
                    </tr>
                </table>

                <p>An IT Support Agent will review your request shortly. To add comments or upload attachments, you can reply directly to this email or visit the Self-Service Portal.</p>
                
                <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eeeeee; font-size: 12px; color: #6b7280;">
                    This is an automated message from the Enterprise Service Spine (ESMP). Please retain the ticket reference in the subject line of any reply.
                </div>
            </div>
        </body>
        </html>
        """

        try:
            graph_client.send_mail(to=reporter.email, subject=subject, body=html_body)
            logger.info("Outbound auto-acknowledgement email sent", display_id=work_item.display_id, recipient=reporter.email)
        except Exception as e:
            logger.error("Failed to send auto-acknowledgement email", display_id=work_item.display_id, error=str(e))

    @staticmethod
    def send_notification_email(to_email: str, subject: str, html_body: str) -> None:
        """
        Generic dispatcher for workflow notifications (assignee alerts, comment alerts, approvals).
        """
        try:
            graph_client.send_mail(to=to_email, subject=subject, body=html_body)
            logger.info("Workflow email notification sent", recipient=to_email, subject=subject)
        except Exception as e:
            logger.error("Failed to send workflow email notification", recipient=to_email, error=str(e))
