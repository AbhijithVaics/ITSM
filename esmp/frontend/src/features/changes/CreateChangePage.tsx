import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../api/client";
import { AlertCircle, ArrowLeft, ShieldAlert } from "lucide-react";

interface GroupMember {
  id: string;
  login: string;
  email: string;
}

interface GroupResponse {
  id: string;
  name: string;
  description: string | null;
  type: string;
  is_active: boolean;
  members: GroupMember[];
}

export const CreateChangePage: React.FC = () => {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [riskLevel, setRiskLevel] = useState("low");
  const [expedited, setExpedited] = useState(false);
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [implementationPlan, setImplementationPlan] = useState("");
  const [backoutPlan, setBackoutPlan] = useState("");
  const [validationPlan, setValidationPlan] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch Assignment Groups
  const { data: groups = [] } = useQuery<GroupResponse[]>({
    queryKey: ["groups"],
    queryFn: () => apiRequest<GroupResponse[]>("/admin/groups?is_active=true"),
  });

  const activeGroupObj = groups.find(g => g.id === selectedGroup);
  const availableAssignees = activeGroupObj ? activeGroupObj.members : [];

  // Reset assignee filter if the group filter changes
  useEffect(() => {
    if (selectedGroup && selectedAssignee) {
      const isMember = availableAssignees.some(m => m.id === selectedAssignee);
      if (!isMember) {
        setSelectedAssignee("");
      }
    }
  }, [selectedGroup, availableAssignees, selectedAssignee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const changeRequest = await apiRequest<any>("/changes", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          risk_level: riskLevel,
          expedited,
          scheduled_start: scheduledStart ? new Date(scheduledStart).toISOString() : null,
          scheduled_end: scheduledEnd ? new Date(scheduledEnd).toISOString() : null,
          implementation_plan: implementationPlan || null,
          backout_plan: backoutPlan || null,
          validation_plan: validationPlan || null,
          assigned_group_id: selectedGroup || null,
          assigned_to_id: selectedAssignee || null,
        }),
      });

      // Redirect to the generic queue detail page, which maps changes as well
      navigate(`/queue/${changeRequest.id}`);
    } catch (err: any) {
      setErrorMsg(err.detail || err.message || "Failed to create Change Request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Link 
          to="/queue" 
          style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", fontSize: 13, fontWeight: 500 }}
          onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
        >
          <ArrowLeft size={16} />
          Back to Work Queue
        </Link>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <ShieldAlert size={28} style={{ color: "var(--primary-color)" }} />
            Create Change Request
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            Draft a new Change Request (CR) and define its risk level, scheduled window, and implementation procedures.
          </p>
        </div>

        {errorMsg && (
          <div 
            style={{ 
              backgroundColor: "rgba(239, 68, 68, 0.1)", 
              border: "1px solid rgba(239, 68, 68, 0.2)", 
              borderRadius: 8, 
              padding: 16, 
              marginBottom: 24,
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              color: "#f87171",
              fontSize: 14
            }}
          >
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong style={{ fontWeight: 600 }}>Error Creating Change Request</strong>
              <div style={{ marginTop: 2 }}>{errorMsg}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="card" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="title">Title / Subject *</label>
            <input
              id="title"
              type="text"
              className="form-input"
              placeholder="e.g. Upgrade PostgreSQL database cluster to v16"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={submitting}
              maxLength={250}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="description">Detailed Description</label>
            <textarea
              id="description"
              className="form-textarea"
              placeholder="Describe the scope, background, and business justification for the change..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              rows={4}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="risk-level">Risk Level</label>
              <select
                id="risk-level"
                className="form-select"
                value={riskLevel}
                onChange={(e) => setRiskLevel(e.target.value)}
                disabled={submitting}
              >
                <option value="low">Low Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="high">High Risk</option>
                <option value="critical">Critical Risk</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", height: "100%", paddingTop: 20 }}>
                <input
                  type="checkbox"
                  checked={expedited}
                  onChange={(e) => setExpedited(e.target.checked)}
                  disabled={submitting}
                  style={{ width: 18, height: 18, cursor: "pointer" }}
                />
                <span>Expedited / Emergency Change</span>
              </label>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="scheduled-start">Scheduled Start Date & Time</label>
              <input
                id="scheduled-start"
                type="datetime-local"
                className="form-input"
                value={scheduledStart}
                onChange={(e) => setScheduledStart(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="scheduled-end">Scheduled End Date & Time</label>
              <input
                id="scheduled-end"
                type="datetime-local"
                className="form-input"
                value={scheduledEnd}
                onChange={(e) => setScheduledEnd(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="assigned-group">Assignment Group</label>
              <select
                id="assigned-group"
                className="form-select"
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                disabled={submitting}
              >
                <option value="">-- Unassigned --</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="assigned-to">Assignee</label>
              <select
                id="assigned-to"
                className="form-select"
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value)}
                disabled={submitting || !selectedGroup}
              >
                <option value="">-- Unassigned --</option>
                {availableAssignees.map((member) => (
                  <option key={member.id} value={member.id}>{member.login}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 20, marginTop: 10, display: "flex", flexDirection: "column", gap: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Implementation Plans</h3>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="implementation-plan">Implementation Plan</label>
              <textarea
                id="implementation-plan"
                className="form-textarea"
                placeholder="Step-by-step implementation procedure..."
                value={implementationPlan}
                onChange={(e) => setImplementationPlan(e.target.value)}
                disabled={submitting}
                rows={3}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="backout-plan">Backout / Rollback Plan</label>
              <textarea
                id="backout-plan"
                className="form-textarea"
                placeholder="Rollback procedure in case of failure..."
                value={backoutPlan}
                onChange={(e) => setBackoutPlan(e.target.value)}
                disabled={submitting}
                rows={3}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="validation-plan">Validation / Post-Deployment Test Plan</label>
              <textarea
                id="validation-plan"
                className="form-textarea"
                placeholder="Steps to verify the change was successful..."
                value={validationPlan}
                onChange={(e) => setValidationPlan(e.target.value)}
                disabled={submitting}
                rows={3}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 12 }}>
            <Link to="/queue" className="btn btn-secondary">
              Cancel
            </Link>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !title}
            >
              Create Draft
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
