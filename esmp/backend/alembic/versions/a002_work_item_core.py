"""work_item_core

Revision ID: a002_work_item_core
Revises: a001_audit_baseline
Create Date: 2026-06-24

Creates work_item schema with work_items and display_id_sequences tables.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a002_work_item_core'
down_revision: Union[str, Sequence[str]] = 'a001_audit_baseline'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Create work_item schema ──
    op.execute("CREATE SCHEMA IF NOT EXISTS work_item")

    # ── work_item.work_items ──
    op.create_table(
        "work_items",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("display_id", sa.String(length=30), nullable=False),
        sa.Column("work_item_type", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True, server_default=""),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("priority", sa.String(length=10), nullable=True),
        sa.Column("reported_by_id", sa.UUID(), nullable=True),
        sa.Column("assigned_to_id", sa.UUID(), nullable=True),
        sa.Column("assigned_group_id", sa.UUID(), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False, server_default="portal"),
        sa.Column("resolution_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("first_response_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("soft_deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["reported_by_id"], ["identity.users.id"]),
        sa.ForeignKeyConstraint(["assigned_to_id"], ["identity.users.id"]),
        sa.ForeignKeyConstraint(["assigned_group_id"], ["identity.groups.id"]),
        sa.PrimaryKeyConstraint("id"),
        schema="work_item",
    )
    # Indexes
    op.create_index("ix_wi_display_id", "work_items", ["display_id"], unique=True, schema="work_item")
    op.create_index("ix_wi_type", "work_items", ["work_item_type"], schema="work_item")
    op.create_index("ix_wi_status", "work_items", ["status"], schema="work_item")
    op.create_index("ix_wi_reported_by", "work_items", ["reported_by_id"], schema="work_item")
    op.create_index("ix_wi_assigned_to", "work_items", ["assigned_to_id"], schema="work_item")
    op.create_index("ix_wi_assigned_group", "work_items", ["assigned_group_id"], schema="work_item")
    op.create_index(
        "ix_wi_assigned_group_status_deadline",
        "work_items",
        ["assigned_group_id", "status", "resolution_deadline"],
        schema="work_item",
    )
    op.create_index(
        "ix_wi_type_status",
        "work_items",
        ["work_item_type", "status"],
        schema="work_item",
    )
    op.create_index(
        "ix_wi_reported_by_created",
        "work_items",
        ["reported_by_id", sa.text("created_at DESC")],
        schema="work_item",
    )

    # ── work_item.display_id_sequences ──
    op.create_table(
        "display_id_sequences",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("prefix", sa.String(length=10), nullable=False),
        sa.Column("date_part", sa.String(length=8), nullable=False),
        sa.Column("next_seq", sa.Integer(), nullable=False, server_default="1"),
        sa.PrimaryKeyConstraint("id"),
        schema="work_item",
    )
    op.create_index(
        "uq_display_id_seq",
        "display_id_sequences",
        ["prefix", "date_part"],
        unique=True,
        schema="work_item",
    )


def downgrade() -> None:
    op.drop_index("uq_display_id_seq", table_name="display_id_sequences", schema="work_item")
    op.drop_table("display_id_sequences", schema="work_item")

    op.drop_index("ix_wi_reported_by_created", table_name="work_items", schema="work_item")
    op.drop_index("ix_wi_type_status", table_name="work_items", schema="work_item")
    op.drop_index("ix_wi_assigned_group_status_deadline", table_name="work_items", schema="work_item")
    op.drop_index("ix_wi_assigned_group", table_name="work_items", schema="work_item")
    op.drop_index("ix_wi_assigned_to", table_name="work_items", schema="work_item")
    op.drop_index("ix_wi_reported_by", table_name="work_items", schema="work_item")
    op.drop_index("ix_wi_status", table_name="work_items", schema="work_item")
    op.drop_index("ix_wi_type", table_name="work_items", schema="work_item")
    op.drop_index("ix_wi_display_id", table_name="work_items", schema="work_item")
    op.drop_table("work_items", schema="work_item")
    op.execute("DROP SCHEMA IF EXISTS work_item CASCADE")
