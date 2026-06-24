import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { LogOut, ShieldAlert, FileText, PlusCircle } from "lucide-react";
import { NotificationBell } from "../components/NotificationBell";

export const EmployeeLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (!user) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: "var(--bg-primary)" }}>
      {/* Top Navigation Bar */}
      <header className="employee-header">
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--heading)", fontSize: 18, fontWeight: 700 }}>
            <ShieldAlert size={22} style={{ color: "var(--primary-color)" }} />
            <span>ESMP <span style={{ fontWeight: 400, color: "var(--text-secondary)" }}>Employee Portal</span></span>
          </div>

          <nav style={{ display: "flex", gap: 16 }}>
            <NavLink 
              to="/portal" 
              end
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
              style={{ padding: "8px 16px", borderRadius: 8 }}
            >
              <FileText size={16} style={{ marginRight: 6 }} />
              My Tickets
            </NavLink>
            <NavLink 
              to="/portal/new" 
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
              style={{ padding: "8px 16px", borderRadius: 8 }}
            >
              <PlusCircle size={16} style={{ marginRight: 6 }} />
              New Ticket
            </NavLink>
          </nav>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <NotificationBell />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{user.login}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Employee</div>
          </div>
          <div className="avatar">
            {user.login.substring(0, 2).toUpperCase()}
          </div>
          <button 
            onClick={handleLogout} 
            title="Sign Out" 
            style={{ 
              background: "none", 
              border: "none", 
              color: "var(--text-muted)", 
              cursor: "pointer", 
              display: "flex",
              alignItems: "center",
              transition: "color 0.2s" 
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
            onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Page Content */}
      <main style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
        <div className="employee-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
