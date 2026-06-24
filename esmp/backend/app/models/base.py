"""
Shared SQLAlchemy declarative base and timestamp mixin for all ESMP models.
Every model in the application must inherit from `Base` defined here.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all ESMP ORM models."""
    pass


class TimestampMixin:
    """Mixin that adds created_at and updated_at columns to any model."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SoftDeleteMixin:
    """Mixin that adds a soft_deleted_at column for soft deletion."""

    soft_deleted_at = Column(DateTime(timezone=True), nullable=True, default=None)

    @property
    def is_deleted(self) -> bool:
        return self.soft_deleted_at is not None


def generate_uuid() -> uuid.UUID:
    """Generate a new UUID4 for use as a primary key."""
    return uuid.uuid4()
