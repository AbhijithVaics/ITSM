import React, { useState, useEffect } from "react";
import { Clock, Pause, AlertTriangle, CheckCircle, Play } from "lucide-react";

interface ClockItem {
  id: string;
  metric: string; // 'response' | 'resolution'
  status: string; // 'active' | 'paused' | 'stopped' | 'breached'
  started_at: string;
  paused_at: string | null;
  deadline: string;
  breached_at: string | null;
  is_breached: boolean;
}

interface SlaClockProps {
  clocks?: ClockItem[] | null;
}

export const SlaClock: React.FC<SlaClockProps> = ({ clocks }) => {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!clocks || clocks.length === 0) {
    return null;
  }

  const getRemainingText = (deadlineStr: string, status: string, isBreached: boolean) => {
    if (status === "stopped") {
      return isBreached ? "Breached before resolve" : "Met";
    }
    if (status === "paused") {
      return "Paused";
    }

    const deadline = new Date(deadlineStr);
    const diffMs = deadline.getTime() - now.getTime();

    if (diffMs <= 0 || isBreached || status === "breached") {
      const absDiff = Math.abs(diffMs);
      const hrs = Math.floor(absDiff / 3600000);
      const mins = Math.floor((absDiff % 3600000) / 60000);
      return `Breached by ${hrs > 0 ? `${hrs}h ` : ""}${mins}m`;
    }

    const hrs = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);

    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const getSlaStyles = (deadlineStr: string, status: string, isBreached: boolean) => {
    if (status === "stopped") {
      return isBreached
        ? { color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)", icon: AlertTriangle }
        : { color: "#22c55e", bg: "rgba(34, 197, 94, 0.1)", icon: CheckCircle };
    }
    if (status === "paused") {
      return { color: "#fbbf24", bg: "rgba(251, 191, 36, 0.1)", icon: Pause };
    }

    const deadline = new Date(deadlineStr);
    const diffMs = deadline.getTime() - now.getTime();

    if (diffMs <= 0 || isBreached || status === "breached") {
      return { color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)", icon: AlertTriangle };
    }

    // Green if > 50% target remaining, Amber if < 50% or < 1 hour
    const totalTarget = 4 * 3600000; // rough default
    if (diffMs < 3600000 || diffMs < totalTarget / 2) {
      return { color: "#f97316", bg: "rgba(249, 115, 22, 0.1)", icon: Clock };
    }

    return { color: "#22c55e", bg: "rgba(34, 197, 94, 0.1)", icon: Play };
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 16,
        margin: "16px 0",
      }}
    >
      {clocks.map((clock) => {
        const styles = getSlaStyles(clock.deadline, clock.status, clock.is_breached);
        const Icon = styles.icon;
        const text = getRemainingText(clock.deadline, clock.status, clock.is_breached);

        return (
          <div
            key={clock.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid var(--border-color)",
              backgroundColor: styles.bg,
              transition: "transform 0.2s",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: "50%",
                backgroundColor: "rgba(15, 23, 42, 0.3)",
                color: styles.color,
              }}
            >
              <Icon size={18} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5 }}>
                {clock.metric === "response" ? "Response SLA" : "Resolution SLA"}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>
                {text}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                Target: {new Date(clock.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
