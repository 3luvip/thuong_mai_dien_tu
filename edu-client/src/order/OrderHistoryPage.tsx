// src/components/Orders/OrderHistoryPage.tsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  FiShoppingBag, FiPackage, FiCalendar, FiTag,
  FiChevronDown, FiChevronUp, FiSearch, FiFilter,
  FiBookOpen, FiCheck, FiClock, FiAlertCircle,
  FiArrowRight, FiDollarSign,
} from "react-icons/fi";
import { MdOutlineOndemandVideo } from "react-icons/md";
import axiosInstance from "../lib/axios";
import { formatVnd } from "../utils/currency";
import { getCourseImageUrl } from "../utils/courseImage";
import { session } from "../lib/storage";
// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  courseId: string;
  title: string;
  filename: string;
  price: number;
}

interface Order {
  id: string;
  status: "pending" | "paid" | "failed" | "refunded";
  finalAmount: number;
  createdAt: string;
  items: OrderItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  paid: {
    label: "Paid",
    color: "#4ade80",
    bg: "rgba(34,197,94,0.1)",
    border: "rgba(34,197,94,0.25)",
    icon: <FiCheck size={11} />,
  },
  pending: {
    label: "Pending",
    color: "#fbbf24",
    bg: "rgba(245,158,11,0.1)",
    border: "rgba(245,158,11,0.25)",
    icon: <FiClock size={11} />,
  },
  failed: {
    label: "Failed",
    color: "#f87171",
    bg: "rgba(239,68,68,0.1)",
    border: "rgba(239,68,68,0.25)",
    icon: <FiAlertCircle size={11} />,
  },
  refunded: {
    label: "Refunded",
    color: "#94a3b8",
    bg: "rgba(148,163,184,0.1)",
    border: "rgba(148,163,184,0.2)",
    icon: <FiArrowRight size={11} />,
  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.02em",
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function formatDate(dateStr: string): { display: string; relative: string } {
  try {
    const d = new Date(dateStr.replace(" ", "T"));
    const display = d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / 86_400_000);
    const relative =
      days === 0
        ? "Today"
        : days === 1
          ? "Yesterday"
          : days < 30
            ? `${days} days ago`
            : `${Math.floor(days / 30)} months ago`;
    return { display, relative };
  } catch {
    return { display: dateStr, relative: "" };
  }
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);
  const { display, relative } = formatDate(order.createdAt);
  const shortId = order.id.slice(-8).toUpperCase();
  const itemCount = order.items.length;
  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;

