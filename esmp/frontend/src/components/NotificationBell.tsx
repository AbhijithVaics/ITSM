import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Bell, Check, CheckSquare, Inbox, Circle } from "lucide-react";

interface NotificationResponse {
  id: string;
  user_id: string;
  event_type: string;
  entity_id: string | null;
  entity_type: string | null;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

interface NotificationListResponse {
  notifications: NotificationResponse[];
  unread_count: number;
}

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Poll for notifications every 30 seconds
  const { data } = useQuery<NotificationListResponse>({
    queryKey: ["notifications"],
    queryFn: () => apiRequest<NotificationListResponse>("/notifications"),
    refetchInterval: 30000,
    enabled: !!user,
  });


  const unreadCount = data?.unread_count ?? 0;
  const notifications = data?.notifications ?? [];

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest<NotificationResponse>(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => 
      apiRequest<{ count: number }>("/notifications/read-all", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const handleNotificationClick = (notification: NotificationResponse) => {
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id);
    }
    setIsOpen(false);

    if (notification.entity_type === "work_item" && notification.entity_id) {
      if (user?.role === "requester") {
        navigate(`/portal/tickets/${notification.entity_id}`);
      } else {
        navigate(`/queue/${notification.entity_id}`);
      }
    }
  };

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          position: "relative",
          padding: 8,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "color 0.2s, background-color 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--text-primary)";
          e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--text-muted)";
          e.currentTarget.style.backgroundColor = "transparent";
        }}
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              backgroundColor: "var(--accent-color, #ef4444)",
              color: "white",
              borderRadius: "50%",
              minWidth: 16,
              height: 16,
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              boxShadow: "0 0 0 2px var(--bg-primary)",
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 360,
            backgroundColor: "rgba(30, 41, 59, 0.8)",
            backdropFilter: "blur(12px)",
            border: "1px solid var(--border-color)",
            borderRadius: 12,
            boxShadow: "var(--shadow-lg)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: "rgba(15, 23, 42, 0.4)",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14 }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--primary-color)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "4px 8px",
                  borderRadius: 4,
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(99, 102, 241, 0.1)"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <CheckSquare size={14} />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: "32px 16px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Inbox size={24} />
                <span style={{ fontSize: 13 }}>No notifications yet</span>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  style={{
                    padding: 16,
                    borderBottom: "1px solid var(--border-color)",
                    cursor: "pointer",
                    display: "flex",
                    gap: 12,
                    position: "relative",
                    backgroundColor: notification.is_read ? "transparent" : "rgba(99, 102, 241, 0.05)",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = notification.is_read 
                      ? "rgba(255, 255, 255, 0.02)" 
                      : "rgba(99, 102, 241, 0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = notification.is_read 
                      ? "transparent" 
                      : "rgba(99, 102, 241, 0.05)";
                  }}
                >
                  {!notification.is_read && (
                    <div style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)", color: "var(--primary-color)" }}>
                      <Circle size={8} fill="var(--primary-color)" />
                    </div>
                  )}
                  <div style={{ flexGrow: 1, minWidth: 0, paddingLeft: 8 }}>
                    <div style={{ fontWeight: notification.is_read ? 500 : 600, fontSize: 13, color: "var(--text-primary)" }}>
                      {notification.title}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, lineBreak: "anywhere" }}>
                      {notification.message}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6 }}>
                      {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(notification.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {!notification.is_read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markReadMutation.mutate(notification.id);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        alignSelf: "center",
                        padding: 4,
                        borderRadius: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "color 0.2s, background-color 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "var(--success-color, #22c55e)";
                        e.currentTarget.style.backgroundColor = "rgba(34, 197, 94, 0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "var(--text-muted)";
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                      title="Mark as read"
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
