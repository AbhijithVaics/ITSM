import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type UserRole } from "./AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
        <div className="avatar" style={{ width: 48, height: 48, animation: "spin 1s linear infinite" }}>⏳</div>
        <span style={{ marginLeft: 12, color: "var(--text-secondary)" }}>Loading session...</span>
      </div>
    );
  }

  // Not logged in -> redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Logged in but role not allowed -> redirect to portal or queue based on role
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const defaultRedirect = user.role === "requester" ? "/portal" : "/queue";
    return <Navigate to={defaultRedirect} replace />;
  }

  return <>{children}</>;
};
