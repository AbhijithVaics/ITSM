import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../api/client";
import { StatusBadge } from "../../components/Badges";
import { useAuth } from "../../auth/AuthContext";
import {
  Search,
  RefreshCw,
  ChevronRight,
  Plus,
  ShieldAlert,
  AlertTriangle,
  Zap,
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

interface ChangeItem {
  id: string;
  display_id: string;
  work_item_type: string;
  title: string;
  status: string;
  reported_by: UserBrief | null;
  assigned_to: UserBrief | null;
  assigned_group: GroupBrief | null;
  created_at: string;
  updated_at: string;
  extension: {
    risk_level: string;
    expedited: boolean;
    scheduled_start: string | null;
    scheduled_end: string | null;
  } | null;
}

interface ChangeListResponse {
  items: ChangeItem[];
  next_cursor: string | null;
}

const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: "rgba(59, 130, 246, 0.15)", text: "#60a5fa", border: "rgba(59, 130, 246, 0.25)" },
  medium: { bg: "rgba(234, 179, 8, 0.15)", text: "#facc15", border: "rgba(234, 179, 8, 0.25)" },
  high: { bg: "rgba(249, 115, 22, 0.15)", text: "#fb923c", border: "rgba(249, 115, 22, 0.25)" },
  critical: { bg: "rgba(239, 68, 68, 0.15)", text: "#f87171", border: "rgba(239, 68, 68, 0.25)" },
};

export const ChangeListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([]);

  const queryParams = new URLSearchParams();
  queryParams.append("work_item_type", "change");
  if (selectedStatus) queryParams.append("status", selectedStatus);
  if (searchTerm) queryParams.append("q", searchTerm);
  if (cursor) queryParams.append("cursor", cursor);
  queryParams.append("limit", "20");

  const { data, isLoading, error, refetch, isFetching } = useQuery<ChangeListResponse>({
    queryKey: ["change-list", selectedStatus, searchTerm, cursor],
    queryFn: () => apiRequest<ChangeListResponse>(`/work-items?${queryParams.toString()}`),
  });

  const changes = data?.items || [];
  const nextCursor = data?.next_cursor || null;

  useEffect(() => {
    setCursor(null);
    setCursorStack([]);
  }, [selectedStatus, searchTerm]);

  const handleNextPage = () => {
    if (nextCursor) {
      setCursorStack((prev) => [...prev, cursor]);
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

  const canCreate = user?.role && ["admin", "agent", "manager", "change_manager"].includes(user.role);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <ShieldAlert size={28} style={{ color: "var(--primary-color)" }} />
            Change Requests
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            Track and manage infrastructure and service changes through the CAB approval process.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => refetch()} className="btn btn-secondary" title="Refresh">
            <RefreshCw size={16} className={isFetching ? "spin" : ""} />
          </button>
          {canCreate && (
            <Link to="/changes/new" className="btn btn-primary">
              <Plus size={16} />
              New Change
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flexGrow: 1, maxWidth: 360 }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />
            <input
              type="text"
              className="form-input"
              placeholder="Search by CR ID or title…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 36, marginBottom: 0 }}
            />
          </div>

          <select
            className="form-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={{ width: 200, marginBottom: 0 }}
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="scheduled">Scheduled</option>
            <option value="implementing">Implementing</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {isLoading && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Loading changes…</div>
      )}

      {error && (
        <div style={{ textAlign: "center", padding: 60, color: "#f87171" }}>
          <AlertTriangle size={24} style={{ marginBottom: 8 }} />
          <div>Failed to load change requests.</div>
        </div>
      )}

      {!isLoading && !error && changes.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: 80,
            color: "var(--text-muted)",
            fontStyle: "italic",
          }}
        >
          No change requests found matching your criteria.
        </div>
      )}

      {!isLoading && !error && changes.length > 0 && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>CR ID</th>
                <th>Title</th>
                <th>Status</th>
                <th>Risk</th>
                <th>Scheduled</th>
                <th>Requester</th>
                <th>Assigned To</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {changes.map((cr) => {
                const risk = cr.extension?.risk_level || "low";
                const riskStyle = RISK_COLORS[risk] || RISK_COLORS.low;
                return (
                  <tr
                    key={cr.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(`/changes/${cr.id}`)}
                  >
                    <td>
                      <span style={{ fontFamily: "var(--mono)", fontWeight: 600, fontSize: 13 }}>
                        {cr.display_id}
                      </span>
                      {cr.extension?.expedited && (
                        <span title="Expedited / Emergency">
                          <Zap
                            size={13}
                            style={{ color: "#facc15", marginLeft: 6, verticalAlign: "middle" }}
                          />
                        </span>
                      )}
                    </td>
                    <td>
                      <div
                        style={{
                          maxWidth: 320,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cr.title}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={cr.status} />
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: riskStyle.bg,
                          color: riskStyle.text,
                          border: `1px solid ${riskStyle.border}`,
                          textTransform: "capitalize",
                        }}
                      >
                        {risk}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      {cr.extension?.scheduled_start
                        ? new Date(cr.extension.scheduled_start).toLocaleDateString()
                        : "—"}
                    </td>
                    <td style={{ fontSize: 13 }}>{cr.reported_by?.login || "—"}</td>
                    <td style={{ fontSize: 13 }}>{cr.assigned_to?.login || "—"}</td>
                    <td>
                      <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {(cursorStack.length > 0 || nextCursor) && (
        <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
          <button
            className="btn btn-secondary"
            disabled={cursorStack.length === 0}
            onClick={handlePrevPage}
            style={{ fontSize: 13 }}
          >
            ← Previous
          </button>
          <button
            className="btn btn-secondary"
            disabled={!nextCursor}
            onClick={handleNextPage}
            style={{ fontSize: 13 }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};
