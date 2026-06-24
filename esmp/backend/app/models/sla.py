"""
SQLAlchemy models for SLA Engine tracking.
All tables live in the 'sla' PostgreSQL schema.
"""

import uuid
from datetime import time, datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Time, Boolean, Index
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class BusinessCalendar(TimestampMixin, Base):
    """
    Org-specific business calendars (e.g. standard Mon-Fri 9-6).
    """
    __tablename__ = "business_calendars"
    __table_args__ = {"schema": "sla"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    timezone = Column(String(100), nullable=False, default="Asia/Kolkata")
    # Store days as array of ints: e.g. [1, 2, 3, 4, 5] where Mon=1, Sun=7/0.
    # To align with JS/Postgres getUTCDay() format: Sunday=0, Monday=1, ..., Saturday=6.
    working_days = Column(ARRAY(Integer), nullable=False, default=[1, 2, 3, 4, 5])
    start_time = Column(Time, nullable=False, default=time(9, 0))
    end_time = Column(Time, nullable=False, default=time(18, 0))
    is_default = Column(Boolean, nullable=False, default=False)

    # Relationships
    holidays = relationship("Holiday", back_populates="calendar", cascade="all, delete-orphan")


class Holiday(TimestampMixin, Base):
    """
    Org-specific holiday dates that are excluded from business hour calculations.
    """
    __tablename__ = "holidays"
    __table_args__ = {"schema": "sla"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    calendar_id = Column(UUID(as_uuid=True), ForeignKey("sla.business_calendars.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    date = Column(DateTime(timezone=False), nullable=False, unique=True, index=True)

    # Relationships
    calendar = relationship("BusinessCalendar", back_populates="holidays")


class SlaPolicy(TimestampMixin, Base):
    """
    SLA Policies mapping work_item_type + priority to response/resolution targets.
    """
    __tablename__ = "sla_policies"
    __table_args__ = {"schema": "sla"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    work_item_type = Column(String(20), nullable=False, default="incident")
    priority = Column(String(10), nullable=False)  # 'P1', 'P2', 'P3', 'P4'
    response_target_mins = Column(Integer, nullable=False)  # Time to response (TTO)
    resolution_target_mins = Column(Integer, nullable=False)  # Time to resolution (TTR)
    calendar_id = Column(UUID(as_uuid=True), ForeignKey("sla.business_calendars.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    calendar = relationship("BusinessCalendar")


class SlaClock(TimestampMixin, Base):
    """
    SLA Clock instance tracking targets for individual work items.
    """
    __tablename__ = "sla_clocks"
    __table_args__ = (
        Index("ix_sla_clocks_work_item_metric", "work_item_id", "metric"),
        {"schema": "sla"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_item_id = Column(UUID(as_uuid=True), ForeignKey("work_item.work_items.id", ondelete="CASCADE"), nullable=False)
    metric = Column(String(20), nullable=False)  # 'response' | 'resolution'
    status = Column(String(20), nullable=False, default="active")  # 'active' | 'paused' | 'stopped' | 'breached'
    started_at = Column(DateTime(timezone=True), nullable=False)
    paused_at = Column(DateTime(timezone=True), nullable=True)
    accumulated_active_mins = Column(Integer, nullable=False, default=0)
    deadline = Column(DateTime(timezone=True), nullable=False)
    breached_at = Column(DateTime(timezone=True), nullable=True)
    is_breached = Column(Boolean, nullable=False, default=False)

    # Relationships
    work_item = relationship("WorkItem", back_populates="sla_clocks", lazy="joined")
