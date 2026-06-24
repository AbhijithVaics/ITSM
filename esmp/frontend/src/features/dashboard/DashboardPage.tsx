import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../api/client";
import { 
  LayoutDashboard, 
  Inbox, 
  AlertTriangle, 
  Clock, 
  Users, 
  User, 
  RefreshCw 
} from "lucide-react";

interface OpenByStatus {
  [status: string]: number;
}

interface SlaSummary {
  breached: number;
  at_risk: number;
  healthy: number;
  paused: number;
}

interface Workload {
  by_group: { [group: string]: number };
  by_agent: { [agent: string]: number };
}

export const DashboardPage: React.FC = () => {
  // Query 1: Open by status
  const statusQuery = useQuery<OpenByStatus>({
    queryKey: ["dashboard-open-by-status"],
    queryFn: () => apiRequest<OpenByStatus>("/dashboard/open-by-status"),
    refetchInterval: 30000, // auto refetch every 30 seconds
  });

  // Query 2: SLA summary
  const slaQuery = useQuery<SlaSummary>({
    queryKey: ["dashboard-sla-summary"],
    queryFn: () => apiRequest<SlaSummary>("/dashboard/sla-summary"),
    refetchInterval: 30000,
  });

  // Query 3: Workload
  const workloadQuery = useQuery<Workload>({
    queryKey: ["dashboard-workload"],
    queryFn: () => apiRequest<Workload>("/dashboard/workload"),
    refetchInterval: 30000,
  });

  const isLoading = statusQuery.isLoading || slaQuery.isLoading || workloadQuery.isLoading;
  const isError = statusQuery.isError || slaQuery.isError || workloadQuery.isError;

  const handleRefresh = () => {
    statusQuery.refetch();
    slaQuery.refetch();
    workloadQuery.refetch();
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", height: "50vh", alignItems: "center", justifyContent: "center" }}>
        <div className="avatar" style={{ width: 40, height: 40, animation: "spin 1s linear infinite" }}>⏳</div>
        <span style={{ marginLeft: 12, color: "var(--text-secondary)" }}>Loading dashboard...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card" style={{ border: "1px solid rgba(239, 68, 68, 0.2)", backgroundColor: "rgba(239, 68, 68, 0.05)", padding: 32, textAlign: "center" }}>
        <p style={{ color: "#f87171", fontSize: 16, fontWeight: 600 }}>Failed to load dashboard metrics</p>
        <button onClick={handleRefresh} className="btn btn-secondary" style={{ marginTop: 16 }}>Try Again</button>
      </div>
    );
  }

  const openByStatus = statusQuery.data || {};
  const slaSummary = slaQuery.data || { breached: 0, at_risk: 0, healthy: 0, paused: 0 };
  const workload = workloadQuery.data || { by_group: {}, by_agent: {} };

  // Calculate totals
  const totalOpenTickets = Object.values(openByStatus).reduce((a, b) => a + b, 0);
  const totalSlaTickets = slaSummary.healthy + slaSummary.at_risk + slaSummary.breached;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 12 }}>
            <LayoutDashboard size={32} style={{ color: "var(--primary-color)" }} />
            Enterprise Operations Dashboard
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            Real-time operations, SLA compliance status, and queue workloads.
          </p>
        </div>
        <button 
          onClick={handleRefresh} 
          className="btn btn-secondary"
          style={{ padding: "10px 14px" }}
        >
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
        {/* Total Open */}
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 24px" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "rgba(99, 102, 241, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary-color)" }}>
            <Inbox size={24} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{totalOpenTickets}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>Active Work Items</div>
          </div>
        </div>

        {/* SLA Breached */}
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 24px" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "rgba(239, 68, 68, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171" }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: "#f87171" }}>{slaSummary.breached}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>SLA Breached</div>
          </div>
        </div>

        {/* SLA At Risk */}
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 24px" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "rgba(249, 115, 22, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fb923c" }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: "#fb923c" }}>{slaSummary.at_risk}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>SLA At Risk</div>
          </div>
        </div>

        {/* Unassigned Work */}
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 24px" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "rgba(107, 114, 128, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
            <User size={24} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
              {workload.by_agent["Unassigned"] || 0}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>Unassigned Tickets</div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Status & SLA Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Open Tickets by Status */}
          <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Work Items by Status</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
              {Object.keys(openByStatus).length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>No active tickets</div>
              ) : (
                Object.entries(openByStatus).map(([status, count]) => {
                  const percentage = totalOpenTickets > 0 ? (count / totalOpenTickets) * 100 : 0;
                  
                  // Color codes
                  let barColor = "var(--primary-color)";
                  if (status === "new") barColor = "#60a5fa";
                  if (status === "in_progress") barColor = "#facc15";
                  if (status === "pending_user") barColor = "#fb923c";
                  if (status === "resolved") barColor = "#34d399";
                  if (status === "closed") barColor = "#9ca3af";
                  if (status === "cancelled") barColor = "#f87171";

                  return (
                    <div key={status} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span style={{ textTransform: "capitalize", fontWeight: 500 }}>{status.replace("_", " ")}</span>
                        <span style={{ fontWeight: 600 }}>{count} ({percentage.toFixed(0)}%)</span>
                      </div>
                      <div style={{ width: "100%", height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                        <div style={{ width: `${percentage}%`, height: "100%", backgroundColor: barColor, borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* SLA Performance ring */}
          <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>SLA Compliance Clocks</h3>
            <div style={{ display: "flex", gap: 32, alignItems: "center", marginTop: 8 }}>
              <div style={{ position: "relative", width: 100, height: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {/* Visual Circle (HTML/CSS only) */}
                <div style={{
                  width: 90,
                  height: 90,
                  borderRadius: "50%",
                  border: "8px solid rgba(255, 255, 255, 0.05)",
                  position: "absolute",
                }} />
                {/* Indicator text */}
                <div style={{ textAlign: "center", zIndex: 1 }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    {totalSlaTickets > 0 ? (((slaSummary.healthy + slaSummary.paused) / totalSlaTickets) * 100).toFixed(0) : 100}%
                  </div>
                  <div style={{ fontSize: 9, color: "var(--text-secondary)", textTransform: "uppercase", marginTop: 2 }}>Compliant</div>
                </div>
              </div>

              <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Healthy */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#34d399" }} />
                    <span>Healthy (Compliant)</span>
                  </div>
                  <span style={{ fontWeight: 600 }}>{slaSummary.healthy}</span>
                </div>

                {/* At Risk */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#fb923c" }} />
                    <span>At Risk</span>
                  </div>
                  <span style={{ fontWeight: 600 }}>{slaSummary.at_risk}</span>
                </div>

                {/* Breached */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#f87171" }} />
                    <span>Breached</span>
                  </div>
                  <span style={{ fontWeight: 600 }}>{slaSummary.breached}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Workload Distribution Grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Workload by Group */}
          <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <Users size={18} style={{ color: "var(--primary-color)" }} />
              Queue Workload by Group
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
              {Object.keys(workload.by_group).length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>No unassigned or open group tickets</div>
              ) : (
                Object.entries(workload.by_group).map(([group, count]) => (
                  <div key={group} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: 8 }}>
                    <span style={{ fontWeight: 500 }}>{group}</span>
                    <span className="badge status-progress" style={{ fontWeight: 600, padding: "2px 8px", fontSize: 11 }}>{count} open</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Workload by Agent */}
          <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <User size={18} style={{ color: "var(--primary-color)" }} />
              Queue Workload by Agent
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
              {Object.keys(workload.by_agent).length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>No assigned open tickets</div>
              ) : (
                Object.entries(workload.by_agent).map(([agent, count]) => (
                  <div key={agent} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: 8 }}>
                    <span style={{ fontWeight: 500 }}>{agent}</span>
                    <span className="badge status-assigned" style={{ fontWeight: 600, padding: "2px 8px", fontSize: 11 }}>{count} open</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
