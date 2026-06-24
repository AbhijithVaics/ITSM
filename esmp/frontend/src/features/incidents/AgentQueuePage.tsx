import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../api/client";
import { StatusBadge, PriorityBadge } from "../../components/Badges";
import { 
  Search, 
  Filter, 
  RefreshCw, 
  ChevronRight, 
  AlertTriangle, 
  UserCheck, 
  Clock, 
  CheckCircle,
  FolderOpen
} from "lucide-react";

interface UserBrief {
  id: string;
  login: string;
  email: string;
}

interface GroupBrief {
  id: string;
  name: string;
}

interface TicketItem {
  id: string;
  display_id: string;
  work_item_type: string;
  title: string;
  description: string;
  status: string;
  priority: string | null;
  reported_by: UserBrief | null;
  assigned_to: UserBrief | null;
  assigned_group: GroupBrief | null;
  resolution_deadline: string | null;
  first_response_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TicketListResponse {
  items: TicketItem[];
  next_cursor: string | null;
}

interface GroupMember {
  id: string;
  login: string;
  email: string;
  role: string;
}

interface GroupResponse {
  id: string;
  name: string;
  description: string | null;
  type: string;
  is_active: boolean;
  members: GroupMember[];
}

export const AgentQueuePage: React.FC = () => {
  const navigate = useNavigate();

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [selectedType, setSelectedType] = useState("");
  
  // Pagination State (Keyset Pagination Stack)
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([]);

  // Fetch Assignment Groups (agents have permissions for /admin/groups)
  const { data: groups = [] } = useQuery<GroupResponse[]>({
    queryKey: ["groups"],
    queryFn: () => apiRequest<GroupResponse[]>("/admin/groups?is_active=true"),
  });

  // Re-fetch tickets when filters or cursor changes
  const queryParams = new URLSearchParams();
  if (selectedType) queryParams.append("work_item_type", selectedType);
  if (selectedStatus) queryParams.append("status", selectedStatus);
  if (selectedGroup) queryParams.append("assigned_group_id", selectedGroup);
  if (selectedAssignee) queryParams.append("assigned_to_id", selectedAssignee);
  if (searchTerm) queryParams.append("q", searchTerm);
  if (cursor) queryParams.append("cursor", cursor);
  queryParams.append("limit", "15");

  const { data, isLoading, error, refetch, isFetching } = useQuery<TicketListResponse>({
    queryKey: ["agent-queue", selectedType, selectedStatus, selectedGroup, selectedAssignee, searchTerm, cursor],
    queryFn: () => apiRequest<TicketListResponse>(`/work-items?${queryParams.toString()}`),
  });

  const tickets = data?.items || [];
  const nextCursor = data?.next_cursor || null;

  // Reset cursor stack on filter change
  useEffect(() => {
    setCursor(null);
    setCursorStack([]);
  }, [selectedType, selectedStatus, selectedGroup, selectedAssignee, searchTerm]);

  // Handle pagination navigation
  const handleNextPage = () => {
    if (nextCursor) {
      setCursorStack(prev => [...prev, cursor]);
      setCursor(nextCursor);
    }
  };

  const handlePrevPage = () => {
    if (cursorStack.length > 0) {
      const prevStack = [...cursorStack];
      const prevCursor = prevStack.pop() || null;
      setCursorStack(prevStack);
      setCursor(prevCursor);
    }
  };

  // Get active members for assignee selection based on selected group
  const activeGroupObj = groups.find(g => g.id === selectedGroup);
  const availableAssignees = activeGroupObj ? activeGroupObj.members : [];

  // Reset assignee filter if the group filter changes and assignee is not in that group
  useEffect(() => {
    if (selectedGroup && selectedAssignee) {
      const isMember = availableAssignees.some(m => m.id === selectedAssignee);
      if (!isMember) {
        setSelectedAssignee("");
      }
    }
  }, [selectedGroup, availableAssignees, selectedAssignee]);

  // SLA breach checker / countdown renderer helper
  const renderSla = (ticket: TicketItem) => {
    if (!ticket.resolution_deadline) return <span style={{ color: "var(--text-muted)" }}>—</span>;
    if (["resolved", "closed", "cancelled"].includes(ticket.status.toLowerCase())) {
      return <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Completed</span>;
    }

    const deadline = new Date(ticket.resolution_deadline);
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    const isBreached = diffMs < 0;

    if (isBreached) {
      return (
        <span style={{ color: "#ef4444", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <AlertTriangle size={14} />
          Breached
        </span>
      );
    }

    // Format remaining time
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let displayTime = "";
    if (diffHrs > 24) {
      displayTime = `${Math.floor(diffHrs / 24)}d ${diffHrs % 24}h`;
    } else {
      displayTime = `${diffHrs}h ${diffMins}m`;
    }

    const isUrgent = diffMs < 2 * 1000 * 60 * 60; // Less than 2 hours left
    return (
      <span style={{ color: isUrgent ? "#f97316" : "var(--text-secondary)", fontWeight: isUrgent ? 600 : 400 }}>
        {displayTime} left
      </span>
    );
  };

  // Mock dashboard summary figures calculated client-side from queue
  const newCount = tickets.filter(t => t.status === "new").length;
  const inProgressCount = tickets.filter(t => t.status === "in_progress").length;
  const pendingCount = tickets.filter(t => t.status === "pending_user").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>Service Desk Queue</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            Monitor and resolve incoming incidents and changes.
          </p>
        </div>
        <button 
          onClick={() => refetch()} 
          className="btn btn-secondary"
          title="Refresh Queue"
          disabled={isLoading || isFetching}
          style={{ padding: "10px 14px" }}
        >
          <RefreshCw size={16} className={isFetching ? "spin" : ""} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats Widgets */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px" }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: "rgba(59, 130, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#60a5fa" }}>
            <FolderOpen size={20} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{newCount}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>New Tickets</div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px" }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: "rgba(234, 179, 8, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#facc15" }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{inProgressCount}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>In Progress</div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px" }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: "rgba(249, 115, 22, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fb923c" }}>
            <UserCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{pendingCount}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>Pending User</div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px" }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#34d399" }}>
            <CheckCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>
              {tickets.filter(t => ["resolved", "closed"].includes(t.status)).length}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>Resolved / Closed</div>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)", fontWeight: 600 }}>
          <Filter size={16} />
          <span>Queue Filters</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr", gap: 16 }}>
          {/* Search Box */}
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
              <Search size={16} />
            </span>
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: 38 }}
              placeholder="Search ID, title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Type Filter */}
          <select
            className="form-select"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="">-- All Types --</option>
            <option value="incident">Incidents (INC)</option>
            <option value="change">Changes (CHG)</option>
          </select>

