import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { 
  UserPlus, 
  Search, 
  UserCheck, 
  UserX, 
  Mail, 
  Lock, 
  Edit2, 
  RefreshCw,
  AlertCircle,
  X,
  Users
} from "lucide-react";

interface UserResponse {
  id: string;
  login: string;
  email: string;
  role: string;
  is_active: boolean;
  profile: Record<string, any>;
  organization_id: string;
  groups: string[];
}

export const UsersAdminPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Create Form State
  const [createLogin, setCreateLogin] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState("requester");
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Form State
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);

  // Fetch users
  const queryParams = new URLSearchParams();
  if (searchTerm) queryParams.append("q", searchTerm);

  const { data: users = [], isLoading, error, refetch, isFetching } = useQuery<UserResponse[]>({
    queryKey: ["users-list", searchTerm],
    queryFn: () => apiRequest<UserResponse[]>(`/admin/users?${queryParams.toString()}`),
  });

  // Create User Mutation
  const createUserMutation = useMutation({
    mutationFn: (payload: any) => {
      return apiRequest("/admin/users", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setIsCreateModalOpen(false);
      // Reset form
      setCreateLogin("");
      setCreateEmail("");
      setCreatePassword("");
      setCreateRole("requester");
      setCreateError(null);
      queryClient.invalidateQueries({ queryKey: ["users-list"] });
    },
    onError: (err: any) => {
      setCreateError(err.detail || err.message || "Failed to create user.");
    }
  });

  // Update User Mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => {
      return apiRequest(`/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setIsEditModalOpen(false);
      setEditingUser(null);
      setEditError(null);
      queryClient.invalidateQueries({ queryKey: ["users-list"] });
    },
    onError: (err: any) => {
      setEditError(err.detail || err.message || "Failed to update user.");
    }
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createLogin || !createEmail || !createPassword) return;

    createUserMutation.mutate({
      login: createLogin,
      email: createEmail,
      password: createPassword,
      role: createRole,
      organization_id: currentUser?.organization_id, // Default to admin's org
      profile: {},
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    updateUserMutation.mutate({
      id: editingUser.id,
      payload: {
        role: editRole,
        is_active: editIsActive,
      }
    });
  };

  const toggleUserStatus = (userToToggle: UserResponse) => {
    updateUserMutation.mutate({
      id: userToToggle.id,
      payload: {
        is_active: !userToToggle.is_active,
      }
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>User Directory</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            Create and manage directory users, system roles, and access controls.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button 
            onClick={() => refetch()} 
            className="btn btn-secondary"
            title="Refresh Users"
            disabled={isLoading || isFetching}
            style={{ padding: "10px 12px" }}
          >
            <RefreshCw size={16} className={isFetching ? "spin" : ""} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
          </button>
          <button onClick={() => setIsCreateModalOpen(true)} className="btn btn-primary">
            <UserPlus size={16} />
            Create User
          </button>
        </div>
      </div>

      {/* Stats row client-side calculated */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px" }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: "rgba(99, 102, 241, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary-color)" }}>
            <Users size={18} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{users.length}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>Total Directory Users</div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px" }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#34d399" }}>
            <UserCheck size={18} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
              {users.filter(u => u.is_active).length}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>Active Accounts</div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px" }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: "rgba(239, 68, 68, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171" }}>
            <UserX size={18} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
              {users.filter(u => !u.is_active).length}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>Disabled Accounts</div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="card" style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{ position: "relative", flexGrow: 1 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
            <Search size={16} />
          </span>
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: 38 }}
            placeholder="Search users by name, login or email address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Directory Table */}
      {isLoading ? (
        <div className="card" style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 60 }}>
          <div style={{ textAlign: "center" }}>
            <div className="avatar" style={{ width: 40, height: 40, margin: "0 auto 16px", animation: "spin 1s linear infinite" }}>⏳</div>
            <p style={{ color: "var(--text-secondary)" }}>Fetching directory listings...</p>
          </div>
        </div>
      ) : error ? (
        <div className="card" style={{ border: "1px solid rgba(239, 68, 68, 0.2)", backgroundColor: "rgba(239, 68, 68, 0.05)", padding: 32, textAlign: "center" }}>
          <p style={{ color: "#f87171", fontSize: 15, fontWeight: 600 }}>Failed to load directory</p>
          <p style={{ color: "var(--text-secondary)", marginTop: 6, fontSize: 13 }}>{(error as any).detail || error.message || "Permissions check failed."}</p>
          <button onClick={() => refetch()} className="btn btn-secondary" style={{ marginTop: 16 }}>Try Again</button>
        </div>
      ) : users.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No users matched</h3>
          <p style={{ color: "var(--text-secondary)", maxWidth: 450, margin: "0 auto" }}>
            Try adjusting your search terms or create a new user account.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Login Username</th>
                  <th>Email Address</th>
                  <th>System Role</th>
                  <th>Status</th>
                  <th>Assigned Groups</th>
                  <th style={{ width: 140 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.login}</td>
                    <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{item.email}</td>
                    <td>
                      <span 
                        className="badge" 
                        style={{ 
                          fontSize: 11, 
                          backgroundColor: item.role === "admin" ? "rgba(239, 68, 68, 0.12)" : "rgba(255, 255, 255, 0.05)",
                          color: item.role === "admin" ? "#f87171" : "var(--text-secondary)",
                          border: item.role === "admin" ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid var(--border-color)",
                          textTransform: "capitalize"
                        }}
                      >
                        {item.role.replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${item.is_active ? "status-resolved" : "status-cancelled"}`} style={{ fontSize: 11 }}>
                        {item.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      {item.groups.length > 0 ? item.groups.join(", ") : <span style={{ color: "var(--text-muted)" }}>None</span>}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => {
                            setEditingUser(item);
                            setEditRole(item.role);
                            setEditIsActive(item.is_active);
                            setIsEditModalOpen(true);
                            setEditError(null);
                          }}
                          className="btn btn-secondary"
                          style={{ padding: 6, borderRadius: 6 }}
                          title="Edit User Profile"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => toggleUserStatus(item)}
                          className="btn btn-secondary"
                          style={{ padding: 6, borderRadius: 6, color: item.is_active ? "#f87171" : "#34d399" }}
                          title={item.is_active ? "Disable Account" : "Enable Account"}
                        >
                          {item.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <form onSubmit={handleCreateSubmit} className="card" style={{ width: "100%", maxWidth: 450, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Create Directory Account</h3>
              <button 
                type="button" 
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setCreateError(null);
                }} 
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {createError && (
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
                <div>{createError}</div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="new-login">Login Name / Username *</label>
                <input 
                  id="new-login"
                  type="text" 
                  className="form-input" 
                  value={createLogin}
                  onChange={(e) => setCreateLogin(e.target.value)}
                  placeholder="e.g. jdoe"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="new-email">Email Address *</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                    <Mail size={14} />
                  </span>
                  <input 
                    id="new-email"
                    type="email" 
                    className="form-input" 
                    style={{ paddingLeft: 34 }}
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="john.doe@company.com"
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="new-password">Password *</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                    <Lock size={14} />
                  </span>
                  <input 
                    id="new-password"
                    type="password" 
                    className="form-input" 
                    style={{ paddingLeft: 34 }}
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Min 6 characters..."
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="new-role">System Role *</label>
                <select 
                  id="new-role"
                  className="form-select" 
                  value={createRole} 
                  onChange={(e) => setCreateRole(e.target.value)}
                  required
                >
                  <option value="requester">Requester (Employee)</option>
                  <option value="agent">Support Agent</option>
                  <option value="manager">Service Desk Manager</option>
                  <option value="change_manager">Change Manager</option>
                  <option value="cab_member">CAB Member</option>
                  <option value="admin">System Administrator</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24, borderTop: "1px solid var(--border-color)", paddingTop: 16 }}>
              <button 
                type="button" 
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setCreateError(null);
                }} 
                className="btn btn-secondary"
                disabled={createUserMutation.isPending}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? "Creating..." : "Create Account"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && editingUser && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <form onSubmit={handleEditSubmit} className="card" style={{ width: "100%", maxWidth: 450, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Edit Account: {editingUser.login}</h3>
              <button 
                type="button" 
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingUser(null);
                  setEditError(null);
                }} 
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {editError && (
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
                <div>{editError}</div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="edit-role">System Role *</label>
                <select 
                  id="edit-role"
                  className="form-select" 
                  value={editRole} 
                  onChange={(e) => setEditRole(e.target.value)}
                  required
                >
                  <option value="requester">Requester (Employee)</option>
                  <option value="agent">Support Agent</option>
                  <option value="manager">Service Desk Manager</option>
                  <option value="change_manager">Change Manager</option>
                  <option value="cab_member">CAB Member</option>
                  <option value="admin">System Administrator</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0" }}>
                <input 
                  type="checkbox" 
                  id="edit-active"
                  checked={editIsActive} 
                  onChange={(e) => setEditIsActive(e.target.checked)} 
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                <label htmlFor="edit-active" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", cursor: "pointer" }}>
                  Account is Active
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24, borderTop: "1px solid var(--border-color)", paddingTop: 16 }}>
              <button 
                type="button" 
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingUser(null);
                  setEditError(null);
                }} 
                className="btn btn-secondary"
                disabled={updateUserMutation.isPending}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={updateUserMutation.isPending}
              >
                {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
