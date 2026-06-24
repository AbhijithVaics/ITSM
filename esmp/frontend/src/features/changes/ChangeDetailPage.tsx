import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { StatusBadge } from "../../components/Badges";
import {
  ArrowLeft,
  ShieldAlert,
  Calendar,
  User,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Zap,
  Save,
  X,
  MessageSquare,
  Lock,
  Eye,
  Send,
  Upload,
  Download,
  File as FileIcon,
} from "lucide-react";

interface UserBrief { id: string; login: string; email: string; }
interface GroupBrief { id: string; name: string; }

interface ChangeDetail {
  id: string;
  display_id: string;
  work_item_type: string;
  title: string;
  description: string;
  status: string;
  priority: string | null;
  source: string;
  reported_by: UserBrief | null;
  assigned_to: UserBrief | null;
  assigned_group: GroupBrief | null;
  resolution_deadline: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  extension: {
    risk_level: string;
    expedited: boolean;
    scheduled_start: string | null;
    scheduled_end: string | null;
    implementation_plan: string | null;
    backout_plan: string | null;
    validation_plan: string | null;
  } | null;
  available_actions: string[] | null;
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
  approver: { id: string; login: string; email: string } | null;
}

interface CommentItem {
  id: string;
  work_item_id: string;
  author: UserBrief | null;
  text: string;
  visibility: "public" | "internal";
  created_at: string;
}

interface AttachmentItem {
  id: string;
  work_item_id: string;
  uploaded_by: UserBrief | null;
  filename: string;
  content_type: string | null;
  file_size: number;
  created_at: string;
}



const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: "rgba(59, 130, 246, 0.15)", text: "#60a5fa", border: "rgba(59, 130, 246, 0.25)" },
  medium: { bg: "rgba(234, 179, 8, 0.15)", text: "#facc15", border: "rgba(234, 179, 8, 0.25)" },
  high: { bg: "rgba(249, 115, 22, 0.15)", text: "#fb923c", border: "rgba(249, 115, 22, 0.25)" },
  critical: { bg: "rgba(239, 68, 68, 0.15)", text: "#f87171", border: "rgba(239, 68, 68, 0.25)" },
};

