"""
Incident workflow definition (code-defined state machine).
Ported from server/src/config/stateMachines.js — incident transitions.

Each transition specifies:
  - from_status: the status the work item must be in (or '*' for any non-terminal)
  - to_status: the status it transitions to
  - action: the action name used in the API
  - allowed_roles: which roles can execute this transition
  - guard: optional callable name for additional pre-checks
  - side_effects: list of side effect identifiers to invoke post-transition
"""

from app.core.permissions import Role
from app.domain.enums import IncidentStatus


# Terminal statuses — no transitions out of these
TERMINAL_STATUSES = {IncidentStatus.CLOSED, IncidentStatus.CANCELLED}

# Initial status for new incidents
INITIAL_STATUS = IncidentStatus.NEW

# ── Transition definitions ──
INCIDENT_TRANSITIONS = {
    "assign": {
        "from_status": {IncidentStatus.NEW, IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS},
        "to_status": IncidentStatus.ASSIGNED,
        "allowed_roles": {Role.AGENT, Role.MANAGER, Role.ADMIN},
        "guard": "require_assignee",
        "side_effects": ["audit", "notify_assignee"],
        "description": "Assign or reassign the incident to an agent/group",
    },
    "start_work": {
        "from_status": {IncidentStatus.ASSIGNED},
        "to_status": IncidentStatus.IN_PROGRESS,
        "allowed_roles": {Role.AGENT, Role.MANAGER, Role.ADMIN},
        "guard": None,
        "side_effects": ["audit", "sla_resume"],
        "description": "Begin working on the incident",
    },
    "pending_user": {
        "from_status": {IncidentStatus.IN_PROGRESS, IncidentStatus.ASSIGNED},
        "to_status": IncidentStatus.PENDING_USER,
        "allowed_roles": {Role.AGENT, Role.MANAGER, Role.ADMIN},
        "guard": None,
        "side_effects": ["audit", "sla_pause", "notify_requester"],
        "description": "Waiting for user response — pauses resolution SLA",
    },
    "resume": {
        "from_status": {IncidentStatus.PENDING_USER},
        "to_status": IncidentStatus.IN_PROGRESS,
        "allowed_roles": {Role.AGENT, Role.MANAGER, Role.ADMIN, Role.REQUESTER},
        "guard": None,
        "side_effects": ["audit", "sla_resume"],
        "description": "User responded — resume SLA clocks",
    },
    "resolve": {
        "from_status": {IncidentStatus.IN_PROGRESS, IncidentStatus.ASSIGNED},
        "to_status": IncidentStatus.RESOLVED,
        "allowed_roles": {Role.AGENT, Role.MANAGER, Role.ADMIN},
        "guard": "require_resolution",
        "side_effects": ["audit", "sla_stop_resolution", "notify_requester"],
        "description": "Mark the incident as resolved",
    },
    "close": {
        "from_status": {IncidentStatus.RESOLVED},
        "to_status": IncidentStatus.CLOSED,
        "allowed_roles": {Role.AGENT, Role.MANAGER, Role.ADMIN, Role.REQUESTER},
        "guard": None,
        "side_effects": ["audit"],
        "description": "Close the resolved incident",
    },
    "reopen": {
        "from_status": {IncidentStatus.RESOLVED, IncidentStatus.CLOSED},
        "to_status": IncidentStatus.IN_PROGRESS,
        "allowed_roles": {Role.AGENT, Role.MANAGER, Role.ADMIN, Role.REQUESTER},
        "guard": None,
        "side_effects": ["audit", "sla_restart", "notify_assignee"],
        "description": "Reopen a resolved/closed incident",
    },
    "cancel": {
        "from_status": {IncidentStatus.NEW, IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS, IncidentStatus.PENDING_USER},
        "to_status": IncidentStatus.CANCELLED,
        "allowed_roles": {Role.MANAGER, Role.ADMIN},
        "guard": None,
        "side_effects": ["audit", "sla_stop_resolution", "notify_requester"],
        "description": "Cancel the incident",
    },
}


def get_available_actions(current_status: IncidentStatus, user_role: Role) -> list[str]:
    """
    Returns the list of action names available for the given status and role.
    """
    available = []
    for action_name, transition in INCIDENT_TRANSITIONS.items():
        if current_status in transition["from_status"]:
            role_values = {r.value if isinstance(r, Role) else r for r in transition["allowed_roles"]}
            user_role_value = user_role.value if isinstance(user_role, Role) else user_role
            if user_role_value in role_values:
                available.append(action_name)
    return available


def validate_transition(
    current_status: IncidentStatus,
    action: str,
    user_role: Role,
) -> dict:
    """
    Validates that a transition is allowed.
    Returns the transition definition if valid.
    Raises ValueError if invalid.
    """
    transition = INCIDENT_TRANSITIONS.get(action)
    if not transition:
        raise ValueError(f"Unknown action '{action}' for incidents")

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
