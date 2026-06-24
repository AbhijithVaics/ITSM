import React from "react";

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getLabelAndClass = (s: string) => {
    switch (s.toLowerCase()) {
      case "new":
        return { label: "New", className: "status-new" };
      case "assigned":
        return { label: "Assigned", className: "status-assigned" };
      case "in_progress":
        return { label: "In Progress", className: "status-in_progress" };
      case "pending_user":
        return { label: "Pending User", className: "status-pending_user" };
      case "resolved":
        return { label: "Resolved", className: "status-resolved" };
      case "closed":
        return { label: "Closed", className: "status-closed" };
      case "cancelled":
        return { label: "Cancelled", className: "status-cancelled" };
      case "draft":
        return { label: "Draft", className: "status-closed" };
      case "submitted":
        return { label: "Submitted", className: "status-new" };
      case "pending_approval":
        return { label: "Pending Approval", className: "status-pending_user" };
      case "approved":
        return { label: "Approved", className: "status-assigned" };
      case "scheduled":
        return { label: "Scheduled", className: "status-in_progress" };
      case "implementing":
        return { label: "Implementing", className: "status-assigned" };
      case "completed":
        return { label: "Completed", className: "status-resolved" };
      case "rejected":
        return { label: "Rejected", className: "status-cancelled" };
      default:
        return { label: s.toUpperCase(), className: "status-closed" };
    }
  };

  const { label, className } = getLabelAndClass(status);

  return <span className={`badge ${className}`}>{label}</span>;
};

interface PriorityBadgeProps {
  priority: string | number | null | undefined;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  if (priority === null || priority === undefined) {
    return <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>;
  }

  const pStr = String(priority);
  const getLabelAndClass = (p: string) => {
    if (p.includes("1") || p.toLowerCase().includes("p1")) {
      return { label: "P1 - Critical", className: "priority-p1" };
    }
    if (p.includes("2") || p.toLowerCase().includes("p2")) {
      return { label: "P2 - High", className: "priority-p2" };
    }
    if (p.includes("3") || p.toLowerCase().includes("p3")) {
      return { label: "P3 - Medium", className: "priority-p3" };
    }
    return { label: "P4 - Low", className: "priority-p4" };
  };

  const { label, className } = getLabelAndClass(pStr);

  return <span className={`badge ${className}`}>{label}</span>;
};
