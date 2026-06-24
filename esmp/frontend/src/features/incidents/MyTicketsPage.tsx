import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../api/client";
import { StatusBadge, PriorityBadge } from "../../components/Badges";
import { FilePlus, RefreshCw, Calendar, ArrowRight } from "lucide-react";

interface TicketItem {
  id: string;
  display_id: string;
  work_item_type: string;
  title: string;
  status: string;
  priority: string | null;
  created_at: string;
  updated_at: string;
}

interface TicketListResponse {
  items: TicketItem[];
  next_cursor: string | null;
}

export const MyTicketsPage: React.FC = () => {
  const navigate = useNavigate();

  const { data, isLoading, error, refetch, isFetching } = useQuery<TicketListResponse>({
    queryKey: ["my-tickets"],
    queryFn: () => apiRequest<TicketListResponse>("/work-items"),
  });

  const tickets = data?.items || [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>My Support Tickets</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            Track and manage your submitted support tickets and requests.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button 
            onClick={() => refetch()} 
            className="btn btn-secondary" 
            title="Refresh List"
            disabled={isLoading || isFetching}
            style={{ padding: "10px 12px" }}
          >
            <RefreshCw size={16} className={isFetching ? "spin" : ""} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
          </button>
          <Link to="/portal/new" className="btn btn-primary">
            <FilePlus size={16} />
            File a New Incident
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="card" style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 60 }}>
          <div style={{ textAlign: "center" }}>
            <div className="avatar" style={{ width: 40, height: 40, margin: "0 auto 16px", animation: "spin 1s linear infinite" }}>⏳</div>
            <p style={{ color: "var(--text-secondary)" }}>Loading your tickets...</p>
          </div>
        </div>
      ) : error ? (
        <div className="card" style={{ border: "1px solid rgba(239, 68, 68, 0.2)", backgroundColor: "rgba(239, 68, 68, 0.05)", padding: 32, textAlign: "center" }}>
          <p style={{ color: "#f87171", fontSize: 15, fontWeight: 600 }}>Failed to load tickets</p>
          <p style={{ color: "var(--text-secondary)", marginTop: 6, fontSize: 13 }}>{(error as any).detail || error.message || "Unknown error"}</p>
          <button onClick={() => refetch()} className="btn btn-secondary" style={{ marginTop: 16 }}>Try Again</button>
        </div>
      ) : tickets.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "80px 40px", borderStyle: "dashed" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📂</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No tickets found</h3>
          <p style={{ color: "var(--text-secondary)", maxWidth: 450, margin: "0 auto 24px" }}>
            You haven't submitted any support tickets yet. If you are experiencing an issue, click the button below to submit a ticket to the support team.
          </p>
          <Link to="/portal/new" className="btn btn-primary">
            <FilePlus size={16} />
            Submit Your First Ticket
          </Link>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>ID</th>
                  <th>Title</th>
                  <th style={{ width: 140 }}>Status</th>
                  <th style={{ width: 140 }}>Priority</th>
                  <th style={{ width: 180 }}>Created</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr 
                    key={ticket.id} 
                    onClick={() => navigate(`/portal/tickets/${ticket.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 500 }}>
                      {ticket.display_id}
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {ticket.title}
                    </td>
                    <td>
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td>
                      <PriorityBadge priority={ticket.priority} />
                    </td>
                    <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Calendar size={14} style={{ color: "var(--text-muted)" }} />
                        {new Date(ticket.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </span>
                    </td>
                    <td>
                      <ArrowRight size={16} style={{ color: "var(--text-muted)" }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
