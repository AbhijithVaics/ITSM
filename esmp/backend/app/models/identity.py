"""
Identity domain models: User, Group, UserGroup, RefreshToken.
All tables live in the 'identity' PostgreSQL schema.
"""

import uuid
import enum
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, String, Table,
    UniqueConstraint, Enum, func, Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin


class UserRole(str, enum.Enum):
    """Gen-1 roles: 5 business roles + admin."""
    ADMIN = "admin"
    AGENT = "agent"
    MANAGER = "manager"
    CHANGE_MANAGER = "change_manager"
    CAB_MEMBER = "cab_member"
    REQUESTER = "requester"


# Many-to-Many association table for Users ↔ Groups
user_groups = Table(
    "user_groups",
    Base.metadata,
    Column(
        "user_id",
        UUID(as_uuid=True),
        ForeignKey("identity.users.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "group_id",
        UUID(as_uuid=True),
        ForeignKey("identity.groups.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    schema="identity",
)


class User(TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "identity"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    login = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole, native_enum=False), nullable=False, default=UserRole.REQUESTER)
    is_active = Column(Boolean, default=True, nullable=False)
    profile = Column(JSONB, default=dict, nullable=False, server_default="{}")
    organization_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    soft_deleted_at = Column(DateTime(timezone=True), nullable=True, default=None)

    # Relationships
    groups = relationship("Group", secondary=user_groups, back_populates="members")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")


class Group(TimestampMixin, Base):
    __tablename__ = "groups"
    __table_args__ = (
        UniqueConstraint("name", "organization_id", name="uq_group_name_org"),
        {"schema": "identity"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    type = Column(String(50), nullable=False, default="assignment")  # 'assignment' | 'cab'
    organization_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    members = relationship("User", secondary=user_groups, back_populates="groups")


class RefreshToken(Base):
    """
    Stores refresh tokens with rotation support.
    On each refresh, the old token is invalidated and a new one issued.
    """
    __tablename__ = "refresh_tokens"
    __table_args__ = {"schema": "identity"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("identity.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash = Column(String(255), nullable=False, unique=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationship
    user = relationship("User", back_populates="refresh_tokens")
