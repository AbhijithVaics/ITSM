import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiRequest } from "../../api/client";
import { AlertCircle, ArrowLeft, Send, Upload, X, HelpCircle } from "lucide-react";

const CATEGORIES: Record<string, string[]> = {
  "Hardware": [
    "Desktop/Laptop",
    "Printer",
    "Monitor/Display",
    "Peripheral",
    "Network Equipment",
    "Phone/VoIP",
    "Other Hardware",
  ],
  "Software": [
    "Operating System",
    "Office/Productivity",
    "Email/Outlook",
    "Browser",
    "Business Application",
    "Security/Antivirus",
    "Other Software",
  ],
  "Network": [
    "Internet/Connectivity",
    "VPN",
    "Wi-Fi",
    "File Share/Drive",
    "DNS",
    "Other Network",
  ],
  "Access": [
    "Account Creation",
    "Password Reset",
    "Permission Change",
    "Account Deactivation",
    "Other Access",
  ],
  "Other": [
    "General Inquiry",
    "Facilities",
    "Other",
  ],
};

export const CreateIncidentPage: React.FC = () => {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [urgency, setUrgency] = useState(3); // Default Low
  const [impact, setImpact] = useState(3);   // Default Low

  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset subcategory when category changes
  useEffect(() => {
    if (category) {
      setSubcategory(CATEGORIES[category][0]);
    } else {
      setSubcategory("");
    }
  }, [category]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      // Size check: cap at 25MB per file
      const oversized = selected.some(f => f.size > 25 * 1024 * 1024);
      if (oversized) {
        setErrorMsg("One or more files exceed the 25MB limit.");
        return;
      }
      setFiles(prev => [...prev, ...selected]);
      setErrorMsg(null);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !category || !subcategory) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Create the incident
      const incident = await apiRequest<any>("/work-items/incidents", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          category,
          subcategory,
          urgency,
          impact,
          source: "portal",
        }),
      });

      // 2. Upload attachments if any are selected
      if (files.length > 0) {
        for (const file of files) {
          const formData = new FormData();
          formData.append("file", file);
          
          await apiRequest(`/work-items/${incident.id}/attachments`, {
            method: "POST",
            body: formData,
          });
        }
      }

      // 3. Navigate to ticket detail page
      navigate(`/portal/tickets/${incident.id}`);
    } catch (err: any) {
      setErrorMsg(err.detail || err.message || "Failed to submit ticket. Please check your inputs.");
    } finally {
      setSubmitting(false);
    }
  };

  const activeSubcategories = category ? CATEGORIES[category] : [];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Link 
          to="/portal" 
          style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", fontSize: 13, fontWeight: 500 }}
          onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}
        >
          <ArrowLeft size={16} />
          Back to Tickets List
        </Link>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>Submit Support Request</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            Describe the technical issue or service request. Our support agents will address it shortly.
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
              <strong style={{ fontWeight: 600 }}>Error Submitting Request</strong>
              <div style={{ marginTop: 2 }}>{errorMsg}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="card">
          <div className="form-group">
            <label className="form-label" htmlFor="title">Summary / Subject *</label>
            <input
              id="title"
              type="text"
              className="form-input"
              placeholder="Provide a brief, clear summary of the issue (e.g. Cannot connect to Office 365 VPN)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={submitting}
              maxLength={250}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="category">Category *</label>
              <select
                id="category"
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                disabled={submitting}
              >
                <option value="">-- Select Category --</option>
                {Object.keys(CATEGORIES).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="subcategory">Subcategory *</label>
              <select
                id="subcategory"
                className="form-select"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                required
                disabled={submitting || !category}
              >
                <option value="">-- Select Subcategory --</option>
                {activeSubcategories.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="urgency">
                Urgency
                <span style={{ marginLeft: 6, color: "var(--text-muted)", cursor: "help" }} title="How quickly does this require resolution?">
                  <HelpCircle size={13} style={{ display: "inline", verticalAlign: "middle" }} />
                </span>
              </label>
              <select
                id="urgency"
                className="form-select"
                value={urgency}
                onChange={(e) => setUrgency(Number(e.target.value))}
                disabled={submitting}
              >
                <option value={1}>High - Critical business block</option>
                <option value={2}>Medium - Disruptive but can work</option>
                <option value={3}>Low - Informational or minor convenience</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="impact">
                Impact
                <span style={{ marginLeft: 6, color: "var(--text-muted)", cursor: "help" }} title="Who is affected by this issue?">
                  <HelpCircle size={13} style={{ display: "inline", verticalAlign: "middle" }} />
                </span>
              </label>
              <select
                id="impact"
                className="form-select"
                value={impact}
                onChange={(e) => setImpact(Number(e.target.value))}
                disabled={submitting}
              >
                <option value={1}>High - Entire department / system down</option>
                <option value={2}>Medium - Multiple users affected</option>
                <option value={3}>Low - Individual user issue</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">Detailed Description</label>
            <textarea
              id="description"
              className="form-textarea"
              placeholder="Describe the problem, steps to reproduce, or instructions. Include error messages if any."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              rows={6}
            />
          </div>

          {/* Attachments Section */}
          <div className="form-group" style={{ borderTop: "1px solid var(--border-color)", paddingTop: 20, marginTop: 12 }}>
            <label className="form-label">
              File Attachments (Max 25MB per file)
            </label>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <label 
                className="btn btn-secondary" 
                style={{ cursor: "pointer", borderStyle: "dashed" }}
              >
                <Upload size={16} />
                Choose Files
                <input
                  type="file"
                  multiple
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                  disabled={submitting}
                />
              </label>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                {files.length === 0 ? "No files selected" : `${files.length} file(s) selected`}
              </span>
            </div>

            {files.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {files.map((file, idx) => (
                  <div 
                    key={idx}
                    style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between", 
                      padding: "8px 12px", 
                      backgroundColor: "var(--bg-tertiary)", 
                      borderRadius: 6,
                      border: "1px solid var(--border-color)"
                    }}
                  >
                    <span style={{ fontSize: 13, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "80%" }}>
                      {file.name}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                      <button 
                        type="button" 
                        onClick={() => removeFile(idx)} 
                        style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 20, marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <Link to="/portal" className="btn btn-secondary" style={{ padding: "10px 24px" }}>
              Cancel
            </Link>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ padding: "10px 28px" }}
              disabled={submitting || !title || !category || !subcategory}
            >
              <Send size={16} />
              {submitting ? "Submitting Request..." : "Submit Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