  return (
    <div
      style={{
        background: "#0b1120",
        border: `1px solid ${expanded ? "rgba(99,102,241,0.25)" : "rgba(148,163,184,0.08)"}`,
        borderRadius: 16,
        overflow: "hidden",
        transition: "border-color 0.2s ease",
      }}
    >
      {/* Order header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "18px 20px",
          cursor: "pointer",
          background: expanded ? "rgba(99,102,241,0.04)" : "transparent",
          transition: "background 0.15s ease",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Icon */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: order.status === "paid" ? "rgba(34,197,94,0.12)" : "rgba(99,102,241,0.1)",
            border: `1px solid ${order.status === "paid" ? "rgba(34,197,94,0.25)" : "rgba(99,102,241,0.2)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: order.status === "paid" ? "#4ade80" : "#818cf8",
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          <FiPackage />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5, flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 13,
                fontWeight: 700,
                color: "#e2e8f0",
                letterSpacing: "0.06em",
              }}
            >
              #{shortId}
            </span>
            <StatusBadge status={order.status} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span
              style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}
            >
              <FiCalendar size={11} />
              {display}
              {relative && (
                <span style={{ color: "#334155" }}>· {relative}</span>
              )}
            </span>
            <span
              style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}
            >
              <FiBookOpen size={11} />
              {itemCount} course{itemCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Amount + toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#f97316" }}>
              {formatVnd(order.finalAmount)} ₫
            </div>
            <div style={{ fontSize: 11, color: "#334155" }}>Total paid</div>
          </div>
          <button
            type="button"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: expanded ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${expanded ? "rgba(99,102,241,0.3)" : "rgba(148,163,184,0.1)"}`,
              color: expanded ? "#818cf8" : "#475569",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {expanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expanded items */}
      {expanded && (
        <div
          style={{
            borderTop: "1px solid rgba(148,163,184,0.07)",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* Order meta */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              background: "rgba(255,255,255,0.02)",
              borderRadius: 8,
              border: "1px solid rgba(148,163,184,0.06)",
            }}
          >
            <FiTag size={11} style={{ color: "#475569" }} />
            <span style={{ fontSize: 11, color: "#475569" }}>Order ID: </span>
            <span
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 11,
                color: "#64748b",
                letterSpacing: "0.04em",
              }}
            >
              {order.id}
            </span>
          </div>

          {/* Course items */}
          {order.items.map((item) => (
            <div
              key={item.courseId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 14px",
                background: "rgba(255,255,255,0.02)",
                borderRadius: 10,
                border: "1px solid rgba(148,163,184,0.06)",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = "rgba(99,102,241,0.06)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)";
              }}
            >
              {/* Thumbnail */}
              <div
                style={{
                  width: 64,
                  aspectRatio: "16/9",
                  borderRadius: 8,
                  overflow: "hidden",
                  flexShrink: 0,
                  background: "#1e293b",
                }}
              >
                <img
                  src={getCourseImageUrl(item.filename)}
                  alt={item.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://s.udemycdn.com/course/750x422/placeholder.jpg";
                  }}
                />
              </div>

              {/* Course info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link
                  to={`/course-detail/${item.courseId}`}
                  style={{ textDecoration: "none" }}
                >
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#e2e8f0",
                      margin: "0 0 4px",
                      lineHeight: 1.4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#818cf8")}
                    onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "#e2e8f0")}
                  >
                    {item.title}
                  </p>
                </Link>
                <span
                  style={{
                    fontSize: 11,
                    color: "#475569",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <MdOutlineOndemandVideo size={11} />
                  Online course
                </span>
              </div>

              {/* Price */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#f97316" }}>
                  {formatVnd(item.price)} ₫
                </span>
              </div>
            </div>
          ))}

          {/* Actions */}
          {order.status === "paid" && (
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <Link
                to="/my-courses"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  borderRadius: 9,
                  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: "none",
                  boxShadow: "0 4px 14px rgba(99,102,241,0.3)",
                }}
              >
                <FiBookOpen size={12} />
                Go to My Courses
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        background: "#0b1120",
        border: "1px solid rgba(148,163,184,0.08)",
        borderRadius: 16,
        padding: "18px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "#1e293b",
          flexShrink: 0,
          animation: "sk-pulse 1.4s ease infinite",
        }}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            width: "35%",
            height: 14,
            borderRadius: 6,
            background: "#1e293b",
            animation: "sk-pulse 1.4s ease infinite",
          }}
        />
        <div
          style={{
            width: "55%",
            height: 11,
            borderRadius: 6,
            background: "#1e293b",
            animation: "sk-pulse 1.4s ease 0.1s infinite",
          }}
        />
      </div>
      <div
        style={{
          width: 80,
          height: 18,
          borderRadius: 6,
          background: "#1e293b",
          animation: "sk-pulse 1.4s ease 0.2s infinite",
        }}
      />
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "100px 24px",
        gap: 16,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: "rgba(99,102,241,0.08)",
          border: "1px solid rgba(99,102,241,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          color: "#4f46e5",
          marginBottom: 8,
        }}
      >
        <FiShoppingBag />
      </div>
      <h3
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: "#e2e8f0",
          margin: 0,
          letterSpacing: "-0.3px",
        }}
      >
        No purchases yet
      </h3>
      <p style={{ fontSize: 14, color: "#64748b", margin: 0, maxWidth: 360, lineHeight: 1.6 }}>
        Your order history will appear here after you purchase a course. Start learning today!
      </p>
      <Link
        to="/"
        style={{
          marginTop: 8,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 24px",
          borderRadius: 10,
          background: "linear-gradient(135deg, #6366f1, #4f46e5)",
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
          textDecoration: "none",
          boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
        }}
      >
        <FiBookOpen size={14} />
        Browse Courses
      </Link>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OrderHistoryPage() {
  const navigate = useNavigate();
  const userId = session.getUserId();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending" | "failed" | "refunded">("all");

  useEffect(() => {
    if (!userId) { navigate("/login"); return; }
    axiosInstance
      .get(`/orders/my-orders/${userId}`)
      .then((res) => setOrders(res.data.orders ?? []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [userId]);

  // ── Aggregate stats ──────────────────────────────────────────────────────
  const totalSpent = orders
    .filter((o) => o.status === "paid")
    .reduce((sum, o) => sum + o.finalAmount, 0);
  const totalCourses = orders
    .filter((o) => o.status === "paid")
    .reduce((sum, o) => sum + o.items.length, 0);
  const paidOrders = orders.filter((o) => o.status === "paid").length;

  // ── Filter ───────────────────────────────────────────────────────────────
  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      o.id.toLowerCase().includes(q) ||
      o.items.some((i) => i.title.toLowerCase().includes(q));
    return matchStatus && matchSearch;
  });

  const countFor = (s: string) =>
    s === "all" ? orders.length : orders.filter((o) => o.status === s).length;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        color: "#e2e8f0",
        fontFamily: '"DM Sans", "Inter", system-ui, sans-serif',
        paddingBottom: 80,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');

        @keyframes sk-pulse { 0%,100%{opacity:.3} 50%{opacity:.8} }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .order-card-anim {
          animation: fadeSlideIn 0.35s ease both;
        }
      `}</style>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px 0" }}>

        {/* ── Page header ── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 16,
                boxShadow: "0 4px 14px rgba(99,102,241,0.4)",
              }}
            >
              <FiShoppingBag />
            </div>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: "#f1f5f9",
                margin: 0,
                letterSpacing: "-0.5px",
              }}
            >
              Order History
            </h1>
          </div>
          <p style={{ fontSize: 14, color: "#475569", margin: 0 }}>
            All your course purchases in one place
          </p>
        </div>

        {/* ── Stats row ── */}
        {!loading && orders.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              marginBottom: 28,
            }}
          >
            {[
              {
                label: "Total Spent",
                value: `${formatVnd(totalSpent)} ₫`,
                icon: <FiDollarSign size={16} />,
                color: "#f97316",
                accent: "rgba(249,115,22,0.1)",
                border: "rgba(249,115,22,0.2)",
              },
              {
                label: "Courses Purchased",
                value: totalCourses.toString(),
                icon: <FiBookOpen size={16} />,
                color: "#818cf8",
                accent: "rgba(99,102,241,0.1)",
                border: "rgba(99,102,241,0.2)",
              },
              {
                label: "Paid Orders",
                value: paidOrders.toString(),
                icon: <FiCheck size={16} />,
                color: "#4ade80",
                accent: "rgba(34,197,94,0.1)",
                border: "rgba(34,197,94,0.2)",
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: s.accent,
                  border: `1px solid ${s.border}`,
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: s.accent,
                    border: `1px solid ${s.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: s.color,
                    flexShrink: 0,
                  }}
                >
                  {s.icon}
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>
                    {s.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Toolbar ── */}
        {!loading && orders.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
            {/* Search */}
            <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
              <FiSearch
                size={13}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#334155",
                  pointerEvents: "none",
                }}
              />
              <input
                type="text"
                placeholder="Search by order ID or course..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  paddingLeft: 34,
                  paddingRight: 12,
                  paddingTop: 9,
                  paddingBottom: 9,
                  background: "#0f172a",
                  border: "1px solid rgba(148,163,184,0.1)",
                  borderRadius: 10,
                  color: "#e2e8f0",
                  fontSize: 13,
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
            </div>

            {/* Status filters */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["all", "paid", "pending", "failed", "refunded"] as const).map((s) => {
                const active = statusFilter === s;
                const count = countFor(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "7px 13px",
                      borderRadius: 8,
                      border: active
                        ? "1px solid rgba(99,102,241,0.4)"
                        : "1px solid rgba(148,163,184,0.1)",
                      background: active ? "rgba(99,102,241,0.12)" : "transparent",
                      color: active ? "#818cf8" : "#475569",
                      fontSize: 12,
                      fontWeight: active ? 700 : 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <FiFilter size={10} />
                    {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                    {count > 0 && (
                      <span
                        style={{
                          background: active ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.06)",
                          color: active ? "#a5b4fc" : "#334155",
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "0 5px",
                          borderRadius: 4,
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Content ── */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
            <style>{`@keyframes sk-pulse{0%,100%{opacity:.3}50%{opacity:.8}}`}</style>
          </div>
        ) : orders.length === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 0",
              color: "#475569",
              fontSize: 14,
            }}
          >
            <FiSearch style={{ fontSize: "2.5rem", marginBottom: 12, display: "block", margin: "0 auto 12px" }} />
            <p style={{ margin: 0 }}>No orders match your search.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 13, color: "#334155", margin: "0 0 4px" }}>
              Showing{" "}
              <strong style={{ color: "#e2e8f0" }}>{filtered.length}</strong>{" "}
              of <strong style={{ color: "#e2e8f0" }}>{orders.length}</strong> orders
            </p>
            {filtered.map((order, i) => (
              <div
                key={order.id}
                className="order-card-anim"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <OrderCard order={order} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}