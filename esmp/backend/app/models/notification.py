"""
SQLAlchemy models for in-app Notifications.
All tables live in the 'notification' PostgreSQL schema.
"""

import uuid
from sqlalchemy import Column, DateTime, ForeignKey, String, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class Notification(TimestampMixin, Base):
    """
    Tracks in-app notifications generated for users (e.g. ticket assignments, SLA breaches).
    """
    __tablename__ = "notifications"
    __table_args__ = {"schema": "notification"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)  # 'ticket_created' | 'assigned' | 'comment_added' | 'resolved' | 'sla_breach' | 'approval_requested'
    entity_id = Column(UUID(as_uuid=True), nullable=True)  # ID of the work_item, comment, etc.
    entity_type = Column(String(50), nullable=True)  # 'work_item' | 'comment'
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False)

    # Relationships
    user = relationship("User", lazy="joined")
