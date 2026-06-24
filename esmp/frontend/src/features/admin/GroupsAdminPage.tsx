import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { 
  Plus, 
  Trash2, 
  UserPlus, 
  Users, 
  Layers, 
  AlertCircle, 
  X,
  RefreshCw
} from "lucide-react";

interface GroupMember {
  id: string;
  login: string;
  email: string;
  role: string;
}

interface GroupResponse {
  id: string;
  name: string;
  description: string | null;
  type: string;
  is_active: boolean;
  members: GroupMember[];
}

interface UserResponse {
  id: string;
  login: string;
  email: string;
  role: string;
  is_active: boolean;
}

export const GroupsAdminPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [selectedGroup, setSelectedGroup] = useState<GroupResponse | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState("");
  
  // Group creation state
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [groupType, setGroupType] = useState("assignment");
  const [createError, setCreateError] = useState<string | null>(null);
  const [membershipError, setMembershipError] = useState<string | null>(null);

  const isAdmin = currentUser?.role === "admin";

  // Fetch groups
  const { data: groups = [], isLoading: groupsLoading, error: groupsError, refetch, isFetching } = useQuery<GroupResponse[]>({
    queryKey: ["groups-admin-list"],
    queryFn: () => apiRequest<GroupResponse[]>("/admin/groups"),
  });

  // Fetch all users (admin-only) for membership picker
  const { data: users = [] } = useQuery<UserResponse[]>({
    queryKey: ["users-picker-list"],
    queryFn: () => apiRequest<UserResponse[]>("/admin/users?is_active=true"),
    enabled: isAdmin && !!selectedGroup,
  });

  // Create Group Mutation
  const createGroupMutation = useMutation({
    mutationFn: (payload: any) => {
      return apiRequest<GroupResponse>("/admin/groups", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (newGroup: GroupResponse) => {
      setIsCreateModalOpen(false);
      setGroupName("");
      setGroupDesc("");
      setGroupType("assignment");
      setCreateError(null);
      queryClient.invalidateQueries({ queryKey: ["groups-admin-list"] });
      setSelectedGroup(newGroup);
    },
    onError: (err: any) => {
      setCreateError(err.detail || err.message || "Failed to create group.");
    }
  });

  // Add Member Mutation
  const addMemberMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) => {
      return apiRequest(`/admin/groups/${groupId}/members`, {
        method: "POST",
        body: JSON.stringify({ user_id: userId }),
      });
    },
    onSuccess: () => {
      setSelectedUserToAdd("");
      setMembershipError(null);
      queryClient.invalidateQueries({ queryKey: ["groups-admin-list"] });
      // Refresh selected group state
      if (selectedGroup) {
        const updated = groups.find(g => g.id === selectedGroup.id);
        if (updated) setSelectedGroup(updated);
      }
    },
    onError: (err: any) => {
      setMembershipError(err.detail || err.message || "Failed to add member.");
    }
  });

  // Remove Member Mutation
  const removeMemberMutation = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) => {
      return apiRequest(`/admin/groups/${groupId}/members/${userId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      setMembershipError(null);
      queryClient.invalidateQueries({ queryKey: ["groups-admin-list"] });
      if (selectedGroup) {
        const updated = groups.find(g => g.id === selectedGroup.id);
        if (updated) setSelectedGroup(updated);
      }
    },
    onError: (err: any) => {
      setMembershipError(err.detail || err.message || "Failed to remove member.");
    }
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName) return;

    createGroupMutation.mutate({
      name: groupName,
      description: groupDesc,
      type: groupType,
      organization_id: currentUser?.organization_id,
    });
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !selectedUserToAdd) return;

    addMemberMutation.mutate({
      groupId: selectedGroup.id,
      userId: selectedUserToAdd,
    });
  };

  // Filter users that are not already members of the selected group
  const nonMembers = selectedGroup 
    ? users.filter(u => !selectedGroup.members.some(m => m.id === u.id))
    : [];

  // Update selectedGroup if groups refresh in background
  const currentSelectedGroup = selectedGroup 
    ? groups.find(g => g.id === selectedGroup.id) || selectedGroup 
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>Support Groups</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            Organize users into Assignment Groups and Change Advisory Boards (CAB).
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button 
            onClick={() => refetch()} 
            className="btn btn-secondary"
            title="Refresh Groups"
            disabled={groupsLoading || isFetching}
            style={{ padding: "10px 12px" }}
          >
            <RefreshCw size={16} className={isFetching ? "spin" : ""} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
          </button>
          {isAdmin && (
            <button onClick={() => setIsCreateModalOpen(true)} className="btn btn-primary">
              <Plus size={16} />
              Create Group
            </button>
          )}
        </div>
      </div>

      {groupsLoading ? (
        <div className="card" style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 60 }}>
          <div style={{ textAlign: "center" }}>
            <div className="avatar" style={{ width: 40, height: 40, margin: "0 auto 16px", animation: "spin 1s linear infinite" }}>⏳</div>
            <p style={{ color: "var(--text-secondary)" }}>Fetching support groups...</p>
          </div>
        </div>
      ) : groupsError ? (
        <div className="card" style={{ border: "1px solid rgba(239, 68, 68, 0.2)", backgroundColor: "rgba(239, 68, 68, 0.05)", padding: 32, textAlign: "center" }}>
          <p style={{ color: "#f87171", fontSize: 15, fontWeight: 600 }}>Failed to load groups</p>
          <p style={{ color: "var(--text-secondary)", marginTop: 6, fontSize: 13 }}>{(groupsError as any).detail || groupsError.message || "Unknown error occurred"}</p>
          <button onClick={() => refetch()} className="btn btn-secondary" style={{ marginTop: 16 }}>Try Again</button>
        </div>
      ) : groups.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "80px 40px" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>👥</div>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No groups found</h3>
          <p style={{ color: "var(--text-secondary)", maxWidth: 450, margin: "0 auto 24px" }}>
            You haven't defined any support groups. Define assignment groups so agents can receive tickets.
          </p>
          {isAdmin && (
            <button onClick={() => setIsCreateModalOpen(true)} className="btn btn-primary">
              <Plus size={16} />
              Create Your First Group
            </button>
          )}
        </div>
      ) : (
        /* Master-Detail Layout */
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 24, alignItems: "start" }}>
          {/* Left Column: Groups List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {groups.map((group) => {
              const isSelected = currentSelectedGroup?.id === group.id;
              return (
                <div 
                  key={group.id} 
                  onClick={() => {
                    setSelectedGroup(group);
                    setMembershipError(null);
                  }}
                  className="card"
                  style={{ 
                    cursor: "pointer", 
                    padding: 16,
                    border: isSelected ? "1px solid var(--primary-color)" : "1px solid var(--border-color)",
                    backgroundColor: isSelected ? "var(--bg-tertiary)" : "var(--bg-secondary)",
                    boxShadow: isSelected ? "0 0 12px var(--primary-glow)" : "none",
                    transition: "all 0.2s"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{group.name}</h3>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {group.description || "No description provided."}
                      </p>
                    </div>
                    <span 
                      className="badge" 
                      style={{ 
                        fontSize: 9, 
                        padding: "2px 6px",
                        backgroundColor: group.type === "cab" ? "rgba(236, 72, 153, 0.12)" : "rgba(99, 102, 241, 0.12)",
                        color: group.type === "cab" ? "var(--accent-color)" : "var(--primary-color)",
                        border: `1px solid ${group.type === "cab" ? "rgba(236, 72, 153, 0.2)" : "rgba(99, 102, 241, 0.2)"}`
                      }}
                    >
                      {group.type.toUpperCase()}
                    </span>
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, fontSize: 12, color: "var(--text-muted)" }}>
                    <Users size={14} />
                    <span>{group.members.length} member(s)</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Membership Management */}
          <div>
            {currentSelectedGroup ? (
              <div className="card" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Header info */}
                <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700 }}>{currentSelectedGroup.name}</h2>
                    <span 
                      className="badge status-assigned" 
                      style={{ 
                        fontSize: 10,
                        backgroundColor: currentSelectedGroup.type === "cab" ? "rgba(236, 72, 153, 0.12)" : "rgba(99, 102, 241, 0.12)",
                        color: currentSelectedGroup.type === "cab" ? "var(--accent-color)" : "var(--primary-color)"
                      }}
                    >
                      {currentSelectedGroup.type === "cab" ? "CAB Group" : "Assignment Group"}
                    </span>
                  </div>
                  <p style={{ color: "var(--text-secondary)", marginTop: 6, fontSize: 13 }}>
                    {currentSelectedGroup.description || "No description provided."}
                  </p>
                </div>

                {membershipError && (
                  <div style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 6, padding: 12, display: "flex", gap: 8, color: "#f87171", fontSize: 13 }}>
                    <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>{membershipError}</div>
                  </div>
                )}

                {/* Add Member Form (Admin only) */}
                {isAdmin && (
                  <form onSubmit={handleAddMember} style={{ display: "flex", gap: 12, alignItems: "flex-end", backgroundColor: "var(--bg-tertiary)", padding: 16, borderRadius: 8, border: "1px solid var(--border-color)" }}>
                    <div className="form-group" style={{ marginBottom: 0, flexGrow: 1 }}>
                      <label className="form-label" htmlFor="add-user-picker">Add User to Group</label>
                      <select
                        id="add-user-picker"
                        className="form-select"
                        value={selectedUserToAdd}
                        onChange={(e) => setSelectedUserToAdd(e.target.value)}
                        disabled={addMemberMutation.isPending}
                        required
                      >
                        <option value="">-- Select Active User --</option>
                        {nonMembers.map((u) => (
                          <option key={u.id} value={u.id}>{u.login} ({u.role})</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ padding: "10px 18px" }}
                      disabled={addMemberMutation.isPending || !selectedUserToAdd}
                    >
                      <UserPlus size={16} />
                      Add
                    </button>
                  </form>
                )}

                {/* Members List */}
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Group Members ({currentSelectedGroup.members.length})</h3>
                  
                  {currentSelectedGroup.members.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {currentSelectedGroup.members.map((member) => (
                        <div 
                          key={member.id}
                          style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "space-between", 
                            padding: "10px 14px",
                            backgroundColor: "var(--bg-tertiary)",
                            border: "1px solid var(--border-color)",
                            borderRadius: 8
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{member.login}</div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{member.email}</div>
                          </div>
                          
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span className="badge status-closed" style={{ fontSize: 9, padding: "2px 5px" }}>
                              {member.role}
                            </span>
                            
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to remove ${member.login} from ${currentSelectedGroup.name}?`)) {
                                    removeMemberMutation.mutate({ groupId: currentSelectedGroup.id, userId: member.id });
                                  }
                                }}
                                className="btn btn-secondary"
                                style={{ padding: 6, borderRadius: 6, color: "#f87171" }}
                                disabled={removeMemberMutation.isPending}
                                title="Remove member"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 13, textAlign: "center", padding: "30px 0", border: "1px dashed var(--border-color)", borderRadius: 8 }}>
                      This group has no members.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 60, minHeight: 250, borderStyle: "dashed" }}>
                <Layers size={36} style={{ color: "var(--text-muted)", marginBottom: 16 }} />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>No Group Selected</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: 13, textAlign: "center", marginTop: 4, maxWidth: 320 }}>
                  Select a support group from the list on the left to manage members and configure settings.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {isCreateModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <form onSubmit={handleCreateSubmit} className="card" style={{ width: "100%", maxWidth: 450, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Create Support Group</h3>
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
                <label className="form-label" htmlFor="new-grp-name">Group Name *</label>
                <input 
                  id="new-grp-name"
                  type="text" 
                  className="form-input" 
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. L1 Helpdesk Support"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="new-grp-type">Group Type *</label>
                <select 
                  id="new-grp-type"
                  className="form-select" 
                  value={groupType} 
                  onChange={(e) => setGroupType(e.target.value)}
                  required
                >
                  <option value="assignment">Assignment Group (Incident Router)</option>
                  <option value="cab">CAB Group (Change Advisory Board)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="new-grp-desc">Description</label>
                <textarea 
                  id="new-grp-desc"
                  className="form-textarea" 
                  rows={3}
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="Briefly state the scope/purpose of this group..."
                />
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
                disabled={createGroupMutation.isPending}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={createGroupMutation.isPending}
              >
                {createGroupMutation.isPending ? "Creating..." : "Create Group"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
