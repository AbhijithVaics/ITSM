import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../../api/client";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Zap,
  AlertTriangle,
} from "lucide-react";

interface ChangeCalendarItem {
  id: string;
  display_id: string;
  title: string;
  status: string;
  extension: {
    risk_level: string;
    expedited: boolean;
    scheduled_start: string | null;
    scheduled_end: string | null;
  } | null;
  assigned_to: { id: string; login: string; email: string } | null;
}

const RISK_DOT: Record<string, string> = {
  low: "#60a5fa",
  medium: "#facc15",
  high: "#fb923c",
  critical: "#f87171",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getMonthGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: (number | null)[][] = [];
  let current = 1 - firstDay;
  while (current <= daysInMonth) {
    const week: (number | null)[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(current >= 1 && current <= daysInMonth ? current : null);
      current++;
    }
    weeks.push(week);
  }
  return weeks;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function inRange(day: Date, start: Date, end: Date): boolean {
  const d = day.getTime();
  // Normalize to start-of-day for comparison
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return d >= s && d <= e;
}

export const ChangeCalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const { data: calendarItems = [], isLoading, refetch, isFetching, error } = useQuery<ChangeCalendarItem[]>({
    queryKey: ["change-calendar"],
    queryFn: () => apiRequest<ChangeCalendarItem[]>("/changes/calendar"),
  });

  const weeks = getMonthGrid(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  // For a given day, find changes that overlap
  const getChangesForDay = (day: number): ChangeCalendarItem[] => {
    const target = new Date(viewYear, viewMonth, day);
    return calendarItems.filter((item) => {
      if (!item.extension?.scheduled_start) return false;
      const start = new Date(item.extension.scheduled_start);
      const end = item.extension?.scheduled_end ? new Date(item.extension.scheduled_end) : start;
      return inRange(target, start, end);
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <CalendarIcon size={28} style={{ color: "var(--primary-color)" }} />
            Change Calendar
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            View scheduled change windows across the organization.
          </p>
        </div>
        <button onClick={() => refetch()} className="btn btn-secondary" title="Refresh">
          <RefreshCw size={16} className={isFetching ? "spin" : ""} />
        </button>
      </div>

      {/* Month Navigation */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button className="btn btn-secondary" style={{ padding: "6px 12px" }} onClick={prevMonth}>
            <ChevronLeft size={18} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
              {MONTHS[viewMonth]} {viewYear}
            </h2>
            <button className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 10px" }} onClick={goToday}>
              Today
            </button>
          </div>
          <button className="btn btn-secondary" style={{ padding: "6px 12px" }} onClick={nextMonth}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {isLoading && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Loading calendar…</div>
      )}

      {error && (
        <div style={{ textAlign: "center", padding: 60, color: "#f87171" }}>
          <AlertTriangle size={24} style={{ marginBottom: 8 }} />
          <div>Failed to load change calendar.</div>
        </div>
      )}

      {!isLoading && !error && (
        <div style={{ border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden" }}>
          {/* Day Headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", backgroundColor: "var(--bg-secondary)" }}>
            {DAYS.map((d) => (
              <div key={d} style={{ padding: "10px 8px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid var(--border-color)" }}>
                {d}
              </div>
            ))}
          </div>

          {/* Week Rows */}
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", minHeight: 110 }}>
              {week.map((day, di) => {
                const isToday = day !== null && sameDay(new Date(viewYear, viewMonth, day), today);
                const changes = day !== null ? getChangesForDay(day) : [];
                return (
                  <div
                    key={di}
                    style={{
                      padding: "6px 8px",
                      borderRight: di < 6 ? "1px solid var(--border-color)" : undefined,
                      borderBottom: wi < weeks.length - 1 ? "1px solid var(--border-color)" : undefined,
                      backgroundColor: day === null ? "var(--bg-tertiary)" : isToday ? "rgba(99, 102, 241, 0.06)" : "var(--bg-primary)",
                      minHeight: 110,
                    }}
                  >
                    {day !== null && (
                      <>
                        <div style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isToday ? "var(--primary-color)" : "var(--text-primary)", marginBottom: 4 }}>
                          {day}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {changes.slice(0, 3).map((cr) => {
                            const riskColor = RISK_DOT[cr.extension?.risk_level || "low"] || "#60a5fa";
                            return (
                              <div
                                key={cr.id}
                                onClick={() => navigate(`/changes/${cr.id}`)}
                                style={{
                                  fontSize: 11,
                                  padding: "3px 6px",
                                  borderRadius: 4,
                                  backgroundColor: "var(--bg-secondary)",
                                  border: "1px solid var(--border-color)",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  overflow: "hidden",
                                  whiteSpace: "nowrap",
                                  textOverflow: "ellipsis",
                                  transition: "border-color 0.15s",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.borderColor = riskColor)}
                                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-color)")}
                                title={`${cr.display_id} — ${cr.title}`}
                              >
                                <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: riskColor, flexShrink: 0 }} />
                                {cr.extension?.expedited && <Zap size={9} style={{ color: "#facc15", flexShrink: 0 }} />}
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{cr.display_id}</span>
                              </div>
                            );
                          })}
                          {changes.length > 3 && (
                            <div style={{ fontSize: 10, color: "var(--text-muted)", paddingLeft: 4 }}>
                              +{changes.length - 3} more
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: "flex", gap: 24, alignItems: "center", fontSize: 12, color: "var(--text-secondary)" }}>
          <span style={{ fontWeight: 600 }}>Risk Legend:</span>
          {Object.entries(RISK_DOT).map(([level, color]) => (
            <span key={level} style={{ display: "flex", alignItems: "center", gap: 5, textTransform: "capitalize" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color }} />
              {level}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
