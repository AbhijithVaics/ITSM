import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../api/client";
import { 
  Settings, 
  Mail, 
  Webhook, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Calendar, 
  ShieldCheck, 
  CloudLightning,
  AlertCircle
} from "lucide-react";

interface ActiveSubscription {
  id: string;
  subscription_id: string;
  mailbox: string;
  resource: string;
  expires_at: string;
  created_at: string;
}

interface GraphConfigResponse {
  tenant_id: string;
  client_id: string;
  mailbox: string;
  webhook_url: string;
  is_mock_mode: boolean;
  active_subscription: ActiveSubscription | null;
}

export const GraphConfigPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Fetch current config and active subscription status
  const { data, isLoading, error, refetch, isFetching } = useQuery<GraphConfigResponse>({
    queryKey: ["graph-config"],
    queryFn: () => apiRequest<GraphConfigResponse>("/admin/graph/config"),
  });

  // Subscribe Webhook Mutation
  const registerSubscriptionMutation = useMutation({
    mutationFn: () => {
      return apiRequest("/admin/graph/config/subscribe", { method: "POST" });
    },
    onSuccess: (res: any) => {
      setActionSuccess(res.message || "Webhook subscription registered successfully.");
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["graph-config"] });
    },
    onError: (err: any) => {
      setActionError(err.detail || err.message || "Failed to register webhook subscription.");
      setActionSuccess(null);
    }
  });

  const handleRegisterSubscription = () => {
    setActionError(null);
    setActionSuccess(null);
    registerSubscriptionMutation.mutate();
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", height: "50vh", alignItems: "center", justifyContent: "center" }}>
        <div className="avatar" style={{ width: 40, height: 40, animation: "spin 1s linear infinite" }}>⏳</div>
        <span style={{ marginLeft: 12, color: "var(--text-secondary)" }}>Loading Graph settings...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ border: "1px solid rgba(239, 68, 68, 0.2)", backgroundColor: "rgba(239, 68, 68, 0.05)", padding: 32, textAlign: "center" }}>
        <p style={{ color: "#f87171", fontSize: 16, fontWeight: 600 }}>Failed to load Graph settings</p>
        <p style={{ color: "var(--text-secondary)", marginTop: 6, fontSize: 13 }}>{(error as any)?.detail || error?.message || "Ensure you have administrator privileges."}</p>
        <button onClick={() => refetch()} className="btn btn-secondary" style={{ marginTop: 16 }}>Try Again</button>
      </div>
    );
  }

  const sub = data.active_subscription;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>Microsoft Graph Integration</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            Monitor and manage background email-to-ticket ingestion webhook endpoints.
          </p>
        </div>
        <button 
          onClick={() => refetch()} 
          className="btn btn-secondary"
          title="Refresh configurations"
          disabled={isLoading || isFetching}
          style={{ padding: "10px 14px" }}
        >
          <RefreshCw size={16} className={isFetching ? "spin" : ""} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Success/Error Alerts */}
      {actionError && (
        <div style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 8, padding: 16, display: "flex", gap: 12, color: "#f87171", fontSize: 14 }}>
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong style={{ fontWeight: 600 }}>Registration Failed</strong>
            <div style={{ marginTop: 2 }}>{actionError}</div>
          </div>
        </div>
      )}

      {actionSuccess && (
        <div style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 8, padding: 16, display: "flex", gap: 12, color: "#34d399", fontSize: 14 }}>
          <CheckCircle size={20} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong style={{ fontWeight: 600 }}>Action Successful</strong>
            <div style={{ marginTop: 2 }}>{actionSuccess}</div>
          </div>
        </div>
      )}

      {/* Mock Mode Alert */}
      {data.is_mock_mode && (
        <div 
          style={{ 
            backgroundColor: "rgba(234, 179, 8, 0.08)", 
            border: "1px solid rgba(234, 179, 8, 0.16)", 
            borderRadius: 10, 
            padding: "16px 20px", 
            display: "flex", 
            alignItems: "center", 
            gap: 16 
          }}
        >
          <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: "rgba(234, 179, 8, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#eab308", flexShrink: 0 }}>
            <CloudLightning size={22} />
          </div>
          <div>
            <h4 style={{ color: "#eab308", fontSize: 15, fontWeight: 600 }}>Running in MOCK mode</h4>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 2 }}>
              Azure tenant credentials are not configured in settings. Webhook requests and emails will be simulated using local test logic instead of connecting to live Microsoft API servers.
            </p>
          </div>
        </div>
      )}

      {/* Configuration Details */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24 }}>
        {/* Connection info */}
        <div className="card">
          <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Settings size={18} style={{ color: "var(--primary-color)" }} />
            Configuration Variables
          </h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase" }}>Monitored Inbox</span>
              <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600, marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <Mail size={16} style={{ color: "var(--text-muted)" }} />
                {data.mailbox}
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 12 }}>
              <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase" }}>Webhook Notification URL</span>
              <div style={{ fontSize: 13, fontFamily: "var(--mono)", color: "var(--text-primary)", marginTop: 4, wordBreak: "break-all" }}>
                {data.webhook_url || <span style={{ color: "#f87171", fontStyle: "italic" }}>Not set (Configure ESMP_GRAPH_WEBHOOK_URL)</span>}
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 12 }}>
              <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase" }}>OAuth Client ID</span>
              <div style={{ fontSize: 13, fontFamily: "var(--mono)", color: "var(--text-primary)", marginTop: 4 }}>
                {data.client_id || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>None / Sandbox Mode</span>}
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 12 }}>
              <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase" }}>OAuth Tenant ID</span>
              <div style={{ fontSize: 13, fontFamily: "var(--mono)", color: "var(--text-primary)", marginTop: 4 }}>
                {data.tenant_id || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>None / Sandbox Mode</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Subscription state */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 0 }}>
            <Webhook size={18} style={{ color: "var(--accent-color)" }} />
            Subscription Status
          </h3>

          {sub ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, flexGrow: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 6, backgroundColor: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", color: "#34d399", fontSize: 13, fontWeight: 600 }}>
                <ShieldCheck size={16} />
                <span>Subscription Active</span>
              </div>

              <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <span style={{ color: "var(--text-secondary)", display: "block" }}>Subscription ID:</span>
                  <span style={{ fontFamily: "var(--mono)", color: "var(--text-primary)" }}>{sub.subscription_id}</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)", display: "block" }}>Resource Monitored:</span>
                  <span style={{ color: "var(--text-primary)" }}>{sub.resource}</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)", display: "block" }}>Created:</span>
                  <span style={{ color: "var(--text-primary)" }}>{new Date(sub.created_at).toLocaleString()}</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-secondary)", display: "block" }}>Expires:</span>
                  <span style={{ color: "var(--text-primary)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Calendar size={14} style={{ color: "var(--text-muted)" }} />
                    {new Date(sub.expires_at).toLocaleString()}
                  </span>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 16, marginTop: "auto" }}>
                <button 
                  onClick={handleRegisterSubscription}
                  className="btn btn-secondary"
                  style={{ width: "100%" }}
                  disabled={registerSubscriptionMutation.isPending}
                >
                  {registerSubscriptionMutation.isPending ? "Renewing..." : "Renew Subscription (Force)"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "30px 10px", flexGrow: 1, textAlign: "center", border: "1px dashed var(--border-color)", borderRadius: 8 }}>
              <AlertTriangle size={32} style={{ color: "#facc15", marginBottom: 12 }} />
              <h4 style={{ fontSize: 15, fontWeight: 600 }}>No Active Subscription</h4>
              <p style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 4, maxWidth: 280 }}>
                There is no active webhook subscription registered in the database. Inbound email ingestion will not trigger automatically.
              </p>
              
              <button 
                onClick={handleRegisterSubscription}
                className="btn btn-primary"
                style={{ marginTop: 20, width: "100%" }}
                disabled={registerSubscriptionMutation.isPending || !data.webhook_url}
              >
                {registerSubscriptionMutation.isPending ? "Registering..." : "Register Webhook"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
