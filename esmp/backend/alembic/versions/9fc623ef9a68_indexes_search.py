"""indexes_search

Revision ID: 9fc623ef9a68
Revises: b426c5df7089
Create Date: 2026-06-24 16:59:17.983383

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9fc623ef9a68'
down_revision: Union[str, Sequence[str], None] = 'b426c5df7089'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Index on work_items.title for faster ILIKE matching
    op.create_index("ix_wi_title", "work_items", ["title"], schema="work_item")
    # Index on work_items.created_at for pagination and default sorting
    op.create_index("ix_wi_created_at", "work_items", ["created_at"], schema="work_item")

    # Indexes on audit_logs for list view filters and sorting
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"], schema="audit")
    op.create_index("ix_audit_logs_actor_created", "audit_logs", ["actor_id", "created_at"], schema="audit")

    # Indexes on sla_clocks for SLA cron search checking and dashboard summaries
    op.create_index("ix_sla_clocks_status_deadline", "sla_clocks", ["status", "deadline"], schema="sla")
    op.create_index("ix_sla_clocks_is_breached", "sla_clocks", ["is_breached"], schema="sla")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_sla_clocks_is_breached", table_name="sla_clocks", schema="sla")
    op.drop_index("ix_sla_clocks_status_deadline", table_name="sla_clocks", schema="sla")
    op.drop_index("ix_audit_logs_actor_created", table_name="audit_logs", schema="audit")
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs", schema="audit")
    op.drop_index("ix_wi_created_at", table_name="work_items", schema="work_item")
    op.drop_index("ix_wi_title", table_name="work_items", schema="work_item")
