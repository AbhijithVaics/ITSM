"""
Microsoft Graph Email webhook endpoint.
Handles GET validation checks and POST change notifications.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
import structlog

from app.core.config import settings
from app.core.database import get_db
from app.models.email import GraphSubscription
from app.workers.tasks_email import process_inbound_email

logger = structlog.get_logger()
router = APIRouter()


class ResourceData(BaseModel):
    id: str
    odata_type: str = Field(default="#Microsoft.Graph.Message", alias="@odata.type")


class NotificationValue(BaseModel):
    subscriptionId: str
    clientState: Optional[str] = None
    changeType: str
    resource: str
    resourceData: ResourceData


class NotificationPayload(BaseModel):
    value: List[NotificationValue]


@router.get("", response_class=PlainTextResponse)
def validate_webhook(
    validationToken: Optional[str] = Query(default=None),
):
    """
    Microsoft Graph subscription validation endpoint.
    Graph sends a GET with a validationToken query param which must be returned immediately as plain text.
    """
    if validationToken:
        logger.info("Received Graph webhook validation request")
        return validationToken
    return "ESMP Graph Webhook Receiver"


@router.post("", status_code=202)
async def receive_notifications(
    payload: NotificationPayload,
    request: Request,
):
    """
    Microsoft Graph subscription notification endpoint.
    Processes webhook notifications, verifies clientState, and enqueues Celery tasks.
    Returns 202 Accepted immediately.
    """
    logger.info("Received Graph change notifications", notification_count=len(payload.value))
    
    # Process each notification in the batch
    for item in payload.value:
        # Validate clientState if secret is configured
        if settings.GRAPH_WEBHOOK_SECRET and item.clientState != settings.GRAPH_WEBHOOK_SECRET:
            logger.warn(
                "Invalid clientState in Graph notification. Skipping.",
                subscription_id=item.subscriptionId
            )
            continue

        message_id = item.resourceData.id
        logger.info("Enqueuing inbound email processing task", message_id=message_id, sub_id=item.subscriptionId)
        
        # Dispatch Celery task asynchronously
        process_inbound_email.delay(message_id)

    # Return 202 immediately to prevent Microsoft retry hooks
    return Response(status_code=202)
