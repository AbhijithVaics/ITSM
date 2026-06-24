"""
SQLAlchemy models for Change Approvals.
All tables live in the 'change' PostgreSQL schema.
"""

import uuid
from sqlalchemy import Column, DateTime, ForeignKey, String, Text, Index, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class Approval(TimestampMixin, Base):
    """
    Stores CAB member decisions for Change requests.
    """
    __tablename__ = "approvals"
    __table_args__ = (
        Index("ix_change_approvals_change_approver", "change_id", "approver_id", unique=True),
        {"schema": "change"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    change_id = Column(UUID(as_uuid=True), ForeignKey("work_item.work_items.id", ondelete="CASCADE"), nullable=False)
    approver_id = Column(UUID(as_uuid=True), ForeignKey("identity.users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # 'pending' | 'approved' | 'rejected'
    comment = Column(Text, nullable=True)
    responded_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    change = relationship("WorkItem", lazy="joined")
    approver = relationship("User", lazy="joined")
