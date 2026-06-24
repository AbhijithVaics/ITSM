import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { LoginPage } from "./auth/LoginPage";

// Layouts
import { EmployeeLayout } from "./layouts/EmployeeLayout";
import { AgentLayout } from "./layouts/AgentLayout";

// Features - Incidents
import { MyTicketsPage } from "./features/incidents/MyTicketsPage";
import { CreateIncidentPage } from "./features/incidents/CreateIncidentPage";
import { AgentQueuePage } from "./features/incidents/AgentQueuePage";
import { IncidentDetailPage } from "./features/incidents/IncidentDetailPage";

// Features - Changes
import { ChangeListPage } from "./features/changes/ChangeListPage";
import { ChangeDetailPage } from "./features/changes/ChangeDetailPage";
import { CreateChangePage } from "./features/changes/CreateChangePage";
import { ChangeCalendarPage } from "./features/changes/ChangeCalendarPage";
import { ApprovalInboxPage } from "./features/changes/ApprovalInboxPage";

// Features - Admin
import { UsersAdminPage } from "./features/admin/UsersAdminPage";
import { GroupsAdminPage } from "./features/admin/GroupsAdminPage";
import { GraphConfigPage } from "./features/admin/GraphConfigPage";
import { AuditLogPage } from "./features/admin/AuditLogPage";
import { SlaConfigPage } from "./features/admin/SlaConfigPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Helper component to redirect authenticated users to their correct home page
const RootRedirect: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
        <div className="avatar" style={{ width: 48, height: 48, animation: "spin 1s linear infinite" }}>⏳</div>
        <span style={{ marginLeft: 12, color: "var(--text-secondary)" }}>Loading session...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return user.role === "requester" ? (
    <Navigate to="/portal" replace />
  ) : (
    <Navigate to="/queue" replace />
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Employee Portal Routes (Requester only) */}
            <Route
              path="/portal"
              element={
                <ProtectedRoute allowedRoles={["requester"]}>
                  <EmployeeLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<MyTicketsPage />} />
              <Route path="new" element={<CreateIncidentPage />} />
              <Route path="tickets/:id" element={<IncidentDetailPage />} />
            </Route>

            {/* Agent / Admin Portal Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute allowedRoles={["admin", "agent", "manager", "change_manager", "cab_member"]}>
                  <AgentLayout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="queue" element={<AgentQueuePage />} />
              <Route path="queue/:id" element={<IncidentDetailPage />} />

              {/* Change Management Routes */}
              <Route path="changes" element={<ChangeListPage />} />
              <Route path="changes/new" element={
                <ProtectedRoute allowedRoles={["admin", "agent", "manager", "change_manager"]}>
                  <CreateChangePage />
                </ProtectedRoute>
              } />
              <Route path="changes/calendar" element={<ChangeCalendarPage />} />
              <Route path="changes/:id" element={<ChangeDetailPage />} />
              <Route path="approvals" element={
                <ProtectedRoute allowedRoles={["admin", "cab_member", "change_manager"]}>
                  <ApprovalInboxPage />
                </ProtectedRoute>
              } />
              
              {/* Admin-only Routes */}
              <Route
                path="admin/users"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <UsersAdminPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/groups"
                element={
                  <ProtectedRoute allowedRoles={["admin", "manager", "agent"]}>
                    <GroupsAdminPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/graph"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <GraphConfigPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/audit"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AuditLogPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="admin/sla"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <SlaConfigPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Root & Catch All */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
