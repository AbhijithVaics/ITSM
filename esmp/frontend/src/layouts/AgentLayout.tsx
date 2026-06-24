import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { 
  Inbox, 
  Users, 
  Layers, 
  LogOut, 
  Shield,
  Settings,
  ShieldAlert,
  Calendar,
  ShieldCheck,
  LayoutDashboard,
  Activity,
  Search,
} from "lucide-react";
import { NotificationBell } from "../components/NotificationBell";

export const AgentLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (searchQuery.trim()) {
        navigate(`/queue?q=${encodeURIComponent(searchQuery.trim())}`);
      } else {
        navigate("/queue");
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (!user) return null;

  const isAdmin = user.role === "admin";
  const showChanges = ["admin", "agent", "manager", "change_manager", "cab_member"].includes(user.role);
  const showApprovals = ["admin", "cab_member", "change_manager"].includes(user.role);

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-logo">
          <Shield size={24} style={{ color: "var(--primary-color)" }} />
          <span>ESMP <span>Agent Portal</span></span>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/queue" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            <Inbox size={18} />
            <span>Work Queue</span>
          </NavLink>

          {showChanges && (
            <>
              <div style={{ margin: "16px 0 6px 14px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Change Management
              </div>
              <NavLink to="/changes" end className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                <ShieldAlert size={18} />
                <span>Change Requests</span>
              </NavLink>
              <NavLink to="/changes/calendar" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                <Calendar size={18} />
                <span>Change Calendar</span>
              </NavLink>
            </>
          )}

          {showApprovals && (
            <NavLink to="/approvals" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
              <ShieldCheck size={18} />
              <span>Approval Inbox</span>
            </NavLink>
          )}

          {isAdmin && (
            <>
              <div style={{ margin: "16px 0 6px 14px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Administration
              </div>
              <NavLink to="/admin/users" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                <Users size={18} />
                <span>Manage Users</span>
              </NavLink>
              <NavLink to="/admin/groups" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                <Layers size={18} />
                <span>Manage Groups</span>
              </NavLink>
              <NavLink to="/admin/graph" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                <Settings size={18} />
                <span>Graph Email Settings</span>
              </NavLink>
              <NavLink to="/admin/audit" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                <Activity size={18} />
                <span>Audit Logs</span>
              </NavLink>
              <NavLink to="/admin/sla" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
                <Settings size={18} />
                <span>SLA Policies</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="avatar">
            {user.login.substring(0, 2).toUpperCase()}
          </div>
          <div style={{ flexGrow: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
              {user.login}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "capitalize" }}>
              {user.role}
            </div>
          </div>
          <button 
            onClick={handleLogout} 
            title="Sign Out" 
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", transition: "color 0.2s" }}
            onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
            onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        <div className="top-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24, flexGrow: 1 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, whiteSpace: "nowrap" }}>Enterprise Service Spine</h2>
            {/* Global Search */}
            <div style={{ position: "relative", width: "100%", maxWidth: 320 }}>
              <input
                type="text"
                placeholder="Search ticket ID, title, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="input-field"
                style={{
                  padding: "6px 12px 6px 36px",
                  fontSize: 13,
                  width: "100%",
                  height: 34,
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "6px",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span className="badge status-assigned" style={{ fontSize: 11, padding: "3px 8px" }}>
              Agent View
            </span>
            <NotificationBell />
          </div>
        </div>

        <div className="content-body">
          <Outlet />
        </div>
      </div>
    </div>
  );
};
