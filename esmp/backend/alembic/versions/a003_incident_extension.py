"""incident_extension

Revision ID: a003_incident_extension
Revises: a002_work_item_core
Create Date: 2026-06-24

Creates the incident schema with incident_extensions table.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a003_incident_extension'
down_revision: Union[str, Sequence[str]] = 'a002_work_item_core'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Create incident schema ──
    op.execute("CREATE SCHEMA IF NOT EXISTS incident")

    # ── incident.incident_extensions ──
    op.create_table(
        "incident_extensions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("work_item_id", sa.UUID(), nullable=False),
        sa.Column("urgency", sa.Integer(), nullable=True),
        sa.Column("impact", sa.Integer(), nullable=True),
        sa.Column("category", sa.String(length=100), nullable=True),
        sa.Column("subcategory", sa.String(length=100), nullable=True),
        sa.Column("resolution_code", sa.String(length=50), nullable=True),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["work_item_id"], ["work_item.work_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("work_item_id"),
        schema="incident",
    )


def downgrade() -> None:
    op.drop_table("incident_extensions", schema="incident")
    op.execute("DROP SCHEMA IF EXISTS incident CASCADE")
