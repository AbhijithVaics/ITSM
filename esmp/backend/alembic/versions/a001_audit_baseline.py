"""audit_baseline

Revision ID: a001_audit_baseline
Revises: 66feb626d223
Create Date: 2026-06-24

Creates the audit schema and audit_logs table.
Also adds refresh_tokens table and timestamps to identity tables.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a001_audit_baseline'
down_revision: Union[str, Sequence[str]] = '66feb626d223'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Create audit schema ──
    op.execute("CREATE SCHEMA IF NOT EXISTS audit")

    # ── audit.audit_logs ──
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", sa.UUID(), nullable=False),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("actor_id", sa.UUID(), nullable=True),
        sa.Column("actor_display", sa.String(length=255), nullable=True),
        sa.Column("old_values", sa.JSON(), nullable=True),
        sa.Column("new_values", sa.JSON(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema="audit",
    )
    op.create_index(
        "ix_audit_logs_entity_type",
        "audit_logs",
        ["entity_type"],
        schema="audit",
    )
    op.create_index(
        "ix_audit_logs_entity_id",
        "audit_logs",
        ["entity_id"],
        schema="audit",
    )
    op.create_index(
        "ix_audit_logs_entity_type_entity_id_created_at",
        "audit_logs",
        ["entity_type", "entity_id", "created_at"],
        schema="audit",
    )

    # ── identity.refresh_tokens ──
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["identity.users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
        schema="identity",
    )
    op.create_index(
        "ix_identity_refresh_tokens_user_id",
        "refresh_tokens",
        ["user_id"],
        schema="identity",
    )

    # ── Add timestamps to identity.users ──
    op.add_column("users", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), schema="identity")
    op.add_column("users", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), schema="identity")
    op.add_column("users", sa.Column("soft_deleted_at", sa.DateTime(timezone=True), nullable=True), schema="identity")

    # ── Add timestamps + description to identity.groups ──
    op.add_column("groups", sa.Column("description", sa.String(length=500), nullable=True), schema="identity")
    op.add_column("groups", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), schema="identity")
    op.add_column("groups", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False), schema="identity")


def downgrade() -> None:
    # Remove timestamp columns from groups
    op.drop_column("groups", "updated_at", schema="identity")
    op.drop_column("groups", "created_at", schema="identity")
    op.drop_column("groups", "description", schema="identity")

    # Remove timestamp columns from users
    op.drop_column("users", "soft_deleted_at", schema="identity")
    op.drop_column("users", "updated_at", schema="identity")
    op.drop_column("users", "created_at", schema="identity")

    # Drop refresh_tokens
    op.drop_index("ix_identity_refresh_tokens_user_id", table_name="refresh_tokens", schema="identity")
    op.drop_table("refresh_tokens", schema="identity")

    # Drop audit tables
    op.drop_index("ix_audit_logs_entity_type_entity_id_created_at", table_name="audit_logs", schema="audit")
    op.drop_index("ix_audit_logs_entity_id", table_name="audit_logs", schema="audit")
    op.drop_index("ix_audit_logs_entity_type", table_name="audit_logs", schema="audit")
    op.drop_table("audit_logs", schema="audit")
    op.execute("DROP SCHEMA IF EXISTS audit CASCADE")
