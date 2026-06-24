"""
Email domain models for MS Graph integration.
All tables live in the 'email' PostgreSQL schema.
"""

import uuid
from sqlalchemy import Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class EmailMessage(Base):
    """
    Tracks processed inbound emails mapped to work items.
    Prevents duplicate processing by checking message_id uniqueness.
    """
    __tablename__ = "email_messages"
    __table_args__ = {"schema": "email"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(String(255), unique=True, nullable=False, index=True)
    work_item_id = Column(UUID(as_uuid=True), ForeignKey("work_item.work_items.id", ondelete="SET NULL"), nullable=True, index=True)
    sender = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=False)
    body_preview = Column(Text, nullable=True)
    received_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    work_item = relationship("WorkItem", lazy="joined")


class EmailQuarantine(Base):
    """
    Tracks emails quarantined due to parsing errors, unauthorized senders,
    or lack of valid reference in a comment thread.
    """
    __tablename__ = "email_quarantine"
    __table_args__ = {"schema": "email"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(String(255), nullable=True, index=True)
    sender = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=False)
    reason = Column(String(500), nullable=False)
    received_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class GraphSubscription(Base):
    """
    Tracks active Microsoft Graph change notification subscriptions.
    Daily Celery cron tasks verify subscription expiry and issue renewals.
    """
    __tablename__ = "graph_subscriptions"
    __table_args__ = {"schema": "email"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subscription_id = Column(String(100), unique=True, nullable=False, index=True)
    mailbox = Column(String(255), nullable=False)
    resource = Column(String(255), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    client_state = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
