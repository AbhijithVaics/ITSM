import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { StatusBadge, PriorityBadge } from "../../components/Badges";
import { SlaClock } from "./SlaClock";
import { 
  ArrowLeft, 
  MessageSquare, 
  Lock, 
  Eye, 
  Upload, 
  Download, 
  File, 
  User, 
  Users, 
  CheckCircle,
  X,
  Send,
  Calendar,
  AlertCircle
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

interface IncidentExtension {
  urgency: number;
  impact: number;
  category: string;
  subcategory: string;
  resolution_code: string | null;
  resolution_note: string | null;
}

interface TicketDetail {
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
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  extension: IncidentExtension | null;
  available_actions: string[] | null;
  sla_clocks: {
    id: string;
    metric: string;
    status: string;
    started_at: string;
    paused_at: string | null;
    deadline: string;
    breached_at: string | null;
    is_breached: boolean;
  }[] | null;
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

interface GroupMember {
  id: string;
  login: string;
  email: string;
}

interface GroupResponse {
  id: string;
  name: string;
  members: GroupMember[];
}

export const IncidentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isAgent = user?.role !== "requester";

  // Form / Action states
  const [commentText, setCommentText] = useState("");
  const [commentVisibility, setCommentVisibility] = useState<"public" | "internal">("public");
  
  // File Upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Transition Actions states
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [transitionComment, setTransitionComment] = useState("");
  const [resCode, setResCode] = useState("fixed");
  const [resNote, setResNote] = useState("");
  const [assignGroup, setAssignGroup] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [transitionError, setTransitionError] = useState<string | null>(null);

  // Fetch Ticket Detail
  const { data: ticket, isLoading: ticketLoading, error: ticketError } = useQuery<TicketDetail>({
    queryKey: ["ticket", id],
    queryFn: () => apiRequest<TicketDetail>(`/work-items/${id}`),
    refetchInterval: 30000, // Poll every 30s
  });

  // Fetch Comments
  const { data: comments = [] } = useQuery<CommentItem[]>({
    queryKey: ["comments", id],
    queryFn: () => apiRequest<CommentItem[]>(`/work-items/${id}/comments`),
    enabled: !!id,
  });

  // Fetch Attachments
  const { data: attachments = [] } = useQuery<AttachmentItem[]>({
    queryKey: ["attachments", id],
    queryFn: () => apiRequest<AttachmentItem[]>(`/work-items/${id}/attachments`),
    enabled: !!id,
  });

  // Fetch Groups for assignment list
  const { data: groups = [] } = useQuery<GroupResponse[]>({
    queryKey: ["groups-assignment"],
    queryFn: () => apiRequest<GroupResponse[]>("/admin/groups?is_active=true"),
    enabled: isAgent && activeAction === "assign",
  });

  // Populate assignment defaults when assign action is opened
  useEffect(() => {
    if (activeAction === "assign" && ticket) {
      setAssignGroup(ticket.assigned_group?.id || "");
      setAssignTo(ticket.assigned_to?.id || "");
    }
  }, [activeAction, ticket]);

  // Mutations
  const addCommentMutation = useMutation({
    mutationFn: (newComment: { text: string; visibility: "public" | "internal" }) => {
      return apiRequest(`/work-items/${id}/comments`, {
        method: "POST",
        body: JSON.stringify(newComment),
      });
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
    },
  });

  const transitionMutation = useMutation({
    mutationFn: (payload: any) => {
      return apiRequest(`/work-items/${id}/transitions`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setActiveAction(null);
      setTransitionComment("");
      setResNote("");
      setTransitionError(null);
      queryClient.invalidateQueries({ queryKey: ["ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
    },
    onError: (err: any) => {
      setTransitionError(err.detail || err.message || "Failed to execute transition.");
    }
  });

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addCommentMutation.mutate({
      text: commentText,
      visibility: isAgent ? commentVisibility : "public",
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 25 * 1024 * 1024) {
        setUploadError("File size exceeds the 25MB limit.");
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setUploadError(null);
    }
  };

  const handleUploadAttachment = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      await apiRequest(`/work-items/${id}/attachments`, {
        method: "POST",
        body: formData,
      });
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ["attachments", id] });
    } catch (err: any) {
      setUploadError(err.detail || err.message || "File upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleExecuteTransition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAction) return;

    const payload: any = {
      action: activeAction,
      comment: transitionComment.trim() || undefined,
    };

    if (activeAction === "resolve") {
      if (!resNote.trim()) {
        setTransitionError("Resolution note is required.");
        return;
      }
      payload.resolution_code = resCode;
      payload.resolution_note = resNote;
    }

    if (activeAction === "assign") {
      if (!assignGroup) {
        setTransitionError("Assigned group is required.");
        return;
      }
      payload.assigned_group_id = assignGroup;
      payload.assigned_to_id = assignTo || null;
    }

    transitionMutation.mutate(payload);
  };

  // Assignee dropdown population based on group
  const activeGroupObj = groups.find(g => g.id === assignGroup);
  const availableAssignees = activeGroupObj ? activeGroupObj.members : [];

  // Reset assignee if it is not in the newly selected group
  useEffect(() => {
    if (assignGroup && assignTo) {
      const isMember = availableAssignees.some(m => m.id === assignTo);
      if (!isMember) {
        setAssignTo("");
      }
    }
  }, [assignGroup, availableAssignees, assignTo]);



  if (ticketLoading) {
    return (
      <div style={{ display: "flex", height: "50vh", alignItems: "center", justifyContent: "center" }}>
        <div className="avatar" style={{ width: 40, height: 40, animation: "spin 1s linear infinite" }}>⏳</div>
        <span style={{ marginLeft: 12, color: "var(--text-secondary)" }}>Loading ticket details...</span>
      </div>
    );
  }

  if (ticketError || !ticket) {
    return (
      <div className="card" style={{ border: "1px solid rgba(239, 68, 68, 0.2)", backgroundColor: "rgba(239, 68, 68, 0.05)", padding: 32, textAlign: "center" }}>
        <p style={{ color: "#f87171", fontSize: 16, fontWeight: 600 }}>Failed to load ticket details</p>
        <p style={{ color: "var(--text-secondary)", marginTop: 6, fontSize: 13 }}>{(ticketError as any)?.detail || ticketError?.message || "Verify your connection or ticket access privileges."}</p>
        <button onClick={() => navigate(isAgent ? "/queue" : "/portal")} className="btn btn-secondary" style={{ marginTop: 16 }}>
          Back to list
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Back Button & Header */}
      <div>
        <Link 
          to={isAgent ? "/queue" : "/portal"} 
          style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", fontSize: 13, fontWeight: 500, marginBottom: 16 }}
          onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
        >
          <ArrowLeft size={16} />
          {isAgent ? "Back to Work Queue" : "Back to My Tickets"}
        </Link>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 16, fontWeight: 600, color: "var(--text-muted)" }}>
                {ticket.display_id}
              </span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, marginTop: 8 }}>{ticket.title}</h1>
          </div>

          {/* Workflow Action Buttons (Requesters only see Close/Reopen if status allows, agents see all) */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ticket.available_actions?.map((act) => (
              <button
                key={act}
                onClick={() => {
                  setActiveAction(act);
                  setTransitionError(null);
                }}
                className={`btn ${act === "resolve" ? "btn-primary" : "btn-secondary"}`}
                style={{ textTransform: "capitalize", padding: "8px 16px", fontSize: 13 }}
              >
                {act.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr", gap: 24 }}>
        {/* Left Column - Details, Attachments, Comments */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Description */}
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: 10, marginBottom: 12 }}>
              Description
            </h3>
            <div style={{ color: "var(--text-primary)", fontSize: 14, whiteSpace: "pre-wrap", minHeight: 60 }}>
              {ticket.description || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No description provided.</span>}
            </div>
          </div>

          {/* Resolution Details if resolved/closed */}
          {ticket.extension?.resolution_code && (
            <div className="card" style={{ borderLeft: "4px solid var(--status-resolved-text)", backgroundColor: "rgba(16, 185, 129, 0.03)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--status-resolved-text)", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle size={18} />
                Resolution Information
              </h3>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>
                <strong>Code:</strong> <span style={{ textTransform: "capitalize" }}>{ticket.extension.resolution_code.replace("_", " ")}</span>
              </div>
              <div style={{ fontSize: 14, whiteSpace: "pre-wrap", color: "var(--text-primary)" }}>
                <strong>Note:</strong> {ticket.extension.resolution_note}
              </div>
            </div>
          )}

          {/* Attachments Panel */}
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: 10, marginBottom: 12 }}>
              Attachments ({attachments.length})
            </h3>
            
            {attachments.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                {attachments.map((file) => {
                  const downloadUrl = `/api/v1/work-items/${id}/attachments/${file.id}`;
                  return (
                    <div 
                      key={file.id}
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "space-between", 
                        padding: "10px 14px", 
                        backgroundColor: "var(--bg-tertiary)", 
                        borderRadius: 8, 
                        border: "1px solid var(--border-color)"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <File size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }} title={file.filename}>
                            {file.filename}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {(file.file_size / (1024 * 1024)).toFixed(2)} MB
                          </div>
                        </div>
                      </div>
                      <a 
                        href={downloadUrl} 
                        download 
                        className="btn btn-secondary" 
                        style={{ padding: 6, borderRadius: 6 }}
                        title="Download file"
                      >
                        <Download size={14} />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}

            {attachments.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 13, marginBottom: 16 }}>
                No file attachments on this ticket.
              </div>
            )}

            {/* Upload Area */}
            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 14, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <label className="btn btn-secondary" style={{ cursor: "pointer", fontSize: 13, padding: "8px 14px" }}>
                <Upload size={14} />
                Select File
                <input type="file" style={{ display: "none" }} onChange={handleFileChange} disabled={uploading} />
              </label>
              
              {selectedFile && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
                    {selectedFile.name}
                  </span>
                  <button 
                    onClick={handleUploadAttachment} 
                    className="btn btn-primary"
                    style={{ padding: "6px 12px", fontSize: 12 }}
                    disabled={uploading}
                  >
                    {uploading ? "Uploading..." : "Upload"}
                  </button>
                  <button 
                    onClick={() => setSelectedFile(null)} 
                    style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}
                    disabled={uploading}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
            {uploadError && (
              <div style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>{uploadError}</div>
            )}
          </div>

          {/* Activity / Comments Timeline */}
          <div className="card">
            <h3 style={{ fontSize: 15, fontWeight: 600, borderBottom: "1px solid var(--border-color)", paddingBottom: 10, marginBottom: 20 }}>
              Activity Feed ({comments.length} comments)
            </h3>

            {/* Comments List */}
            <div className="activity-feed" style={{ marginBottom: 24 }}>
              {comments.map((comm) => {
                const isInternal = comm.visibility === "internal";
                return (
                  <div key={comm.id} className="activity-item">
                    <div className="activity-icon">
                      {isInternal ? (
                        <Lock size={15} style={{ color: "var(--status-assigned-text)" }} />
                      ) : (
                        <MessageSquare size={15} style={{ color: "var(--primary-color)" }} />
                      )}
                    </div>
                    <div className={`activity-content ${isInternal ? "comment-internal" : ""}`}>
                      <div className="activity-header">
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className="activity-author">{comm.author?.login || "System"}</span>
                          {isInternal && (
                            <span 
                              className="badge status-assigned" 
                              style={{ 
                                fontSize: 9, 
                                padding: "1px 5px", 
                                border: "1px solid rgba(192, 132, 252, 0.3)", 
                                color: "var(--status-assigned-text)", 
                                display: "inline-flex", 
                                alignItems: "center", 
                                gap: 2 
                              }}
                            >
                              <Lock size={10} /> Internal Note
                            </span>
                          )}
                        </div>
                        <span className="activity-time">
                          {new Date(comm.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="activity-body">{comm.text}</div>
                    </div>
                  </div>
                );
              })}

              {comments.length === 0 && (
                <div style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                  No comments or notes posted yet.
                </div>
              )}
            </div>

            {/* Add Comment Input */}
            <form onSubmit={handlePostComment} style={{ borderTop: "1px solid var(--border-color)", paddingTop: 20 }}>
              {isAgent && (
                <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", fontWeight: commentVisibility === "public" ? 600 : 400 }}>
                    <input 
                      type="radio" 
                      name="visibility" 
                      checked={commentVisibility === "public"} 
                      onChange={() => setCommentVisibility("public")} 
                    />
                    <Eye size={14} style={{ color: "var(--text-muted)" }} />
                    Public Reply (Visible to Employee)
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", fontWeight: commentVisibility === "internal" ? 600 : 400 }}>
                    <input 
                      type="radio" 
                      name="visibility" 
                      checked={commentVisibility === "internal"} 
                      onChange={() => setCommentVisibility("internal")} 
                    />
                    <Lock size={14} style={{ color: "var(--status-assigned-text)" }} />
                    Internal Note (Agent Only)
                  </label>
                </div>
              )}

              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <textarea
                  className="form-textarea"
                  style={{ marginBottom: 0, minHeight: 80 }}
                  placeholder={
                    isAgent 
                      ? (commentVisibility === "internal" ? "Add private internal note..." : "Reply to requester...") 
                      : "Type a reply to the support team..."
                  }
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  required
                  disabled={addCommentMutation.isPending}
                />
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ padding: "12px 20px", alignSelf: "stretch" }}
                  disabled={addCommentMutation.isPending || !commentText.trim()}
                >
                  <Send size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column - Metadata & Details Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* SLA Clocks (Incident-only, non-terminal statuses) */}
          {ticket.work_item_type === "incident" && !["resolved", "closed", "cancelled"].includes(ticket.status) && (
            <SlaClock clocks={ticket.sla_clocks} />
          )}

          {/* Ticket Information */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 14 }}>Ticket Details</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase" }}>Type</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginTop: 2, textTransform: "uppercase" }}>
                  {ticket.work_item_type}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase" }}>Category</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginTop: 2 }}>
                  {ticket.extension?.category || "None"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase" }}>Subcategory</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginTop: 2 }}>
                  {ticket.extension?.subcategory || "None"}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase" }}>Source</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginTop: 2, textTransform: "capitalize" }}>
                  {ticket.source}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase" }}>Created At</div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                  <Calendar size={13} style={{ color: "var(--text-muted)" }} />
                  {new Date(ticket.created_at).toLocaleString()}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase" }}>Updated At</div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                  <Calendar size={13} style={{ color: "var(--text-muted)" }} />
                  {new Date(ticket.updated_at).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* People & Assignment */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 14 }}>Users & Assignments</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase" }}>Reporter</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="avatar" style={{ width: 22, height: 22, fontSize: 10, backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                    <User size={12} />
                  </div>
                  <div>
                    <div>{ticket.reported_by?.login}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{ticket.reported_by?.email}</div>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase" }}>Assigned Group</div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                  <Users size={14} style={{ color: "var(--text-muted)" }} />
                  <span>{ticket.assigned_group?.name || <span style={{ color: "var(--text-muted)" }}>None</span>}</span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase" }}>Assigned Agent</div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                  <User size={14} style={{ color: "var(--text-muted)" }} />
                  <span>{ticket.assigned_to?.login || <span style={{ color: "var(--text-muted)" }}>Unassigned</span>}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dialog Backdrop / Modals for custom workflow actions */}
      {activeAction && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <form onSubmit={handleExecuteTransition} className="card" style={{ width: "100%", maxWidth: 500, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, textTransform: "capitalize" }}>
                Execute Action: {activeAction.replace("_", " ")}
              </h3>
              <button 
                type="button" 
                onClick={() => {
                  setActiveAction(null);
                  setTransitionError(null);
                }} 
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {transitionError && (
              <div 
                style={{ 
                  backgroundColor: "rgba(239, 68, 68, 0.1)", 
                  border: "1px solid rgba(239, 68, 68, 0.2)", 
                  borderRadius: 6, 
                  padding: 12, 
                  marginBottom: 16,
                  display: "flex",
                  gap: 8,
                  color: "#f87171",
                  fontSize: 13
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>{transitionError}</div>
              </div>
            )}

            {/* Resolve Transition Inputs */}
            {activeAction === "resolve" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="res-code">Resolution Code *</label>
                  <select 
                    id="res-code" 
                    className="form-select" 
                    value={resCode} 
                    onChange={(e) => setResCode(e.target.value)}
                    required
                  >
                    <option value="fixed">Fixed / Solved</option>
                    <option value="workaround">Workaround Implemented</option>
                    <option value="known_error">Known Error (No Action)</option>
                    <option value="cannot_reproduce">Cannot Reproduce</option>
                    <option value="user_error">User Training / Error</option>
                    <option value="duplicate">Duplicate Ticket</option>
                    <option value="not_an_issue">Not An Issue</option>
                    <option value="other">Other / General</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="res-note">Resolution Details / Note *</label>
                  <textarea 
                    id="res-note" 
                    className="form-textarea" 
                    rows={4} 
                    placeholder="Provide details on how the incident was resolved..." 
                    value={resNote} 
                    onChange={(e) => setResNote(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {/* Assign/Reassign Transition Inputs */}
            {activeAction === "assign" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="assign-group">Assigned Group *</label>
                  <select 
                    id="assign-group" 
                    className="form-select" 
                    value={assignGroup} 
                    onChange={(e) => setAssignGroup(e.target.value)}
                    required
                  >
                    <option value="">-- Select Group --</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="assign-to">Assigned Agent</label>
                  <select 
                    id="assign-to" 
                    className="form-select" 
                    value={assignTo} 
                    onChange={(e) => setAssignTo(e.target.value)}
                    disabled={!assignGroup}
                  >
                    <option value="">-- Unassigned / Any --</option>
                    {availableAssignees.map((m) => (
                      <option key={m.id} value={m.id}>{m.login}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* General Comment for any transition */}
            <div className="form-group">
              <label className="form-label" htmlFor="trans-comm">
                Comment (Optional{activeAction === "resolve" ? "" : " - will post as public comment"})
              </label>
              <textarea 
                id="trans-comm" 
                className="form-textarea" 
                rows={3} 
                placeholder="Add comments regarding this status change..." 
                value={transitionComment} 
                onChange={(e) => setTransitionComment(e.target.value)}
              />
            </div>

            {/* Footer Buttons */}
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24, borderTop: "1px solid var(--border-color)", paddingTop: 16 }}>
              <button 
                type="button" 
                onClick={() => {
                  setActiveAction(null);
                  setTransitionError(null);
                }} 
                className="btn btn-secondary"
                disabled={transitionMutation.isPending}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={transitionMutation.isPending}
              >
                {transitionMutation.isPending ? "Applying Change..." : "Confirm Action"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
