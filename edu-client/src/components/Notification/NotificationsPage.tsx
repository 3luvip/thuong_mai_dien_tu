import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IoCheckmarkDoneOutline,
  IoTrashOutline,
  IoRefreshOutline,
  IoSchoolOutline,
  IoPricetagOutline,
  IoTicketOutline,
  IoInformationCircleOutline,
  IoAlarmOutline,
  IoNotificationsOffOutline,
} from "react-icons/io5";
import axiosInstance from "../../lib/axios";
import { session } from "../../lib/storage";

// ─── Types ────────────────────────────────────────────────────────────────────
type NotifType = "course_added" | "discount" | "coupon" | "system" | "reminder";
type FilterTab = "all" | "unread" | NotifType;

interface Notification {
  id:        string;
  type:      NotifType;
  title:     string;
  body:      string;
  link:      string | null;
  isRead:    boolean;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TYPE_ICON: Record<NotifType, React.ReactElement> = {
  course_added: <IoSchoolOutline />,
  discount:     <IoPricetagOutline />,
  coupon:       <IoTicketOutline />,
  system:       <IoInformationCircleOutline />,
  reminder:     <IoAlarmOutline />,
};

const TYPE_LABEL: Record<NotifType, string> = {
  course_added: "Course",
  discount:     "Discount",
  coupon:       "Coupon",
  system:       "System",
  reminder:     "Reminder",
};

const TYPE_COLORS: Record<NotifType, { bg: string; color: string; accent: string }> = {
  course_added: { bg: "rgba(139,92,246,0.12)", color: "#a78bfa", accent: "#7c3aed" },
  discount:     { bg: "rgba(239,68,68,0.10)",  color: "#f87171", accent: "#dc2626" },
  coupon:       { bg: "rgba(34,197,94,0.10)",  color: "#4ade80", accent: "#16a34a" },
  system:       { bg: "rgba(59,130,246,0.10)", color: "#60a5fa", accent: "#2563eb" },
  reminder:     { bg: "rgba(249,115,22,0.10)", color: "#fb923c", accent: "#ea580c" },
};

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all",          label: "All"      },
  { key: "unread",       label: "Unread"    },
  { key: "course_added", label: "Courses"    },
  { key: "discount",     label: "Discounts"  },
  { key: "coupon",       label: "Coupons" },
  { key: "system",       label: "System"    },
  { key: "reminder",     label: "Reminders"    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseMySQLDate(s: string): Date {
  const d = new Date(s.replace(" ", "T"));
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

function formatFullDate(dateStr: string): string {
  const d = parseMySQLDate(dateStr);
  return d.toLocaleString("vi-VN", {
    weekday: "long", day: "2-digit", month: "2-digit",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// Group notifications by date label
function groupByDate(notifs: Notification[]): { label: string; items: Notification[] }[] {
  const groups: Record<string, Notification[]> = {};
  const now = new Date();

  for (const n of notifs) {
    const d = parseMySQLDate(n.createdAt);
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
    let label: string;
    if (diffDays === 0) label = "Today";
    else if (diffDays === 1) label = "Yesterday";
    else if (diffDays < 7)  label = "This week";
    else if (diffDays < 30) label = "This month";
    else label = d.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });

    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  }

  // Preserve insertion order (already sorted by desc from API)
  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifs,   setNotifs]   = useState<Notification[]>([]);
  const [unread,   setUnread]   = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<FilterTab>("all");
  const [hoverId,  setHoverId]  = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  const userId = session.getUserId();

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchNotifs = useCallback(async (showLoader = true) => {
    if (!userId) { navigate("/login"); return; }
    if (showLoader) setLoading(true);
    try {
      const res = await axiosInstance.get(`/notifications/${userId}`);
      setNotifs(res.data.notifications ?? []);
      setUnread(res.data.unreadCount ?? 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId, navigate]);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const markAllRead = async () => {
    if (!userId || unread === 0) return;
    try {
      await axiosInstance.patch(`/notifications/user/${userId}/read-all`);
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
    } catch (err) { console.error(err); }
  };

  const markOneRead = async (n: Notification) => {
    if (n.isRead) return;
    try {
      await axiosInstance.patch(`/notifications/item/${n.id}/read`);
      setNotifs((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x));
      setUnread((c) => Math.max(0, c - 1));
    } catch (err) { console.error(err); }
  };

  const handleClick = async (n: Notification) => {
    await markOneRead(n);
    if (n.link) navigate(n.link);
  };

  const deleteOne = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleting((s) => new Set(s).add(id));
    try {
      await axiosInstance.delete(`/notifications/item/${id}`);
      const target = notifs.find((n) => n.id === id);
      setNotifs((prev) => prev.filter((n) => n.id !== id));
      if (target && !target.isRead) setUnread((c) => Math.max(0, c - 1));
    } catch (err) { console.error(err); }
    finally { setDeleting((s) => { const ns = new Set(s); ns.delete(id); return ns; }); }
  };

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = notifs.filter((n) => {
    if (filter === "all")    return true;
    if (filter === "unread") return !n.isRead;
    return n.type === filter;
  });

  const grouped = groupByDate(filtered);

  const countFor = (f: FilterTab) => {
    if (f === "all")    return notifs.length;
    if (f === "unread") return unread;
    return notifs.filter((n) => n.type === f).length;
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={ps.page}>
      <div style={ps.container}>

        {/* ── Page header ── */}
        <div style={ps.pageHeader}>
          <div>
            <h1 style={ps.pageTitle}>Notifications</h1>
            <p style={ps.pageSubtitle}>
              {unread > 0
                ? <><strong style={{ color: "#6366f1" }}>{unread}</strong> unread notifications</>
                : "All read"}
            </p>
          </div>
          <div style={ps.headerActions}>
            <button type="button" style={ps.iconBtn} onClick={() => fetchNotifs(false)} title="Refresh">
              <IoRefreshOutline />
            </button>
            {unread > 0 && (
              <button type="button" style={ps.actionBtn} onClick={markAllRead}>
                <IoCheckmarkDoneOutline />
                Read all
              </button>
            )}
          </div>
        </div>

        {/* ── Filter tabs ── */}
        <div style={ps.filterBar}>
          <div style={ps.tabs}>
            {FILTER_TABS.map(({ key, label }) => {
              const count = countFor(key);
              const active = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  style={{ ...ps.tab, ...(active ? ps.tabActive : {}) }}
                  onClick={() => setFilter(key)}
                >
                  {label}
                  {count > 0 && (
                    <span style={{ ...ps.tabCount, ...(active ? ps.tabCountActive : {}) }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Content ── */}
        <div style={ps.content}>
          {loading ? (
            <SkeletonList />
          ) : filtered.length === 0 ? (
            <EmptyState filter={filter} />
          ) : (
            grouped.map(({ label, items }) => (
              <div key={label} style={ps.group}>
                <div style={ps.groupHeader}>
                  <span style={ps.groupLabel}>{label}</span>
                  <span style={ps.groupCount}>{items.length} notifications</span>
                </div>
                <div style={ps.groupList}>
                  {items.map((n) => (
                    <NotifCard
                      key={n.id}
                      notif={n}
                      hovered={hoverId === n.id}
                      deleting={deleting.has(n.id)}
                      onHover={setHoverId}
                      onClick={handleClick}
                      onDelete={deleteOne}
                      onMarkRead={markOneRead}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}

// ─── NotifCard ────────────────────────────────────────────────────────────────
function NotifCard({
  notif, hovered, deleting, onHover, onClick, onDelete, onMarkRead,
}: {
  notif:      Notification;
  hovered:    boolean;
  deleting:   boolean;
  onHover:    (id: string | null) => void;
  onClick:    (n: Notification) => void;
  onDelete:   (e: React.MouseEvent, id: string) => void;
  onMarkRead: (n: Notification) => void;
}) {
  const type   = (notif.type in TYPE_COLORS ? notif.type : "system") as NotifType;
  const colors = TYPE_COLORS[type];

  return (
    <div
      style={{
        ...cs.card,
        ...(hovered ? cs.cardHover : {}),
        ...(notif.isRead ? cs.cardRead : cs.cardUnread),
        ...(deleting ? { opacity: 0.4, pointerEvents: "none" } : {}),
      }}
      onClick={() => onClick(notif)}
      onMouseEnter={() => onHover(notif.id)}
      onMouseLeave={() => onHover(null)}
      role={notif.link ? "button" : undefined}
      tabIndex={notif.link ? 0 : undefined}
      onKeyDown={(e) => e.key === "Enter" && onClick(notif)}
    >
      {/* Unread bar */}
      {!notif.isRead && <div style={cs.unreadBar} />}

      {/* Icon */}
      <div style={{ ...cs.iconWrap, background: colors.bg, color: colors.color }}>
        {TYPE_ICON[type]}
        {/* Type badge */}
        <span style={{ ...cs.typeBadge, background: colors.accent }}>
          {TYPE_LABEL[type]}
        </span>
      </div>

      {/* Body */}
      <div style={cs.body}>
        <div style={cs.topRow}>
          <h3 style={{ ...cs.title, fontWeight: notif.isRead ? 500 : 700 }}>
            {notif.title}
          </h3>
          <time style={cs.time} title={formatFullDate(notif.createdAt)}>
            {timeAgo(notif.createdAt)}
          </time>
        </div>
        <p style={cs.text}>{notif.body}</p>

        <div style={cs.bottomRow}>
          {notif.link && (
            <span style={cs.link}>View details →</span>
          )}
          <div style={{ ...cs.actions, opacity: hovered ? 1 : 0 }}>
            {!notif.isRead && (
              <button
                type="button"
                style={cs.actionBtn}
                onClick={(e) => { e.stopPropagation(); onMarkRead(notif); }}
                title="Mark as read"
              >
                <IoCheckmarkDoneOutline />
                <span>Read</span>
              </button>
            )}
            <button
              type="button"
              style={{ ...cs.actionBtn, ...cs.deleteBtn }}
              onClick={(e) => onDelete(e, notif.id)}
              title="Delete notification"
            >
              <IoTrashOutline />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonList() {
  return (
    <div>
      {[...Array(3)].map((_, gi) => (
        <div key={gi} style={ps.group}>
          <div style={{ ...ps.groupHeader, gap: 8 }}>
            <div style={{ width: 80, height: 14, borderRadius: 6, background: "#1e293b", animation: "sk-pulse 1.4s ease infinite" }} />
          </div>
          <div style={ps.groupList}>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ ...cs.card, cursor: "default" }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: "#1e293b", flexShrink: 0, animation: `sk-pulse 1.4s ease ${i * 0.1}s infinite` }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ width: "55%", height: 14, borderRadius: 6, background: "#1e293b", animation: `sk-pulse 1.4s ease ${i * 0.1}s infinite` }} />
                  <div style={{ width: "90%", height: 12, borderRadius: 6, background: "#1e293b", animation: `sk-pulse 1.4s ease ${i * 0.15}s infinite` }} />
                  <div style={{ width: "70%", height: 12, borderRadius: 6, background: "#1e293b", animation: `sk-pulse 1.4s ease ${i * 0.2}s infinite` }} />
                  <div style={{ width: "25%", height: 11, borderRadius: 6, background: "#1e293b", animation: `sk-pulse 1.4s ease ${i * 0.25}s infinite` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <style>{`@keyframes sk-pulse { 0%,100%{opacity:.3} 50%{opacity:.7} }`}</style>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ filter }: { filter: FilterTab }) {
  const msgs: Record<FilterTab, { icon: string; title: string; sub: string }> = {
    all:          { icon: "🔔", title: "No notifications",     sub: "New notifications will appear here." },
    unread:       { icon: "✅", title: "All read!",       sub: "You've read all notifications." },
    course_added: { icon: "📚", title: "No course notifications", sub: "We'll notify you when new courses are available." },
    discount:     { icon: "🏷️", title: "No discounts",       sub: "We'll let you know when there are new offers." },
    coupon:       { icon: "🎟️", title: "No coupon codes",      sub: "Follow along to get exclusive coupon codes." },
    system:       { icon: "ℹ️",  title: "No system notifications", sub: "Everything is running smoothly." },
    reminder:     { icon: "⏰",  title: "No reminders",         sub: "Start learning to receive progress reminders." },
  };
  const m = msgs[filter] ?? msgs.all;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "80px 20px", gap: "12px",
    }}>
      <IoNotificationsOffOutline style={{ fontSize: "3.5rem", color: "#334155" }} />
      <p style={{ fontSize: "18px", fontWeight: 600, color: "#e5e7eb", margin: 0 }}>
        {m.title}
      </p>
      <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>{m.sub}</p>
    </div>
  );
}

// ─── Page Styles ──────────────────────────────────────────────────────────────
const ps: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#020617",
    paddingBottom: "60px",
  },
  container: {
    maxWidth: "860px",
    margin: "0 auto",
    padding: "36px 24px 0",
  },
  pageHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: "28px",
    flexWrap: "wrap",
    gap: "12px",
  },
  pageTitle: {
    fontSize: "26px",
    fontWeight: 800,
    color: "#f1f5f9",
    margin: "0 0 4px",
    letterSpacing: "-0.4px",
  },
  pageSubtitle: {
    fontSize: "14px",
    color: "#64748b",
    margin: 0,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexShrink: 0,
  },
  iconBtn: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(148,163,184,0.12)",
    color: "#94a3b8",
    fontSize: "18px",
    width: "36px",
    height: "36px",
    borderRadius: "9px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.18s ease",
  },
  actionBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    background: "rgba(99,102,241,0.1)",
    border: "1px solid rgba(99,102,241,0.3)",
    color: "#818cf8",
    fontSize: "13px",
    fontWeight: 500,
    padding: "7px 14px",
    borderRadius: "9px",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.18s ease",
  },
  filterBar: {
    marginBottom: "24px",
    overflowX: "auto",
    paddingBottom: "4px",
  },
  tabs: {
    display: "flex",
    gap: "6px",
    minWidth: "max-content",
  },
  tab: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    background: "transparent",
    border: "1px solid rgba(148,163,184,0.1)",
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 500,
    padding: "7px 14px",
    borderRadius: "999px",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.18s ease",
    whiteSpace: "nowrap",
  },
  tabActive: {
    background: "rgba(99,102,241,0.12)",
    border: "1px solid rgba(99,102,241,0.35)",
    color: "#818cf8",
  },
  tabCount: {
    background: "rgba(148,163,184,0.12)",
    color: "#64748b",
    fontSize: "11px",
    fontWeight: 600,
    padding: "1px 6px",
    borderRadius: "999px",
  },
  tabCountActive: {
    background: "rgba(99,102,241,0.2)",
    color: "#818cf8",
  },
  content: {},
  group: {
    marginBottom: "28px",
  },
  groupHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "10px",
    paddingBottom: "8px",
    borderBottom: "1px solid rgba(148,163,184,0.08)",
  },
  groupLabel: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.7px",
  },
  groupCount: {
    fontSize: "12px",
    color: "#334155",
  },
  groupList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
};

// ─── Card Styles ──────────────────────────────────────────────────────────────
const cs: Record<string, React.CSSProperties> = {
  card: {
    position: "relative",
    display: "flex",
    alignItems: "flex-start",
    gap: "16px",
    padding: "18px 20px",
    background: "#0b1120",
    border: "1px solid rgba(148,163,184,0.08)",
    borderRadius: "14px",
    cursor: "pointer",
    transition: "all 0.18s ease",
    overflow: "hidden",
  },
  cardHover: {
    background: "#0f172a",
    border: "1px solid rgba(148,163,184,0.16)",
    transform: "translateY(-1px)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
  },
  cardRead: {
    opacity: 0.75,
  },
  cardUnread: {
    opacity: 1,
    background: "#0c1220",
  },
  unreadBar: {
    position: "absolute",
    left: 0,
    top: "12px",
    bottom: "12px",
    width: "3px",
    borderRadius: "0 3px 3px 0",
    background: "linear-gradient(180deg, #6366f1, #8b5cf6)",
  },
  iconWrap: {
    position: "relative",
    flexShrink: 0,
    width: "52px",
    height: "52px",
    borderRadius: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "22px",
  },
  typeBadge: {
    position: "absolute",
    bottom: "-8px",
    left: "50%",
    transform: "translateX(-50%)",
    fontSize: "9px",
    fontWeight: 700,
    color: "#fff",
    padding: "2px 5px",
    borderRadius: "4px",
    whiteSpace: "nowrap",
    letterSpacing: "0.2px",
  },
  body: {
    flex: 1,
    minWidth: 0,
    paddingTop: "2px",
  },
  topRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "6px",
  },
  title: {
    fontSize: "14px",
    color: "#e2e8f0",
    margin: 0,
    lineHeight: 1.4,
    flex: 1,
  },
  time: {
    fontSize: "11px",
    color: "#475569",
    flexShrink: 0,
    marginTop: "2px",
  },
  text: {
    fontSize: "13px",
    color: "#64748b",
    margin: "0 0 10px",
    lineHeight: 1.55,
  },
  bottomRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  link: {
    fontSize: "12px",
    color: "#6366f1",
    fontWeight: 500,
  },
  actions: {
    display: "flex",
    gap: "6px",
    marginLeft: "auto",
    transition: "opacity 0.18s ease",
  },
  actionBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(148,163,184,0.12)",
    color: "#94a3b8",
    fontSize: "12px",
    padding: "4px 10px",
    borderRadius: "7px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  deleteBtn: {
    color: "#ef4444",
    background: "rgba(239,68,68,0.06)",
    border: "1px solid rgba(239,68,68,0.15)",
  },
};