          {/* Status Filter */}
          <select
            className="form-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">-- All Statuses --</option>
            <option value="new">New</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="pending_user">Pending User</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Group Filter */}
          <select
            className="form-select"
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
          >
            <option value="">-- All Groups --</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>

          {/* Assignee Filter */}
          <select
            className="form-select"
            value={selectedAssignee}
            onChange={(e) => setSelectedAssignee(e.target.value)}
            disabled={!selectedGroup}
          >
            <option value="">-- All Assignees --</option>
            {availableAssignees.map((m) => (
              <option key={m.id} value={m.id}>{m.login}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tickets List */}
      {isLoading ? (
        <div className="card" style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 60 }}>
          <div style={{ textAlign: "center" }}>
            <div className="avatar" style={{ width: 40, height: 40, margin: "0 auto 16px", animation: "spin 1s linear infinite" }}>⏳</div>
            <p style={{ color: "var(--text-secondary)" }}>Loading queue items...</p>
          </div>
        </div>
      ) : error ? (
        <div className="card" style={{ border: "1px solid rgba(239, 68, 68, 0.2)", backgroundColor: "rgba(239, 68, 68, 0.05)", padding: 32, textAlign: "center" }}>
          <p style={{ color: "#f87171", fontSize: 15, fontWeight: 600 }}>Failed to load queue data</p>
          <p style={{ color: "var(--text-secondary)", marginTop: 6, fontSize: 13 }}>{(error as any).detail || error.message || "Unknown error"}</p>
          <button onClick={() => refetch()} className="btn btn-secondary" style={{ marginTop: 16 }}>Try Again</button>
        </div>
      ) : tickets.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>🎯</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Queue is clear!</h3>
          <p style={{ color: "var(--text-secondary)", maxWidth: 450, margin: "0 auto" }}>
            No tickets match your filter criteria. Go ahead and take a well-deserved sip of coffee.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 130 }}>ID</th>
                  <th style={{ width: 90 }}>Type</th>
                  <th>Title</th>
                  <th style={{ width: 130 }}>Status</th>
                  <th style={{ width: 120 }}>Priority</th>
                  <th style={{ width: 150 }}>Assigned Group</th>
                  <th style={{ width: 130 }}>Assignee</th>
                  <th style={{ width: 130 }}>SLA Goal</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr 
                    key={ticket.id} 
                    onClick={() => navigate(`/queue/${ticket.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      {ticket.display_id}
                    </td>
                    <td>
                      <span className="badge status-closed" style={{ fontSize: 11, padding: "2px 6px" }}>
                        {ticket.work_item_type.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500, maxWidth: 300, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }} title={ticket.title}>
                      {ticket.title}
                    </td>
                    <td>
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td>
                      <PriorityBadge priority={ticket.priority} />
                    </td>
                    <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      {ticket.assigned_group?.name || <span style={{ color: "var(--text-muted)" }}>None</span>}
                    </td>
                    <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      {ticket.assigned_to?.login || <span style={{ color: "var(--text-muted)" }}>Unassigned</span>}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {renderSla(ticket)}
                    </td>
                    <td>
                      <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Keyset Pagination Controls */}
          {(cursorStack.length > 0 || nextCursor) && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderTop: "1px solid var(--border-color)", backgroundColor: "var(--bg-secondary)" }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Page {cursorStack.length + 1}
              </span>
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={handlePrevPage}
                  className="btn btn-secondary"
                  disabled={cursorStack.length === 0}
                  style={{ padding: "8px 16px", fontSize: 13 }}
                >
                  Previous
                </button>
                <button
                  onClick={handleNextPage}
                  className="btn btn-secondary"
                  disabled={!nextCursor}
                  style={{ padding: "8px 16px", fontSize: 13 }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
