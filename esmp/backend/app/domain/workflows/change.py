"""
Change workflow definition (code-defined state machine).
"""

from app.core.permissions import Role
from app.domain.enums import ChangeStatus


# Terminal statuses
TERMINAL_STATUSES = {ChangeStatus.CLOSED}

# Initial status for new changes
INITIAL_STATUS = ChangeStatus.DRAFT

# ── Transition definitions ──
CHANGE_TRANSITIONS = {
    "submit": {
        "from_status": {ChangeStatus.DRAFT, ChangeStatus.REJECTED},
        "to_status": ChangeStatus.SUBMITTED,
        "allowed_roles": {Role.AGENT, Role.MANAGER, Role.CHANGE_MANAGER, Role.ADMIN},
        "guard": None,
        "side_effects": ["audit"],
        "description": "Submit change request for review",
    },
    "request_approval": {
        "from_status": {ChangeStatus.SUBMITTED},
        "to_status": ChangeStatus.PENDING_APPROVAL,
        "allowed_roles": {Role.AGENT, Role.MANAGER, Role.CHANGE_MANAGER, Role.ADMIN},
        "guard": "require_plans",
        "side_effects": ["audit", "create_approvals"],
        "description": "Request CAB review and approvals",
    },
    "approve": {
        "from_status": {ChangeStatus.PENDING_APPROVAL},
        "to_status": ChangeStatus.APPROVED,
        "allowed_roles": {Role.CHANGE_MANAGER, Role.ADMIN},  # Typically triggered by system approval logic
        "guard": None,
        "side_effects": ["audit", "notify_change_manager"],
        "description": "CAB approved the change request",
    },
    "reject": {
        "from_status": {ChangeStatus.PENDING_APPROVAL},
        "to_status": ChangeStatus.REJECTED,
        "allowed_roles": {Role.CHANGE_MANAGER, Role.ADMIN},  # Typically triggered by system rejection logic
        "guard": None,
        "side_effects": ["audit", "notify_change_manager"],
        "description": "CAB rejected the change request",
    },
    "schedule": {
        "from_status": {ChangeStatus.APPROVED},
        "to_status": ChangeStatus.SCHEDULED,
        "allowed_roles": {Role.CHANGE_MANAGER, Role.ADMIN},
        "guard": "require_schedule_dates",
        "side_effects": ["audit"],
        "description": "Schedule the approved change implementation window",
    },
    "start_implementation": {
        "from_status": {ChangeStatus.SCHEDULED},
        "to_status": ChangeStatus.IMPLEMENTING,
        "allowed_roles": {Role.AGENT, Role.MANAGER, Role.CHANGE_MANAGER, Role.ADMIN},
        "guard": None,
        "side_effects": ["audit"],
        "description": "Begin implementation activities",
    },
    "complete": {
        "from_status": {ChangeStatus.IMPLEMENTING},
        "to_status": ChangeStatus.COMPLETED,
        "allowed_roles": {Role.AGENT, Role.MANAGER, Role.CHANGE_MANAGER, Role.ADMIN},
        "guard": None,
        "side_effects": ["audit"],
        "description": "Complete implementation and verification tests",
    },
    "close": {
        "from_status": {ChangeStatus.COMPLETED},
        "to_status": ChangeStatus.CLOSED,
        "allowed_roles": {Role.CHANGE_MANAGER, Role.ADMIN},
        "guard": None,
        "side_effects": ["audit"],
        "description": "Close change request",
    },
    "reopen_as_draft": {
        "from_status": {ChangeStatus.REJECTED, ChangeStatus.COMPLETED},
        "to_status": ChangeStatus.DRAFT,
        "allowed_roles": {Role.AGENT, Role.MANAGER, Role.CHANGE_MANAGER, Role.ADMIN},
        "guard": None,
        "side_effects": ["audit"],
        "description": "Reopen change request as draft for revision",
    },
}


def get_available_actions(current_status: ChangeStatus, user_role: Role) -> list[str]:
    """
    Returns available change transition action names for the given status and role.
    """
    available = []
    for action_name, transition in CHANGE_TRANSITIONS.items():
        if current_status in transition["from_status"]:
            role_values = {r.value if isinstance(r, Role) else r for r in transition["allowed_roles"]}
            user_role_value = user_role.value if isinstance(user_role, Role) else user_role
            if user_role_value in role_values:
                available.append(action_name)
    return available


def validate_transition(
    current_status: ChangeStatus,
    action: str,
    user_role: Role,
) -> dict:
    """
    Validates that a transition is allowed.
    Returns transition definition if valid, else raises ValueError.
    """
    transition = CHANGE_TRANSITIONS.get(action)
    if not transition:
        raise ValueError(f"Unknown action '{action}' for changes")

    if current_status not in transition["from_status"]:
        raise ValueError(
            f"Cannot '{action}' from status '{current_status.value}'. "
            f"Allowed from: {[s.value for s in transition['from_status']]}"
        )

    role_values = {r.value if isinstance(r, Role) else r for r in transition["allowed_roles"]}
    user_role_value = user_role.value if isinstance(user_role, Role) else user_role
    if user_role_value not in role_values:
        raise ValueError(
            f"Role '{user_role_value}' is not authorized for '{action}' transition"
        )

    return transition
