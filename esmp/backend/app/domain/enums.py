"""
Domain enums for the ESMP Gen-1 application.
Single source of truth for all status, type, and classification values.
"""

import enum


class WorkItemType(str, enum.Enum):
    """Types of work items in Gen-1."""
    INCIDENT = "incident"
    CHANGE = "change"


class IncidentStatus(str, enum.Enum):
    """Incident lifecycle states (code-defined, not DB-configurable)."""
    NEW = "new"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    PENDING_USER = "pending_user"
    RESOLVED = "resolved"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class ChangeStatus(str, enum.Enum):
    """Change lifecycle states."""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    SCHEDULED = "scheduled"
    IMPLEMENTING = "implementing"
    COMPLETED = "completed"
    CLOSED = "closed"
    REJECTED = "rejected"


class Priority(int, enum.Enum):
    """Incident priority levels (P1 = most urgent)."""
    P1 = 1
    P2 = 2
    P3 = 3
    P4 = 4


class Urgency(int, enum.Enum):
    """Urgency dimension of the priority matrix."""
    HIGH = 1
    MEDIUM = 2
    LOW = 3


class Impact(int, enum.Enum):
    """Impact dimension of the priority matrix."""
    HIGH = 1
    MEDIUM = 2
    LOW = 3


class CommentVisibility(str, enum.Enum):
    """Who can see a comment."""
    PUBLIC = "public"
    INTERNAL = "internal"


class Source(str, enum.Enum):
    """How a work item was created."""
    PORTAL = "portal"
    EMAIL = "email"
    AGENT = "agent"


class ApprovalStatus(str, enum.Enum):
    """CAB approval decision status."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ApprovalDecision(str, enum.Enum):
    """Action an approver can take."""
    APPROVE = "approve"
    REJECT = "reject"


class ResolutionCode(str, enum.Enum):
    """Standard resolution codes for incident closure."""
    FIXED = "fixed"
    WORKAROUND = "workaround"
    KNOWN_ERROR = "known_error"
    CANNOT_REPRODUCE = "cannot_reproduce"
    USER_ERROR = "user_error"
    DUPLICATE = "duplicate"
    NOT_AN_ISSUE = "not_an_issue"
    OTHER = "other"


class RiskLevel(str, enum.Enum):
    """Change risk assessment level."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
