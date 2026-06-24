"""
RBAC permissions module.
Defines the 5+1 role system and FastAPI dependency factories for authorization.
"""

import enum
from functools import wraps
from typing import List

from fastapi import Depends, HTTPException, status


class Role(str, enum.Enum):
    """Gen-1 roles — 5 business roles + admin."""
    REQUESTER = "requester"
    AGENT = "agent"
    MANAGER = "manager"
    CHANGE_MANAGER = "change_manager"
    CAB_MEMBER = "cab_member"
    ADMIN = "admin"


# ── RBAC matrix ──
# Maps each action to the set of roles that may perform it.
# Used by `require_roles()` for route-level checks.
# Service-level scope checks (e.g., "requester can only see own tickets") are
# enforced in the service layer, not here.

RBAC_MATRIX = {
    # Identity & admin
    "admin.users.read": {Role.ADMIN},
    "admin.users.write": {Role.ADMIN},
    "admin.groups.read": {Role.ADMIN},
    "admin.groups.write": {Role.ADMIN},
    "admin.sla.read": {Role.ADMIN},
    "admin.sla.write": {Role.ADMIN},
    "admin.graph.read": {Role.ADMIN},
    "admin.graph.write": {Role.ADMIN},
    "admin.audit.read": {Role.ADMIN, Role.MANAGER},

    # Work items
    "work_items.create": {Role.REQUESTER, Role.AGENT, Role.MANAGER, Role.CHANGE_MANAGER, Role.ADMIN},
    "work_items.read": {Role.REQUESTER, Role.AGENT, Role.MANAGER, Role.CHANGE_MANAGER, Role.CAB_MEMBER, Role.ADMIN},
    "work_items.update": {Role.AGENT, Role.MANAGER, Role.ADMIN},
    "work_items.assign": {Role.AGENT, Role.MANAGER, Role.ADMIN},

    # Incidents
    "incidents.create": {Role.REQUESTER, Role.AGENT, Role.MANAGER, Role.ADMIN},

    # Transitions (fine-grained checks live in workflow definitions)
    "transitions.execute": {Role.AGENT, Role.MANAGER, Role.CHANGE_MANAGER, Role.ADMIN},

    # Comments
    "comments.public": {Role.REQUESTER, Role.AGENT, Role.MANAGER, Role.CHANGE_MANAGER, Role.ADMIN},
    "comments.internal": {Role.AGENT, Role.MANAGER, Role.ADMIN},

    # Attachments
    "attachments.upload": {Role.REQUESTER, Role.AGENT, Role.MANAGER, Role.CHANGE_MANAGER, Role.ADMIN},
    "attachments.download": {Role.REQUESTER, Role.AGENT, Role.MANAGER, Role.CHANGE_MANAGER, Role.CAB_MEMBER, Role.ADMIN},

    # Changes
    "changes.create": {Role.CHANGE_MANAGER, Role.ADMIN},
    "changes.update": {Role.CHANGE_MANAGER, Role.ADMIN},

    # Approvals
    "approvals.read": {Role.CAB_MEMBER, Role.CHANGE_MANAGER, Role.ADMIN},
    "approvals.decide": {Role.CAB_MEMBER},

    # Dashboard
    "dashboard.read": {Role.AGENT, Role.MANAGER, Role.ADMIN},

    # Notifications
    "notifications.read": {Role.REQUESTER, Role.AGENT, Role.MANAGER, Role.CHANGE_MANAGER, Role.CAB_MEMBER, Role.ADMIN},

    # Search
    "search.query": {Role.REQUESTER, Role.AGENT, Role.MANAGER, Role.CHANGE_MANAGER, Role.CAB_MEMBER, Role.ADMIN},
}


def require_roles(*allowed_roles: Role):
    """
    FastAPI dependency factory.
    Returns a dependency that checks if the current user has one of the allowed roles.

    Usage:
        @router.get("/admin/users", dependencies=[Depends(require_roles(Role.ADMIN))])
        def list_users(...):
            ...
    """
    from app.core.security import get_current_user

    def _check_role(current_user=Depends(get_current_user)):
        user_role = current_user.role
        # Handle both enum and string role values
        if isinstance(user_role, str):
            user_role_value = user_role
        else:
            user_role_value = user_role.value

        allowed_values = {r.value if isinstance(r, Role) else r for r in allowed_roles}

        if user_role_value not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "type": "https://esmp.local/errors/forbidden",
                    "title": "Forbidden",
                    "status": 403,
                    "detail": f"Role '{user_role_value}' is not authorized for this action",
                },
            )
        return current_user

    return _check_role
