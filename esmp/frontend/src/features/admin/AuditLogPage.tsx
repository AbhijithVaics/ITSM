import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../api/client";
import { 
  Shield, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  Filter, 
  ArrowLeftRight 
} from "lucide-react";

interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string | null;
  actor_display: string | null;
  old_values: any | null;
  new_values: any | null;
  created_at: string;
}

interface AuditLogListResponse {
  items: AuditLog[];
  total: number;
  page: number;
  page_size: number;
}

export const AuditLogPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [actorId, setActorId] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery<AuditLogListResponse>({
    queryKey: ["admin-audit-logs", page, entityType, entityId, actorId],
    queryFn: () => {
      let query = `/admin/audit?page=${page}&page_size=20`;
      if (entityType) query += `&entity_type=${encodeURIComponent(entityType)}`;
      if (entityId) query += `&entity_id=${encodeURIComponent(entityId)}`;
      if (actorId) query += `&actor_id=${encodeURIComponent(actorId)}`;
      return apiRequest<AuditLogListResponse>(query);
    },
  });

  const toggleRow = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    refetch();
  };

  const handleResetFilters = () => {
    setEntityType("");
    setEntityId("");
    setActorId("");
    setPage(1);
  };

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  if (isLoading) {
    return (
      <div style={{ display: "flex", height: "50vh", alignItems: "center", justifyContent: "center" }}>
        <div className="avatar" style={{ width: 40, height: 40, animation: "spin 1s linear infinite" }}>⏳</div>
        <span style={{ marginLeft: 12, color: "var(--text-secondary)" }}>Loading audit logs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ border: "1px solid rgba(239, 68, 68, 0.2)", backgroundColor: "rgba(239, 68, 68, 0.05)", padding: 32, textAlign: "center" }}>
        <p style={{ color: "#f87171", fontSize: 16, fontWeight: 600 }}>Failed to load audit logs</p>
        <p style={{ color: "var(--text-secondary)", marginTop: 6, fontSize: 13 }}>{(error as any)?.detail || error?.message || "Ensure you have admin rights."}</p>
        <button onClick={() => refetch()} className="btn btn-secondary" style={{ marginTop: 16 }}>Try Again</button>
      </div>
    );
  }

  const logs = data?.items || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 12 }}>
          <Shield size={32} style={{ color: "var(--primary-color)" }} />
          Compliance Audit Log
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
          Browse and filter system-wide immutable mutation records.
        </p>
      </div>

      {/* Filter Card */}
      <form onSubmit={handleSearchSubmit} className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontWeight: 600 }}>
          <Filter size={16} style={{ color: "var(--primary-color)" }} />
          <span>Filters</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {/* Entity Type */}
          <div>
            <label className="label" style={{ fontSize: 12, marginBottom: 6 }}>Entity Type</label>
            <input 
              type="text" 
              placeholder="e.g. work_item, user" 
              className="input-field" 
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
            />
          </div>

          {/* Entity ID */}
          <div>
            <label className="label" style={{ fontSize: 12, marginBottom: 6 }}>Entity UUID</label>
            <input 
              type="text" 
              placeholder="e.g. uuid" 
              className="input-field" 
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
            />
          </div>

          {/* Actor ID */}
          <div>
            <label className="label" style={{ fontSize: 12, marginBottom: 6 }}>Actor UUID</label>
            <input 
              type="text" 
              placeholder="e.g. user uuid" 
              className="input-field" 
              value={actorId}
              onChange={(e) => setActorId(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
          <button type="button" onClick={handleResetFilters} className="btn btn-secondary">
            Reset
          </button>
          <button type="submit" className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Search size={16} />
            <span>Filter Logs</span>
          </button>
        </div>
      </form>

      {/* Audit Log Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-color)", textAlign: "left" }}>
              <th style={{ padding: 16 }}>Timestamp</th>
              <th style={{ padding: 16 }}>Action</th>
              <th style={{ padding: 16 }}>Entity</th>
              <th style={{ padding: 16 }}>Entity ID</th>
              <th style={{ padding: 16 }}>Actor</th>
              <th style={{ padding: 16, width: 80 }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
                  No audit logs found matching criteria.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const isExpanded = expandedId === log.id;
                return (
                  <React.Fragment key={log.id}>
                    <tr 
                      onClick={() => toggleRow(log.id)}
                      style={{ 
                        borderBottom: "1px solid var(--border-color)", 
                        cursor: "pointer",
                        backgroundColor: isExpanded ? "rgba(255,255,255,0.02)" : "transparent"
                      }}
                      className="table-row-hover"
                    >
                      <td style={{ padding: 16, whiteSpace: "nowrap", fontSize: 13 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)" }}>
                          <Calendar size={14} />
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </td>
                      <td style={{ padding: 16 }}>
                        <span className={`badge ${
                          log.action === "created" ? "status-resolved" : 
                          log.action === "updated" ? "status-progress" : 
                          "status-closed"
                        }`} style={{ padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: 16, fontWeight: 500, textTransform: "capitalize" }}>
                        {log.entity_type.replace("_", " ")}
                      </td>
                      <td style={{ padding: 16, fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-secondary)" }}>
                        {log.entity_id}
                      </td>
                      <td style={{ padding: 16, fontWeight: 500 }}>
                        {log.actor_display || "System"}
                      </td>
                      <td style={{ padding: 16, textAlign: "center" }}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ backgroundColor: "rgba(255,255,255,0.015)" }}>
                        <td colSpan={6} style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-color)" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <div style={{ display: "flex", gap: 24 }}>
                              {/* Old Values */}
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                                  <ArrowLeftRight size={12} />
                                  BEFORE
                                </div>
                                <pre style={{ 
                                  backgroundColor: "rgba(0,0,0,0.2)", 
                                  padding: 12, 
                                  borderRadius: 6, 
                                  border: "1px solid var(--border-color)",
                                  fontSize: 12,
                                  fontFamily: "var(--mono)",
                                  maxHeight: 200,
                                  overflowY: "auto",
                                  whiteSpace: "pre-wrap"
                                }}>
                                  {log.old_values ? JSON.stringify(log.old_values, null, 2) : "None (New Entry)"}
                                </pre>
                              </div>

                              {/* New Values */}
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                                  <ArrowLeftRight size={12} />
                                  AFTER
                                </div>
                                <pre style={{ 
                                  backgroundColor: "rgba(0,0,0,0.2)", 
                                  padding: 12, 
                                  borderRadius: 6, 
                                  border: "1px solid var(--border-color)",
                                  fontSize: 12,
                                  fontFamily: "var(--mono)",
                                  maxHeight: 200,
                                  overflowY: "auto",
                                  whiteSpace: "pre-wrap"
                                }}>
                                  {log.new_values ? JSON.stringify(log.new_values, null, 2) : "None (Deleted)"}
                                </pre>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, borderTop: "1px solid var(--border-color)" }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Total logs: <strong>{data?.total || 0}</strong> · Page {page} of {totalPages}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || isFetching}
                className="btn btn-secondary"
                style={{ padding: "6px 12px", fontSize: 12 }}
              >
                Previous
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || isFetching}
                className="btn btn-secondary"
                style={{ padding: "6px 12px", fontSize: 12 }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
