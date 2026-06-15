export const ROLES = {
  ADMIN: 'ADMIN',
  AGENT: 'AGENT',
  MANAGER: 'MANAGER',
  CHANGE_MANAGER: 'CHANGE_MANAGER',
  USER: 'USER',
  READ_ONLY: 'READ_ONLY',
}

export const TICKET_TYPES = {
  INCIDENT: 'INCIDENT',
  SERVICE_REQUEST: 'SERVICE_REQUEST',
  CHANGE: 'CHANGE',
  PROBLEM: 'PROBLEM',
}

export const TICKET_PRIORITY = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
}

export const TICKET_URGENCY = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
}

export const TICKET_IMPACT = {
  DEPARTMENT: 1,
  SERVICE: 2,
  PERSON: 3,
}

export const TICKET_STATUS = {
  NEW: 'new',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  PENDING: 'pending',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
}

export const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

export const COMMENT_TYPE = {
  PUBLIC: 'public',
  PRIVATE: 'private',
}

export const PENDING_REASONS = {
  CUSTOMER: 'customer',
  SUPPLIER: 'supplier',
  EQUIPMENT: 'equipment',
  OTHER: 'other',
}

export const CI_RELATIONSHIP_TYPES = {
  DEPENDS_ON: 'depends_on',
  CONNECTS_TO: 'connects_to',
  IMPACTS: 'impacts',
  CONTAINS: 'contains',
  BACKUP: 'backup',
  CLUSTERED: 'clustered',
}