export const ChangeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isAgent = user?.role !== "requester";

  // Plan editing state
  const [editingPlans, setEditingPlans] = useState(false);
  const [implPlan, setImplPlan] = useState("");
  const [backPlan, setBackPlan] = useState("");
  const [valPlan, setValPlan] = useState("");
  const [riskLvl, setRiskLvl] = useState("low");
  const [expeditedFlag, setExpeditedFlag] = useState(false);
  const [schedStart, setSchedStart] = useState("");
  const [schedEnd, setSchedEnd] = useState("");
  const [planError, setPlanError] = useState<string | null>(null);

  // Transition state
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [transitionComment, setTransitionComment] = useState("");
  const [transitionError, setTransitionError] = useState<string | null>(null);

  // Comment state
  const [commentText, setCommentText] = useState("");
  const [commentVisibility, setCommentVisibility] = useState<"public" | "internal">("public");

  // File upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ── Queries ──
  const { data: change, isLoading, error: loadError } = useQuery<ChangeDetail>({
    queryKey: ["change-detail", id],
    queryFn: () => apiRequest<ChangeDetail>(`/work-items/${id}`),
    refetchInterval: 30000,
  });

  const { data: approvals = [] } = useQuery<ApprovalItem[]>({
    queryKey: ["change-approvals", id],
    queryFn: () => apiRequest<ApprovalItem[]>(`/approvals/change/${id}`),
    enabled: !!id,
  });

  const { data: comments = [] } = useQuery<CommentItem[]>({
    queryKey: ["comments", id],
    queryFn: () => apiRequest<CommentItem[]>(`/work-items/${id}/comments`),
    enabled: !!id,
  });

  const { data: attachments = [] } = useQuery<AttachmentItem[]>({
    queryKey: ["attachments", id],
    queryFn: () => apiRequest<AttachmentItem[]>(`/work-items/${id}/attachments`),
    enabled: !!id,
  });

  // Populate plan editing fields
  useEffect(() => {
    if (change?.extension) {
      setImplPlan(change.extension.implementation_plan || "");
      setBackPlan(change.extension.backout_plan || "");
      setValPlan(change.extension.validation_plan || "");
      setRiskLvl(change.extension.risk_level || "low");
      setExpeditedFlag(change.extension.expedited || false);
      setSchedStart(change.extension.scheduled_start ? change.extension.scheduled_start.slice(0, 16) : "");
      setSchedEnd(change.extension.scheduled_end ? change.extension.scheduled_end.slice(0, 16) : "");
    }
  }, [change]);

  // ── Mutations ──
  const planMutation = useMutation({
    mutationFn: (payload: any) =>
      apiRequest(`/changes/${id}/plans`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: () => {
      setEditingPlans(false);
      setPlanError(null);
      queryClient.invalidateQueries({ queryKey: ["change-detail", id] });
    },
    onError: (err: any) => setPlanError(err.detail || err.message || "Failed to update plans."),
  });

  const transitionMutation = useMutation({
    mutationFn: (payload: any) =>
      apiRequest(`/work-items/${id}/transitions`, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      setActiveAction(null);
      setTransitionComment("");
      setTransitionError(null);
      queryClient.invalidateQueries({ queryKey: ["change-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["change-approvals", id] });
    },
    onError: (err: any) => setTransitionError(err.detail || err.message || "Transition failed."),
  });

  const addCommentMutation = useMutation({
    mutationFn: (newComment: { text: string; visibility: string }) =>
      apiRequest(`/work-items/${id}/comments`, { method: "POST", body: JSON.stringify(newComment) }),
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
    },
  });

  // ── Handlers ──
  const handleSavePlans = () => {
    planMutation.mutate({
      risk_level: riskLvl,
      expedited: expeditedFlag,
      scheduled_start: schedStart ? new Date(schedStart).toISOString() : null,
      scheduled_end: schedEnd ? new Date(schedEnd).toISOString() : null,
      implementation_plan: implPlan || null,
      backout_plan: backPlan || null,
      validation_plan: valPlan || null,
    });
  };

  const handleTransition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAction) return;
    transitionMutation.mutate({
      action: activeAction,
      comment: transitionComment || null,
    });
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addCommentMutation.mutate({ text: commentText, visibility: commentVisibility });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      if (e.target.files[0].size > 25 * 1024 * 1024) {
        setUploadError("File exceeds 25 MB limit.");
        return;
      }
      setSelectedFile(e.target.files[0]);
      setUploadError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      await apiRequest(`/work-items/${id}/attachments`, { method: "POST", body: fd });
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ["attachments", id] });
    } catch (err: any) {
      setUploadError(err.detail || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  // ── Render ──
  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)" }}>
        Loading change request…
      </div>
    );
  }

  if (loadError || !change) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <AlertCircle size={32} style={{ color: "#f87171", marginBottom: 12 }} />
        <div style={{ color: "#f87171", fontWeight: 600 }}>Failed to load change request.</div>
        <Link to="/changes" className="btn btn-secondary" style={{ marginTop: 20 }}>
          Back to Change List
        </Link>
      </div>
    );
  }

  const ext = change.extension;
  const risk = ext?.risk_level || "low";
  const riskStyle = RISK_COLORS[risk] || RISK_COLORS.low;
  const actions = change.available_actions || [];
  const isClosed = ["closed", "completed"].includes(change.status);

  // Approval progress
  const totalApprovals = approvals.length;
  const approvedCount = approvals.filter((a) => a.status === "approved").length;
  const rejectedCount = approvals.filter((a) => a.status === "rejected").length;
  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 20 }}>
        <Link
          to="/changes"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", fontSize: 13, fontWeight: 500 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
        >
          <ArrowLeft size={16} />
          Back to Change Requests
        </Link>
      </div>

      {/* Header */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div style={{ flexGrow: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--primary-color)", fontWeight: 600 }}>
                {change.display_id}
              </span>
              <StatusBadge status={change.status} />
              <span className="badge" style={{ backgroundColor: riskStyle.bg, color: riskStyle.text, border: `1px solid ${riskStyle.border}`, textTransform: "capitalize" }}>
                {risk} Risk
              </span>
              {ext?.expedited && (
                <span className="badge" style={{ backgroundColor: "rgba(234, 179, 8, 0.15)", color: "#facc15", border: "1px solid rgba(234, 179, 8, 0.25)" }}>
                  <Zap size={12} /> Expedited
                </span>
              )}
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{change.title}</h1>
          </div>

          {/* Action Buttons */}
          {actions.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              {actions.map((act) => (
                <button
                  key={act}
                  onClick={() => setActiveAction(act)}
                  className={`btn ${act === "approve" || act === "schedule" ? "btn-primary" : "btn-secondary"}`}
                  style={{ textTransform: "capitalize", padding: "8px 16px", fontSize: 13 }}
                >
                  {act.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr", gap: 24 }}>
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Description */}
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: 10, marginBottom: 12 }}>
              Description
            </h3>
            <div style={{ color: "var(--text-primary)", fontSize: 14, whiteSpace: "pre-wrap", minHeight: 40 }}>
              {change.description || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No description provided.</span>}
            </div>
          </div>

          {/* Plans Section */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: 10, marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                <ShieldAlert size={16} style={{ verticalAlign: "middle", marginRight: 6, color: "var(--primary-color)" }} />
                Implementation Plans
              </h3>
              {isAgent && !isClosed && (
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: "5px 12px" }}
                  onClick={() => setEditingPlans(!editingPlans)}
                >
                  {editingPlans ? "Cancel" : "Edit Plans"}
                </button>
              )}
            </div>

            {planError && (
              <div style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: 10, marginBottom: 14, color: "#f87171", fontSize: 13 }}>
                <AlertCircle size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
                {planError}
              </div>
            )}

            {editingPlans ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Risk Level</label>
                    <select className="form-select" value={riskLvl} onChange={(e) => setRiskLvl(e.target.value)}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, paddingTop: 24 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input type="checkbox" checked={expeditedFlag} onChange={(e) => setExpeditedFlag(e.target.checked)} style={{ width: 16, height: 16 }} />
                      Expedited Change
                    </label>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Scheduled Start</label>
                    <input type="datetime-local" className="form-input" value={schedStart} onChange={(e) => setSchedStart(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Scheduled End</label>
                    <input type="datetime-local" className="form-input" value={schedEnd} onChange={(e) => setSchedEnd(e.target.value)} />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Implementation Plan</label>
                  <textarea className="form-textarea" rows={4} value={implPlan} onChange={(e) => setImplPlan(e.target.value)} placeholder="Step-by-step implementation procedure…" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Backout / Rollback Plan</label>
                  <textarea className="form-textarea" rows={3} value={backPlan} onChange={(e) => setBackPlan(e.target.value)} placeholder="Rollback procedure in case of failure…" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Validation / Post-Deployment Test Plan</label>
                  <textarea className="form-textarea" rows={3} value={valPlan} onChange={(e) => setValPlan(e.target.value)} placeholder="Steps to verify the change was successful…" />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button className="btn btn-secondary" onClick={() => { setEditingPlans(false); setPlanError(null); }}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleSavePlans} disabled={planMutation.isPending}>
                    <Save size={14} /> {planMutation.isPending ? "Saving…" : "Save Plans"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <PlanField label="Implementation Plan" value={ext?.implementation_plan} />
                <PlanField label="Backout / Rollback Plan" value={ext?.backout_plan} />
                <PlanField label="Validation / Post-Deployment Test Plan" value={ext?.validation_plan} />
              </div>
            )}
          </div>

          {/* Approval Progress */}
          {totalApprovals > 0 && (
            <div className="card">
              <h3 style={{ fontSize: 15, fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: 10, marginBottom: 16 }}>
                CAB Approval Progress
              </h3>

              {/* Progress bar */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
                  <span>{approvedCount} approved · {rejectedCount} rejected · {pendingCount} pending</span>
                  <span>{totalApprovals} total</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, backgroundColor: "var(--bg-tertiary)", overflow: "hidden", display: "flex" }}>
                  {approvedCount > 0 && (
                    <div style={{ width: `${(approvedCount / totalApprovals) * 100}%`, backgroundColor: "#34d399", transition: "width 0.3s" }} />
                  )}
                  {rejectedCount > 0 && (
                    <div style={{ width: `${(rejectedCount / totalApprovals) * 100}%`, backgroundColor: "#f87171", transition: "width 0.3s" }} />
                  )}
                </div>
              </div>

              {/* Individual approvers */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {approvals.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      backgroundColor: "var(--bg-tertiary)",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                        {a.approver?.login?.substring(0, 2).toUpperCase() || "??"}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{a.approver?.login || "Unknown"}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.approver?.email}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {a.status === "approved" && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#34d399", fontSize: 13, fontWeight: 600 }}>
                          <CheckCircle size={15} /> Approved
                        </span>
                      )}
                      {a.status === "rejected" && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#f87171", fontSize: 13, fontWeight: 600 }}>
                          <XCircle size={15} /> Rejected
                        </span>
                      )}
                      {a.status === "pending" && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#fb923c", fontSize: 13, fontWeight: 600 }}>
                          <Clock size={15} /> Pending
                        </span>
                      )}
                      {a.status === "cancelled" && (
                        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Cancelled</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: 10, marginBottom: 12 }}>
              Attachments ({attachments.length})
            </h3>
            {attachments.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                {attachments.map((file) => (
                  <div key={file.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", backgroundColor: "var(--bg-tertiary)", borderRadius: 8, border: "1px solid var(--border-color)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <FileIcon size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={file.filename}>{file.filename}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{(file.file_size / (1024 * 1024)).toFixed(2)} MB</div>
                      </div>
                    </div>
                    <a href={`/api/v1/work-items/${id}/attachments/${file.id}`} download className="btn btn-secondary" style={{ padding: 6, borderRadius: 6 }} title="Download">
                      <Download size={14} />
                    </a>
                  </div>
                ))}
              </div>
            )}
            {attachments.length === 0 && <div style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 13, marginBottom: 16 }}>No attachments.</div>}
            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 14, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <label className="btn btn-secondary" style={{ cursor: "pointer", fontSize: 13, padding: "8px 14px" }}>
                <Upload size={14} /> Select File
                <input type="file" style={{ display: "none" }} onChange={handleFileChange} disabled={uploading} />
              </label>
              {selectedFile && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{selectedFile.name}</span>
                  <button onClick={handleUpload} className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 12 }} disabled={uploading}>{uploading ? "Uploading…" : "Upload"}</button>
                  <button onClick={() => setSelectedFile(null)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}><X size={16} /></button>
                </div>
              )}
            </div>
            {uploadError && <div style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>{uploadError}</div>}
          </div>

          {/* Comments */}
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: 10, marginBottom: 20 }}>
              Activity Feed ({comments.length} comments)
            </h3>
            <div className="activity-feed" style={{ marginBottom: 24 }}>
              {comments.map((comm) => {
                const isInternal = comm.visibility === "internal";
                return (
                  <div key={comm.id} className="activity-item">
                    <div className="activity-icon">
                      {isInternal ? <Lock size={15} style={{ color: "var(--status-assigned-text)" }} /> : <MessageSquare size={15} style={{ color: "var(--primary-color)" }} />}
                    </div>
                    <div className={`activity-content ${isInternal ? "comment-internal" : ""}`}>
                      <div className="activity-header">
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className="activity-author">{comm.author?.login || "System"}</span>
                          {isInternal && (
                            <span className="badge status-assigned" style={{ fontSize: 9, padding: "1px 5px", border: "1px solid rgba(192, 132, 252, 0.3)" }}>
                              <Lock size={10} /> Internal
                            </span>
                          )}
                        </div>
                        <span className="activity-time">{new Date(comm.created_at).toLocaleString()}</span>
                      </div>
                      <div className="activity-body">{comm.text}</div>
                    </div>
                  </div>
                );
              })}
              {comments.length === 0 && <div style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No comments yet.</div>}
            </div>
            <form onSubmit={handlePostComment} style={{ borderTop: "1px solid var(--border-color)", paddingTop: 20 }}>
              {isAgent && (
                <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", fontWeight: commentVisibility === "public" ? 600 : 400 }}>
                    <input type="radio" name="vis" checked={commentVisibility === "public"} onChange={() => setCommentVisibility("public")} />
                    <Eye size={14} style={{ color: "var(--text-muted)" }} /> Public Reply
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", fontWeight: commentVisibility === "internal" ? 600 : 400 }}>
                    <input type="radio" name="vis" checked={commentVisibility === "internal"} onChange={() => setCommentVisibility("internal")} />
                    <Lock size={14} style={{ color: "var(--status-assigned-text)" }} /> Internal Note
                  </label>
                </div>
              )}
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <textarea className="form-textarea" style={{ marginBottom: 0, minHeight: 80 }} placeholder="Add a comment…" value={commentText} onChange={(e) => setCommentText(e.target.value)} required disabled={addCommentMutation.isPending} />
                <button type="submit" className="btn btn-primary" style={{ padding: "12px 20px", alignSelf: "stretch" }} disabled={addCommentMutation.isPending || !commentText.trim()}>
                  <Send size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column — Metadata */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Schedule Window */}
          {(ext?.scheduled_start || ext?.scheduled_end) && (
            <div className="card" style={{ borderLeft: "4px solid var(--status-in_progress-text, #facc15)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <Calendar size={15} style={{ color: "var(--status-progress-text)" }} /> Implementation Window
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>Start: </span>
                  <span style={{ fontWeight: 500 }}>{ext?.scheduled_start ? new Date(ext.scheduled_start).toLocaleString() : "—"}</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)" }}>End: </span>
                  <span style={{ fontWeight: 500 }}>{ext?.scheduled_end ? new Date(ext.scheduled_end).toLocaleString() : "—"}</span>
                </div>
              </div>
            </div>
          )}

          {/* Change Details */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 14 }}>Change Details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <MetaField label="Type" value="CHANGE" />
              <MetaField label="Risk Level" value={risk} capitalize />
              <MetaField label="Expedited" value={ext?.expedited ? "Yes ⚡" : "No"} />
              <MetaField label="Source" value={change.source} capitalize />
              <MetaField label="Created At" value={new Date(change.created_at).toLocaleString()} icon={<Calendar size={13} style={{ color: "var(--text-muted)" }} />} />
              <MetaField label="Updated At" value={new Date(change.updated_at).toLocaleString()} icon={<Calendar size={13} style={{ color: "var(--text-muted)" }} />} />
              {change.resolved_at && <MetaField label="Completed At" value={new Date(change.resolved_at).toLocaleString()} icon={<CheckCircle size={13} style={{ color: "#34d399" }} />} />}
              {change.closed_at && <MetaField label="Closed At" value={new Date(change.closed_at).toLocaleString()} />}
            </div>
          </div>

          {/* People */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 14 }}>Users & Assignments</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase" }}>Requester</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                  <User size={14} style={{ color: "var(--text-muted)" }} />
                  <span>{change.reported_by?.login || "—"}</span>
                </div>
              </div>
              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase" }}>Assigned Group</div>
                <div style={{ fontSize: 13, marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                  <Users size={14} style={{ color: "var(--text-muted)" }} />
                  <span>{change.assigned_group?.name || <span style={{ color: "var(--text-muted)" }}>None</span>}</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase" }}>Assigned Agent</div>
                <div style={{ fontSize: 13, marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                  <User size={14} style={{ color: "var(--text-muted)" }} />
                  <span>{change.assigned_to?.login || <span style={{ color: "var(--text-muted)" }}>Unassigned</span>}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transition Modal */}
      {activeAction && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <form onSubmit={handleTransition} className="card" style={{ width: "100%", maxWidth: 480, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, textTransform: "capitalize" }}>
                {activeAction.replace(/_/g, " ")}
              </h3>
              <button type="button" onClick={() => { setActiveAction(null); setTransitionError(null); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>
            {transitionError && (
              <div style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: 12, marginBottom: 16, color: "#f87171", fontSize: 13, display: "flex", gap: 8 }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>{transitionError}</div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Comment (Optional)</label>
              <textarea className="form-textarea" rows={3} placeholder="Add notes about this transition…" value={transitionComment} onChange={(e) => setTransitionComment(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16, borderTop: "1px solid var(--border-color)", paddingTop: 16 }}>
              <button type="button" onClick={() => { setActiveAction(null); setTransitionError(null); }} className="btn btn-secondary" disabled={transitionMutation.isPending}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={transitionMutation.isPending}>
                {transitionMutation.isPending ? "Applying…" : "Confirm"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

// ── Helper components ──
const PlanField: React.FC<{ label: string; value: string | null | undefined }> = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 14, whiteSpace: "pre-wrap", color: value ? "var(--text-primary)" : "var(--text-muted)", fontStyle: value ? "normal" : "italic", backgroundColor: "var(--bg-tertiary)", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border-color)", minHeight: 40 }}>
      {value || "Not provided"}
    </div>
  </div>
);

const MetaField: React.FC<{ label: string; value: string; capitalize?: boolean; icon?: React.ReactNode }> = ({ label, value, capitalize, icon }) => (
  <div>
    <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase" }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginTop: 2, textTransform: capitalize ? "capitalize" : undefined, display: "flex", alignItems: "center", gap: 6 }}>
      {icon}
      {value}
    </div>
  </div>
);
