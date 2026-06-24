import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/client";
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  MessageSquare,
  X,
} from "lucide-react";

interface ApproverBrief {
  id: string;
  login: string;
  email: string;
}

interface ApprovalItem {
  id: string;
  change_id: string;
  approver_id: string;
  status: string;
  comment: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  approver: ApproverBrief | null;
  change: {
    id: string;
    display_id: string;
    title: string;
    status: string;
  } | null;
}

export const ApprovalInboxPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeApproval, setActiveApproval] = useState<ApprovalItem | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [comment, setComment] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const { data: pendingApprovals = [], isLoading, refetch, isFetching, error } = useQuery<ApprovalItem[]>({
    queryKey: ["my-pending-approvals"],
    queryFn: () => apiRequest<ApprovalItem[]>("/approvals/my-pending"),
    refetchInterval: 30000,
  });

  const decideMutation = useMutation({
    mutationFn: (payload: { approvalId: string; decision: string; comment: string | null }) =>
      apiRequest(`/approvals/${payload.approvalId}/decide`, {
        method: "POST",
        body: JSON.stringify({ decision: payload.decision, comment: payload.comment }),
      }),
    onSuccess: () => {
      setActiveApproval(null);
      setComment("");
      setDecisionError(null);
      queryClient.invalidateQueries({ queryKey: ["my-pending-approvals"] });
    },
    onError: (err: any) => {
      setDecisionError(err.detail || err.message || "Failed to submit decision.");
    },
  });

  const handleSubmitDecision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeApproval) return;
    decideMutation.mutate({
      approvalId: activeApproval.id,
      decision,
      comment: comment || null,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <ShieldCheck size={28} style={{ color: "var(--primary-color)" }} />
            Approval Inbox
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            Review and approve or reject pending Change Requests assigned to you.
          </p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary" title="Refresh">
          <RefreshCw size={16} className={isFetching ? "spin" : ""} />
        </button>
      </div>

      {isLoading && (
        <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)" }}>Loading approvals…</div>
      )}

      {error && (
        <div style={{ textAlign: "center", padding: 80, color: "#f87171" }}>
          <AlertCircle size={24} style={{ marginBottom: 8 }} />
          <div>Failed to load approvals.</div>
        </div>
      )}

      {!isLoading && !error && pendingApprovals.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "60px 40px" }}>
          <CheckCircle size={48} style={{ color: "#34d399", marginBottom: 16 }} />
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>All Caught Up!</h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: 400, margin: "0 auto" }}>
            You have no pending approval requests. New requests will appear here when they need your review.
          </p>
        </div>
      )}

      {!isLoading && !error && pendingApprovals.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {pendingApprovals.map((approval) => (
            <div
              key={approval.id}
              className="card"
              style={{
                padding: "18px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
            >
              <div style={{ flexGrow: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Clock size={15} style={{ color: "#fb923c", flexShrink: 0 }} />
                  <span style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600, color: "var(--primary-color)" }}>
                    {approval.change?.display_id || "CR-????"}
                  </span>
                  <span className="badge status-pending_user" style={{ fontSize: 10, padding: "2px 8px" }}>
                    Pending Your Review
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: "pointer",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  onClick={() => navigate(`/changes/${approval.change_id}`)}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--primary-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                >
                  {approval.change?.title || "Untitled Change Request"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  Requested {new Date(approval.created_at).toLocaleDateString()} at {new Date(approval.created_at).toLocaleTimeString()}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: "7px 14px", color: "#f87171", borderColor: "rgba(248, 113, 113, 0.3)" }}
                  onClick={() => { setActiveApproval(approval); setDecision("reject"); setComment(""); setDecisionError(null); }}
                >
                  <XCircle size={14} /> Reject
                </button>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 12, padding: "7px 14px" }}
                  onClick={() => { setActiveApproval(approval); setDecision("approve"); setComment(""); setDecisionError(null); }}
                >
                  <CheckCircle size={14} /> Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Decision Modal */}
      {activeApproval && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <form onSubmit={handleSubmitDecision} className="card" style={{ width: "100%", maxWidth: 480, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                {decision === "approve" ? (
                  <><CheckCircle size={20} style={{ color: "#34d399" }} /> Approve Change</>
                ) : (
                  <><XCircle size={20} style={{ color: "#f87171" }} /> Reject Change</>
                )}
              </h3>
              <button type="button" onClick={() => { setActiveApproval(null); setDecisionError(null); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: 16, padding: "10px 14px", backgroundColor: "var(--bg-tertiary)", borderRadius: 6, border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>Change Request</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{activeApproval.change?.display_id} — {activeApproval.change?.title}</div>
            </div>

            {decisionError && (
              <div style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: 12, marginBottom: 16, color: "#f87171", fontSize: 13, display: "flex", gap: 8 }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>{decisionError}</div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">
                <MessageSquare size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                Comment {decision === "reject" ? "(recommended)" : "(optional)"}
              </label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder={decision === "reject" ? "Please explain the reason for rejection…" : "Add any notes regarding your approval…"}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16, borderTop: "1px solid var(--border-color)", paddingTop: 16 }}>
              <button type="button" onClick={() => { setActiveApproval(null); setDecisionError(null); }} className="btn btn-secondary" disabled={decideMutation.isPending}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={decision === "reject" ? { backgroundColor: "#ef4444" } : {}}
                disabled={decideMutation.isPending}
              >
                {decideMutation.isPending ? "Submitting…" : decision === "approve" ? "Confirm Approval" : "Confirm Rejection"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
