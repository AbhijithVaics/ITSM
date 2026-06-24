"""
SQLAlchemy models for Change Management.
All tables live in the 'change' PostgreSQL schema.
"""

import uuid
from sqlalchemy import Column, DateTime, ForeignKey, String, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class ChangeExtension(TimestampMixin, Base):
    """
    Extends the work_items spine with Change-specific attributes.
    """
    __tablename__ = "change_extensions"
    __table_args__ = {"schema": "change"}

    work_item_id = Column(UUID(as_uuid=True), ForeignKey("work_item.work_items.id", ondelete="CASCADE"), primary_key=True)
    risk_level = Column(String(20), nullable=False, default="low")  # 'low' | 'medium' | 'high' | 'critical'
    expedited = Column(Boolean, nullable=False, default=False)
    scheduled_start = Column(DateTime(timezone=True), nullable=True)
    scheduled_end = Column(DateTime(timezone=True), nullable=True)
    implementation_plan = Column(Text, nullable=True)
    backout_plan = Column(Text, nullable=True)
    validation_plan = Column(Text, nullable=True)

    # Relationships
    work_item = relationship("WorkItem", back_populates="change_extension", lazy="joined")
