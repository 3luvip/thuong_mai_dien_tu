import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CiBellOn } from "react-icons/ci";
import {
  IoCheckmarkDoneOutline,
  IoTrashOutline,
  IoSchoolOutline,
  IoPricetagOutline,
  IoTicketOutline,
  IoInformationCircleOutline,
  IoAlarmOutline,
} from "react-icons/io5";
import axiosInstance from "../../lib/axios";
import { session } from "../../lib/storage";

// ─── Types ────────────────────────────────────────────────────────────────────
type NotifType = "course_added" | "discount" | "coupon" | "system" | "reminder";

interface Notification {
  id:        string;
  type:      NotifType;
  title:     string;
  body:      string;
  link:      string | null;
  isRead:    boolean;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TYPE_ICON: Record<NotifType, React.ReactElement> = {
  course_added: <IoSchoolOutline />,
  discount:     <IoPricetagOutline />,
  coupon:       <IoTicketOutline />,
  system:       <IoInformationCircleOutline />,
  reminder:     <IoAlarmOutline />,
};

// → parse thủ công thành UTC-aware string
function parseMySQLDate(dateStr: string): Date {
  // "2026-03-04 17:30:00" → "2026-03-04T17:30:00"
  const normalized = dateStr.replace(" ", "T");
  const d = new Date(normalized);
  // Nếu invalid thì fallback
  return isNaN(d.getTime()) ? new Date() : d;
}

function timeAgo(dateStr: string): string {
  const date = parseMySQLDate(dateStr);
  const diff = Date.now() - date.getTime();
  if (diff < 0) return "Just now";
  const m = Math.floor(diff / 60_000);
  if (m < 1)   return "Just now";
  if (m < 60)  return `${m} minutes ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h} hours ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7)   return `${d} days ago`;
  if (d < 30)  return `${Math.floor(d / 7)} weeks ago`;
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Inline styles (không cần import scss) ───────────────────────────────────
const S = {
  wrap: {
    position: "relative" as const,
    display: "inline-flex",
    alignItems: "center",
  },
  bell: (active: boolean): React.CSSProperties => ({
    position: "relative",
    background: active ? "rgba(99,102,241,0.15)" : "transparent",
    border: "none",
    cursor: "pointer",
    color: active ? "#6366f1" : "#e5e7eb",
    fontSize: "22px",
    padding: "6px 8px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    transition: "all 0.18s ease",
  }),
  badge: {
    position: "absolute" as const,
    top: "0px",
    right: "0px",
    background: "#ef4444",
    color: "#fff",
    fontSize: "10px",
    fontWeight: 700,
    minWidth: "17px",
    height: "17px",
    borderRadius: "999px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 3px",
    lineHeight: 1,
    border: "2px solid #020617",
    pointerEvents: "none" as const,
  },
  panel: {
    position: "absolute" as const,
    top: "calc(100% + 12px)",
    right: "-8px",
    width: "380px",
    maxHeight: "520px",
    background: "#0f172a",
    border: "1px solid rgba(148,163,184,0.12)",
    borderRadius: "16px",
    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.4), 0 20px 50px -10px rgba(0,0,0,0.7)",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    zIndex: 1400,
  },
  header: {
    padding: "16px 18px 12px",
    borderBottom: "1px solid rgba(148,163,184,0.12)",
    flexShrink: 0,
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "10px",
  },
  titleLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  title: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#e5e7eb",
    margin: 0,
  },
  chip: {
    background: "#6366f1",
    color: "#fff",
    fontSize: "11px",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: "999px",
  },
  readAllBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    background: "transparent",
    border: "1px solid rgba(99,102,241,0.4)",
    color: "#6366f1",
    fontSize: "12px",
    padding: "5px 10px",
    borderRadius: "8px",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.18s ease",
  },
  body: {
    flex: 1,
    overflowY: "auto" as const,
    overscrollBehavior: "contain" as const,
  },
  sectionLabel: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: "0.6px",
    padding: "10px 18px 4px",
    margin: 0,
  },
  footer: {
    borderTop: "1px solid rgba(148,163,184,0.12)",
    padding: "10px 18px",
    flexShrink: 0,
  },
  viewAllBtn: {
    width: "100%",
    background: "transparent",
    border: "1px solid rgba(148,163,184,0.12)",
    color: "#94a3b8",
    fontSize: "13px",
    padding: "8px",
    borderRadius: "8px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  empty: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "8px",
    padding: "48px 20px",
    color: "#94a3b8",
    fontSize: "13px",
  },
};

const ICON_COLORS: Record<NotifType, { bg: string; color: string }> = {
  course_added: { bg: "rgba(139,92,246,0.15)",  color: "#a78bfa" },
  discount:     { bg: "rgba(239,68,68,0.12)",   color: "#f87171" },
  coupon:       { bg: "rgba(34,197,94,0.12)",   color: "#4ade80" },
  system:       { bg: "rgba(59,130,246,0.12)",  color: "#60a5fa" },
  reminder:     { bg: "rgba(249,115,22,0.12)",  color: "#fb923c" },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen]           = useState(false);
  const [notifs, setNotifs]       = useState<Notification[]>([]);
  const [unread, setUnread]       = useState(0);
  const [loading, setLoading]     = useState(false);
  const [animating, setAnimating] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef   = useRef<HTMLButtonElement>(null);

  const userId = session.getUserId();

  const fetchNotifs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/notifications/${userId}`);
      setNotifs(res.data.notifications ?? []);
      setUnread(res.data.unreadCount ?? 0);
    } catch (err) {
      console.error("Fetch notifications error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifs();
    const id = setInterval(fetchNotifs, 60_000);
    return () => clearInterval(id);
  }, [fetchNotifs]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current   && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleToggle = () => {
    if (!open) fetchNotifs();
    setOpen((v) => !v);
  };

  const handleMarkAllRead = async () => {
    if (!userId || unread === 0) return;
    try {
      await axiosInstance.patch(`/notifications/user/${userId}/read-all`);
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
      setAnimating(true);
      setTimeout(() => setAnimating(false), 600);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClickNotif = async (n: Notification) => {
    if (!n.isRead) {
      try {
        await axiosInstance.patch(`/notifications/item/${n.id}/read`);
        setNotifs((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x));
        setUnread((c) => Math.max(0, c - 1));
      } catch (err) {
        console.error(err);
      }
    }
    if (n.link) { setOpen(false); navigate(n.link); }
  };

  const handleDelete = async (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    try {
      await axiosInstance.delete(`/notifications/item/${notifId}`);
      const deleted = notifs.find((n) => n.id === notifId);
      setNotifs((prev) => prev.filter((n) => n.id !== notifId));
      if (deleted && !deleted.isRead) setUnread((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const unreadNotifs = notifs.filter((n) => !n.isRead);
  const readNotifs   = notifs.filter((n) =>  n.isRead);

  return (
    <div style={S.wrap}>
      {/* ── Bell ── */}
      <button
        ref={btnRef}
        type="button"
        style={S.bell(open)}
        onClick={handleToggle}
      aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
      >
        <CiBellOn style={animating ? { animation: "notif-ring 0.5s ease" } : {}} />
        {unread > 0 && (
          <span style={S.badge}>{unread > 99 ? "99+" : unread}</span>
        )}
      </button>

      {/* ── Panel ── */}
      {open && (
        <div ref={panelRef} style={S.panel}>

          {/* Header */}
          <div style={S.header}>
            <div style={S.titleRow}>
              <div style={S.titleLeft}>
                <h3 style={S.title}>Notifications</h3>
                {unread > 0 && <span style={S.chip}>{unread} new</span>}
              </div>
              {unread > 0 && (
                <button type="button" style={S.readAllBtn} onClick={handleMarkAllRead}>
                  <IoCheckmarkDoneOutline />
                  Read all
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div style={S.body}>
            {loading && notifs.length === 0 ? (
              /* Skeleton */
              <div style={{ padding: "8px 0" }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ display: "flex", gap: "12px", padding: "12px 18px" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "#1e293b", flexShrink: 0, animation: "sk-pulse 1.4s ease infinite" }} />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      {[["70%", 0], ["100%", 0.1], ["35%", 0.2]].map(([w, delay], j) => (
                        <div key={j} style={{ height: 10, borderRadius: 6, background: "#1e293b", width: w as string, animationDelay: `${delay}s`, animation: "sk-pulse 1.4s ease infinite" }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : notifs.length === 0 ? (
              <div style={S.empty}>
                <span style={{ fontSize: "2.5rem" }}>🔔</span>
                <p style={{ margin: 0 }}>No notifications</p>
              </div>
            ) : (
              <>
                {unreadNotifs.length > 0 && (
                  <div>
                    <p style={S.sectionLabel}>Unread</p>
                    {unreadNotifs.map((n) => (
                      <NotifItem key={n.id} notif={n} hovered={hoveredId === n.id}
                        onHover={setHoveredId} onClick={handleClickNotif} onDelete={handleDelete} />
                    ))}
                  </div>
                )}
                {readNotifs.length > 0 && (
                  <div>
                    {unreadNotifs.length > 0 && <p style={S.sectionLabel}>Read</p>}
                    {readNotifs.map((n) => (
                      <NotifItem key={n.id} notif={n} hovered={hoveredId === n.id}
                        onHover={setHoveredId} onClick={handleClickNotif} onDelete={handleDelete} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div style={S.footer}>
              <button
                type="button"
                style={S.viewAllBtn}
                onClick={() => { setOpen(false); navigate("/notifications"); }}
              >
                View all notifications →
              </button>
            </div>
          )}
        </div>
      )}

      {/* CSS keyframes */}
      <style>{`
        @keyframes notif-ring {
          0%   { transform: rotate(0deg); }
          20%  { transform: rotate(18deg); }
          40%  { transform: rotate(-14deg); }
          60%  { transform: rotate(10deg); }
          80%  { transform: rotate(-6deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes sk-pulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

// ─── NotifItem ────────────────────────────────────────────────────────────────
function NotifItem({
  notif, hovered, onHover, onClick, onDelete,
}: {
  notif:    Notification;
  hovered:  boolean;
  onHover:  (id: string | null) => void;
  onClick:  (n: Notification) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}) {
  const type   = (notif.type in ICON_COLORS ? notif.type : "system") as NotifType;
  const colors = ICON_COLORS[type];

  const itemStyle: React.CSSProperties = {
    position: "relative",
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "12px 18px 12px 16px",
    borderLeft: `3px solid ${notif.isRead ? "transparent" : "#6366f1"}`,
    background: hovered
      ? "#1e293b"
      : notif.isRead
        ? "transparent"
        : "rgba(99,102,241,0.06)",
    cursor: notif.link ? "pointer" : "default",
    transition: "background 0.15s ease",
  };

  return (
    <div
      style={itemStyle}
      onClick={() => onClick(notif)}
      onMouseEnter={() => onHover(notif.id)}
      onMouseLeave={() => onHover(null)}
      role={notif.link ? "button" : undefined}
      tabIndex={notif.link ? 0 : undefined}
      onKeyDown={(e) => e.key === "Enter" && onClick(notif)}
    >
      {/* Unread dot */}
      {!notif.isRead && (
        <span style={{
          position: "absolute", top: "18px", left: "5px",
          width: "6px", height: "6px", borderRadius: "50%", background: "#6366f1", flexShrink: 0,
        }} />
      )}

      {/* Icon */}
      <span style={{
        flexShrink: 0, width: "38px", height: "38px", borderRadius: "11px",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "18px", marginTop: "1px",
        background: colors.bg, color: colors.color,
      }}>
        {TYPE_ICON[type]}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: "13px", fontWeight: notif.isRead ? 500 : 700,
          color: "#e5e7eb", margin: "0 0 3px", lineHeight: 1.35,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {notif.title}
        </p>
        <p style={{
          fontSize: "12px", color: "#94a3b8", margin: "0 0 5px", lineHeight: 1.45,
          display: "-webkit-box", WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical" as const, overflow: "hidden",
        }}>
          {notif.body}
        </p>
        <span style={{ fontSize: "11px", color: "#64748b" }}>
          {timeAgo(notif.createdAt)}
        </span>
      </div>

      {/* Delete button */}
      <button
        type="button"
        onClick={(e) => onDelete(e, notif.id)}
      aria-label="Delete notification"
        style={{
          flexShrink: 0, background: "transparent", border: "none",
          color: "#64748b", fontSize: "16px", cursor: "pointer",
          padding: "2px", borderRadius: "5px", display: "flex",
          alignItems: "center", marginTop: "2px",
          opacity: hovered ? 1 : 0,
          transform: hovered ? "translateX(0)" : "translateX(4px)",
          transition: "opacity 0.15s ease, color 0.15s ease, transform 0.15s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
      >
        <IoTrashOutline />
      </button>
    </div>
  );
}