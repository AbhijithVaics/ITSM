import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/client";
import { 
  Clock, 
  Plus, 
  Calendar, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  AlertCircle 
} from "lucide-react";

interface SlaPolicy {
  id: string;
  name: string;
  description: string | null;
  work_item_type: string;
  priority: string;
  response_target_mins: number;
  resolution_target_mins: number;
  calendar_id: string | null;
}

interface BusinessCalendar {
  id: string;
  name: string;
  timezone: string;
  working_days: number[];
  start_time: string;
  end_time: string;
  is_default: boolean;
}

export const SlaConfigPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"policies" | "calendars">("policies");
  
  // States for Policy Dialog/Form
  const [policyFormOpen, setPolicyFormOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<SlaPolicy | null>(null);
  const [policyName, setPolicyName] = useState("");
  const [policyDesc, setPolicyDesc] = useState("");
  const [policyType, setPolicyType] = useState("incident");
  const [policyPriority, setPolicyPriority] = useState("P3");
  const [policyResponseMins, setPolicyResponseMins] = useState(60);
  const [policyResolutionMins, setPolicyResolutionMins] = useState(480);
  const [policyCalendarId, setPolicyCalendarId] = useState("");

  // States for Calendar Dialog/Form
  const [calendarFormOpen, setCalendarFormOpen] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<BusinessCalendar | null>(null);
  const [calendarName, setCalendarName] = useState("");
  const [calendarTz, setCalendarTz] = useState("Asia/Kolkata");
  const [calendarWorkingDays, setCalendarWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [calendarStartTime, setCalendarStartTime] = useState("09:00:00");
  const [calendarEndTime, setCalendarEndTime] = useState("18:00:00");
  const [calendarIsDefault, setCalendarIsDefault] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);

  // Queries
  const { data: policies = [], isLoading: policiesLoading } = useQuery<SlaPolicy[]>({
    queryKey: ["admin-sla-policies"],
    queryFn: () => apiRequest<SlaPolicy[]>("/admin/sla/policies"),
  });

  const { data: calendars = [], isLoading: calendarsLoading } = useQuery<BusinessCalendar[]>({
    queryKey: ["admin-sla-calendars"],
    queryFn: () => apiRequest<BusinessCalendar[]>("/admin/sla/calendars"),
  });

  // Policy Mutations
  const savePolicyMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: any }) => {
      const url = id ? `/admin/sla/policies/${id}` : "/admin/sla/policies";
      const method = id ? "PUT" : "POST";
      return apiRequest(url, { method, body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sla-policies"] });
      setPolicyFormOpen(false);
      setEditingPolicy(null);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.detail || err.message || "Failed to save SLA policy");
    }
  });

  const deletePolicyMutation = useMutation({
    mutationFn: (id: string) => {
      return apiRequest(`/admin/sla/policies/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sla-policies"] });
    }
  });

  // Calendar Mutations
  const saveCalendarMutation = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: any }) => {
      const url = id ? `/admin/sla/calendars/${id}` : "/admin/sla/calendars";
      const method = id ? "PUT" : "POST";
      return apiRequest(url, { method, body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sla-calendars"] });
      setCalendarFormOpen(false);
      setEditingCalendar(null);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.detail || err.message || "Failed to save calendar");
    }
  });

  const deleteCalendarMutation = useMutation({
    mutationFn: (id: string) => {
      return apiRequest(`/admin/sla/calendars/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sla-calendars"] });
    }
  });

  // Form Openers
  const openNewPolicyForm = () => {
    setEditingPolicy(null);
    setPolicyName("");
    setPolicyDesc("");
    setPolicyType("incident");
    setPolicyPriority("P3");
    setPolicyResponseMins(60);
    setPolicyResolutionMins(480);
    setPolicyCalendarId(calendars.find(c => c.is_default)?.id || "");
    setFormError(null);
    setPolicyFormOpen(true);
  };

  const openEditPolicyForm = (policy: SlaPolicy) => {
    setEditingPolicy(policy);
    setPolicyName(policy.name);
    setPolicyDesc(policy.description || "");
    setPolicyType(policy.work_item_type);
    setPolicyPriority(policy.priority);
    setPolicyResponseMins(policy.response_target_mins);
    setPolicyResolutionMins(policy.resolution_target_mins);
    setPolicyCalendarId(policy.calendar_id || "");
    setFormError(null);
    setPolicyFormOpen(true);
  };

  const handlePolicySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyName || !policyPriority || !policyResponseMins || !policyResolutionMins) {
      setFormError("All required fields must be filled.");
      return;
    }
    const payload = {
      name: policyName,
      description: policyDesc || null,
      work_item_type: policyType,
      priority: policyPriority,
      response_target_mins: Number(policyResponseMins),
      resolution_target_mins: Number(policyResolutionMins),
      calendar_id: policyCalendarId || null
    };
    savePolicyMutation.mutate({ id: editingPolicy?.id, payload });
  };

  const openNewCalendarForm = () => {
    setEditingCalendar(null);
    setCalendarName("");
    setCalendarTz("Asia/Kolkata");
    setCalendarWorkingDays([1, 2, 3, 4, 5]);
    setCalendarStartTime("09:00:00");
    setCalendarEndTime("18:00:00");
    setCalendarIsDefault(false);
    setFormError(null);
    setCalendarFormOpen(true);
  };

  const openEditCalendarForm = (calendar: BusinessCalendar) => {
    setEditingCalendar(calendar);
    setCalendarName(calendar.name);
    setCalendarTz(calendar.timezone);
    setCalendarWorkingDays(calendar.working_days);
    setCalendarStartTime(calendar.start_time);
    setCalendarEndTime(calendar.end_time);
    setCalendarIsDefault(calendar.is_default);
    setFormError(null);
    setCalendarFormOpen(true);
  };

  const handleCalendarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!calendarName || !calendarTz || !calendarStartTime || !calendarEndTime) {
      setFormError("All fields must be filled.");
      return;
    }
    const payload = {
      name: calendarName,
      timezone: calendarTz,
      working_days: calendarWorkingDays,
      start_time: calendarStartTime,
      end_time: calendarEndTime,
      is_default: calendarIsDefault
    };
    saveCalendarMutation.mutate({ id: editingCalendar?.id, payload });
  };

  const toggleWorkingDay = (day: number) => {
    if (calendarWorkingDays.includes(day)) {
      setCalendarWorkingDays(calendarWorkingDays.filter(d => d !== day));
    } else {
      setCalendarWorkingDays([...calendarWorkingDays, day].sort());
    }
  };

  const formatDaysList = (days: number[]) => {
    const map: { [d: number]: string } = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 0: "Sun" };
    return days.map(d => map[d]).join(", ");
  };

  const isLoading = policiesLoading || calendarsLoading;

  if (isLoading) {
    return (
      <div style={{ display: "flex", height: "50vh", alignItems: "center", justifyContent: "center" }}>
        <div className="avatar" style={{ width: 40, height: 40, animation: "spin 1s linear infinite" }}>⏳</div>
        <span style={{ marginLeft: 12, color: "var(--text-secondary)" }}>Loading configurations...</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 12 }}>
            <Clock size={32} style={{ color: "var(--primary-color)" }} />
            SLA & Calendar Settings
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            Configure target response/resolution policies and business calendar times.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", gap: 24 }}>
        <button 
          onClick={() => setActiveTab("policies")}
          style={{ 
            padding: "12px 4px", 
            background: "none", 
            border: "none", 
            color: activeTab === "policies" ? "var(--text-primary)" : "var(--text-muted)", 
            fontWeight: 600,
            cursor: "pointer",
            borderBottom: activeTab === "policies" ? "2px solid var(--primary-color)" : "none",
            fontSize: 15
          }}
        >
          SLA Target Policies
        </button>
        <button 
          onClick={() => setActiveTab("calendars")}
          style={{ 
            padding: "12px 4px", 
            background: "none", 
            border: "none", 
            color: activeTab === "calendars" ? "var(--text-primary)" : "var(--text-muted)", 
            fontWeight: 600,
            cursor: "pointer",
            borderBottom: activeTab === "calendars" ? "2px solid var(--primary-color)" : "none",
            fontSize: 15
          }}
        >
          Business Calendars
        </button>
      </div>

      {/* Tab: SLA Policies */}
      {activeTab === "policies" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={openNewPolicyForm} className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Plus size={16} />
              <span>Create SLA Policy</span>
            </button>
          </div>

          {/* Policies Table */}
          <div className="card" style={{ padding: 0 }}>
            <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)", textAlign: "left" }}>
                  <th style={{ padding: 16 }}>Policy Name</th>
                  <th style={{ padding: 16 }}>Type</th>
                  <th style={{ padding: 16 }}>Priority</th>
                  <th style={{ padding: 16 }}>Target Response</th>
                  <th style={{ padding: 16 }}>Target Resolution</th>
                  <th style={{ padding: 16 }}>Calendar</th>
                  <th style={{ padding: 16, width: 100, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {policies.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
                      No custom SLA policies configured. Using system priority-matrix default fallbacks.
                    </td>
                  </tr>
                ) : (
                  policies.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td style={{ padding: 16, fontWeight: 500 }}>
                        <div>{p.name}</div>
                        {p.description && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{p.description}</div>}
                      </td>
                      <td style={{ padding: 16, textTransform: "capitalize", fontSize: 13 }}>
                        {p.work_item_type}
                      </td>
                      <td style={{ padding: 16 }}>
                        <span className={`badge priority-${p.priority.toLowerCase()}`} style={{ fontSize: 11, padding: "2px 8px" }}>
                          {p.priority}
                        </span>
                      </td>
                      <td style={{ padding: 16, fontSize: 13 }}>
                        {p.response_target_mins} mins
                      </td>
                      <td style={{ padding: 16, fontSize: 13 }}>
                        {p.resolution_target_mins} mins
                      </td>
                      <td style={{ padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>
                        {calendars.find(c => c.id === p.calendar_id)?.name || "Default Calendar"}
                      </td>
                      <td style={{ padding: 16, textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button onClick={() => openEditPolicyForm(p)} title="Edit" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }} className="hover-text-primary">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => { if(confirm("Are you sure?")) deletePolicyMutation.mutate(p.id) }} title="Delete" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }} className="hover-text-danger">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Calendars */}
      {activeTab === "calendars" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={openNewCalendarForm} className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Plus size={16} />
              <span>Create Calendar</span>
            </button>
          </div>

          {/* Calendars Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            {calendars.map((c) => (
              <div key={c.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 16, border: c.is_default ? "1.5px solid var(--primary-color)" : "1px solid var(--border-color)", padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Calendar size={18} style={{ color: "var(--primary-color)" }} />
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{c.name}</span>
                  </div>
                  {c.is_default && (
                    <span className="badge status-resolved" style={{ fontSize: 10, padding: "2px 6px" }}>
                      Active Default
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Timezone</span>
                    <strong style={{ color: "var(--text-primary)" }}>{c.timezone}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Working Hours</span>
                    <strong style={{ color: "var(--text-primary)" }}>{c.start_time.substring(0, 5)} - {c.end_time.substring(0, 5)}</strong>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ color: "var(--text-secondary)" }}>Working Days</span>
                    <strong style={{ color: "var(--text-primary)", fontSize: 12 }}>{formatDaysList(c.working_days)}</strong>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, borderTop: "1px solid var(--border-color)", paddingTop: 14, marginTop: 4 }}>
                  <button onClick={() => openEditCalendarForm(c)} className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <Edit2 size={13} />
                    <span>Edit</span>
                  </button>
                  <button 
                    onClick={() => { if(confirm("Are you sure?")) deleteCalendarMutation.mutate(c.id) }} 
                    disabled={c.is_default}
                    className="btn btn-secondary" 
                    style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: c.is_default ? "var(--text-muted)" : "#f87171" }}
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Policy Edit Modal */}
      {policyFormOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: 20, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                {editingPolicy ? "Edit SLA Policy" : "New SLA Policy"}
              </h3>
              <button onClick={() => setPolicyFormOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 6, padding: 12, color: "#f87171", fontSize: 13 }}>
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handlePolicySubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className="label" style={{ fontSize: 12, marginBottom: 6 }}>Policy Name *</label>
                <input type="text" className="input-field" value={policyName} onChange={e => setPolicyName(e.target.value)} required />
              </div>

              <div>
                <label className="label" style={{ fontSize: 12, marginBottom: 6 }}>Description</label>
                <input type="text" className="input-field" value={policyDesc} onChange={e => setPolicyDesc(e.target.value)} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="label" style={{ fontSize: 12, marginBottom: 6 }}>Work Item Type</label>
                  <select className="input-field" value={policyType} onChange={e => setPolicyType(e.target.value)}>
                    <option value="incident">Incident</option>
                    <option value="change">Change</option>
                  </select>
                </div>
                <div>
                  <label className="label" style={{ fontSize: 12, marginBottom: 6 }}>Priority Level *</label>
                  <select className="input-field" value={policyPriority} onChange={e => setPolicyPriority(e.target.value)}>
                    <option value="P1">P1 (Critical)</option>
                    <option value="P2">P2 (High)</option>
                    <option value="P3">P3 (Medium)</option>
                    <option value="P4">P4 (Low)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="label" style={{ fontSize: 12, marginBottom: 6 }}>Target Response (mins) *</label>
                  <input type="number" className="input-field" value={policyResponseMins} onChange={e => setPolicyResponseMins(Number(e.target.value))} required />
                </div>
                <div>
                  <label className="label" style={{ fontSize: 12, marginBottom: 6 }}>Target Resolution (mins) *</label>
                  <input type="number" className="input-field" value={policyResolutionMins} onChange={e => setPolicyResolutionMins(Number(e.target.value))} required />
                </div>
              </div>

              <div>
                <label className="label" style={{ fontSize: 12, marginBottom: 6 }}>Business Hours Calendar</label>
                <select className="input-field" value={policyCalendarId} onChange={e => setPolicyCalendarId(e.target.value)}>
                  <option value="">Default Calendar</option>
                  {calendars.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.is_default ? "(Default)" : ""}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 10 }}>
                <button type="button" onClick={() => setPolicyFormOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Save size={16} />
                  <span>Save Policy</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Calendar Edit Modal */}
      {calendarFormOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: 20, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                {editingCalendar ? "Edit Business Calendar" : "New Business Calendar"}
              </h3>
              <button onClick={() => setCalendarFormOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 6, padding: 12, color: "#f87171", fontSize: 13 }}>
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCalendarSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className="label" style={{ fontSize: 12, marginBottom: 6 }}>Calendar Name *</label>
                <input type="text" className="input-field" value={calendarName} onChange={e => setCalendarName(e.target.value)} required />
              </div>

              <div>
                <label className="label" style={{ fontSize: 12, marginBottom: 6 }}>Timezone *</label>
                <input type="text" className="input-field" value={calendarTz} onChange={e => setCalendarTz(e.target.value)} required />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="label" style={{ fontSize: 12, marginBottom: 6 }}>Start Time *</label>
                  <input type="text" className="input-field" placeholder="HH:MM:SS" value={calendarStartTime} onChange={e => setCalendarStartTime(e.target.value)} required />
                </div>
                <div>
                  <label className="label" style={{ fontSize: 12, marginBottom: 6 }}>End Time *</label>
                  <input type="text" className="input-field" placeholder="HH:MM:SS" value={calendarEndTime} onChange={e => setCalendarEndTime(e.target.value)} required />
                </div>
              </div>

              <div>
                <label className="label" style={{ fontSize: 12, marginBottom: 6 }}>Working Days</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  {[1, 2, 3, 4, 5, 6, 0].map(d => {
                    const labelMap: { [d: number]: string } = { 1: "M", 2: "T", 3: "W", 4: "T", 5: "F", 6: "S", 0: "S" };
                    const isSelected = calendarWorkingDays.includes(d);
                    return (
                      <button 
                        key={d}
                        type="button"
                        onClick={() => toggleWorkingDay(d)}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 6,
                          border: isSelected ? "1px solid var(--primary-color)" : "1px solid var(--border-color)",
                          backgroundColor: isSelected ? "rgba(99, 102, 241, 0.1)" : "rgba(255,255,255,0.03)",
                          color: isSelected ? "var(--text-primary)" : "var(--text-muted)",
                          fontWeight: 600,
                          cursor: "pointer"
                        }}
                      >
                        {labelMap[d]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <input 
                  type="checkbox" 
                  id="defaultCheck"
                  checked={calendarIsDefault}
                  onChange={e => setCalendarIsDefault(e.target.checked)}
                />
                <label htmlFor="defaultCheck" style={{ fontSize: 13, userSelect: "none" }}>Set as default active calendar</label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 10 }}>
                <button type="button" onClick={() => setCalendarFormOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Save size={16} />
                  <span>Save Calendar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
