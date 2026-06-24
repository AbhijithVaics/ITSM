"""identity_baseline

Revision ID: 66feb626d223
Revises: 
Create Date: 2026-06-23 11:58:24.261685

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '66feb626d223'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the identity schema
    op.execute("CREATE SCHEMA IF NOT EXISTS identity")
    
    # Create users table
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("login", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("profile", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema="identity"
    )
    op.create_index("ix_identity_users_login", "users", ["login"], unique=True, schema="identity")
    op.create_index("ix_identity_users_email", "users", ["email"], unique=True, schema="identity")
    op.create_index("ix_identity_users_organization_id", "users", ["organization_id"], schema="identity")

    # Create groups table
    op.create_table(
        "groups",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False, server_default="assignment"),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", "organization_id", name="uq_group_name_org"),
        schema="identity"
    )
    op.create_index("ix_identity_groups_organization_id", "groups", ["organization_id"], schema="identity")

    # Create user_groups association table
    op.create_table(
        "user_groups",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("group_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["identity.users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["group_id"], ["identity.groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "group_id"),
        schema="identity"
    )


def downgrade() -> None:
    op.drop_table("user_groups", schema="identity")
    op.drop_index("ix_identity_groups_organization_id", table_name="groups", schema="identity")
    op.drop_table("groups", schema="identity")
    op.drop_index("ix_identity_users_organization_id", table_name="users", schema="identity")
    op.drop_index("ix_identity_users_email", table_name="users", schema="identity")
    op.drop_index("ix_identity_users_login", table_name="users", schema="identity")
    op.drop_table("users", schema="identity")
    op.execute("DROP SCHEMA IF EXISTS identity CASCADE")

