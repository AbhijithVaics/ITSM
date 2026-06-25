import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { KeyRound, User as UserIcon, AlertTriangle } from "lucide-react";

export const LoginPage: React.FC = () => {
  const [loginVal, setLoginVal] = useState("");
  const [passwordVal, setPasswordVal] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { login: performLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const fromPath = (location.state as any)?.from?.pathname || null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginVal || !passwordVal) return;

    setErrorMsg(null);
    setSubmitting(true);

    try {
      const userProfile = await performLogin(loginVal, passwordVal);
      // Route after login based on role
      if (fromPath) {
        navigate(fromPath, { replace: true });
      } else if (userProfile.role === "requester") {
        navigate("/portal", { replace: true });
      } else {
        navigate("/queue", { replace: true });
      }
    } catch (err: any) {
      setErrorMsg(err.detail || err.message || "Invalid login credentials");
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to quickly autofill demo credentials
  const handleQuickFill = (u: string, p: string) => {
    setLoginVal(u);
    setPasswordVal(p);
    setErrorMsg(null);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, margin: 0, fontWeight: 700 }}>
            <span>ESMP</span> Gen-1
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 6, fontSize: 13 }}>
            Enterprise Service Management Platform
          </p>
        </div>

        {errorMsg && (
          <div 
            style={{ 
              backgroundColor: "rgba(239, 68, 68, 0.1)", 
              border: "1px solid rgba(239, 68, 68, 0.2)", 
              borderRadius: 8, 
              padding: 12, 
              marginBottom: 20,
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              color: "#f87171",
              fontSize: 13
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ fontWeight: 600 }}>Login Failed</strong>
              <div style={{ marginTop: 2 }}>{errorMsg}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login">Username / Login</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                <UserIcon size={16} />
              </span>
              <input
                id="login"
                type="text"
                className="form-input"
                style={{ paddingLeft: 38 }}
                placeholder="Enter username..."
                value={loginVal}
                onChange={(e) => setLoginVal(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 28 }}>
            <label className="form-label" htmlFor="password">Password</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                <KeyRound size={16} />
              </span>
              <input
                id="password"
                type="password"
                className="form-input"
                style={{ paddingLeft: 38 }}
                placeholder="Enter password..."
                value={passwordVal}
                onChange={(e) => setPasswordVal(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: "100%", height: 44 }}
            disabled={submitting}
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div style={{ marginTop: 32, borderTop: "1px solid var(--border-color)", paddingTop: 20 }}>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, fontWeight: 500, textAlign: "center" }}>
            Demo Quick Fills
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={() => handleQuickFill("admin", "password123")}
              className="btn btn-secondary"
              style={{ padding: "6px 12px", fontSize: 12 }}
              disabled={submitting}
            >
              Admin
            </button>
            <button
              onClick={() => handleQuickFill("agent1", "password123")}
              className="btn btn-secondary"
              style={{ padding: "6px 12px", fontSize: 12 }}
              disabled={submitting}
            >
              Agent
            </button>
            <button
              onClick={() => handleQuickFill("requester1", "password123")}
              className="btn btn-secondary"
              style={{ padding: "6px 12px", fontSize: 12 }}
              disabled={submitting}
            >
              Employee
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
