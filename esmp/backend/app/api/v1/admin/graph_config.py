"""
Admin Microsoft Graph config API router.
Enables administrators to view active email monitoring configurations and trigger manual webhook registrations.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import structlog

from app.core.database import get_db
from app.core.permissions import Role, require_roles
from app.core.config import settings
from app.models.identity import User
from app.models.email import GraphSubscription
from app.services.email.graph_client import graph_client

logger = structlog.get_logger()
router = APIRouter()


@router.get("/config")
def get_graph_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Role.ADMIN)),
):
    """
    Retrieve current MS Graph email monitoring status.
    """
    # Find most recent active subscription
    active_sub = (
        db.query(GraphSubscription)
        .order_by(GraphSubscription.created_at.desc())
        .first()
    )

    return {
        "tenant_id": settings.GRAPH_TENANT_ID,
        "client_id": settings.GRAPH_CLIENT_ID,
        "mailbox": settings.GRAPH_MAILBOX or "service-desk@company.com",
        "webhook_url": settings.GRAPH_WEBHOOK_URL,
        "is_mock_mode": graph_client.is_mock,
        "active_subscription": {
            "id": active_sub.id,
            "subscription_id": active_sub.subscription_id,
            "mailbox": active_sub.mailbox,
            "resource": active_sub.resource,
            "expires_at": active_sub.expires_at,
            "created_at": active_sub.created_at,
        }
        if active_sub
        else None,
    }


@router.post("/config/subscribe")
def trigger_subscribe(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Role.ADMIN)),
):
    """
    Register a new webhook subscription with MS Graph and save it to the database.
    """
    mailbox = settings.GRAPH_MAILBOX or "service-desk@company.com"
    webhook_url = settings.GRAPH_WEBHOOK_URL
    client_state = settings.GRAPH_WEBHOOK_SECRET or "esmp-secret-state"

    if not webhook_url:
        raise HTTPException(
            status_code=400,
            detail="Cannot register webhook: ESMP_GRAPH_WEBHOOK_URL is not configured.",
        )

    try:
        logger.info("Registering webhook subscription with MS Graph", mailbox=mailbox, url=webhook_url)
        result = graph_client.create_subscription(mailbox, webhook_url, client_state)

        # Parse expires_at date
        exp_date_str = result["expirationDateTime"].replace("Z", "+00:00")
        expires_at = datetime_datetime_from_iso(exp_date_str)

        subscription = GraphSubscription(
            subscription_id=result["id"],
            mailbox=mailbox,
            resource=result["resource"],
            expires_at=expires_at,
            client_state=client_state,
        )
        db.add(subscription)
        db.commit()
        db.refresh(subscription)

        return {
            "message": "Subscription successfully registered with Microsoft Graph.",
            "subscription_id": subscription.subscription_id,
            "expires_at": subscription.expires_at,
        }

    except Exception as e:
        logger.error("Failed to register Microsoft Graph webhook subscription", error=str(e))
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Graph subscription registration failed: {str(e)}",
        )


def datetime_datetime_from_iso(iso_str: str):
    """Parse ISO timestamp helper."""
    import datetime
    return datetime.datetime.fromisoformat(iso_str)
