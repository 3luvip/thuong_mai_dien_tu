// src/components/pages/SubscriptionPage.tsx
// Đặt tại: src/components/pages/SubscriptionPage.tsx
// Route: /subscription (thêm vào App.tsx, protected allowedRoles: ["user","instructor"])

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiCheck, FiZap, FiUsers, FiShield, FiClock,
  FiStar, FiTrendingUp, FiGift, FiArrowRight,
  FiX, FiCheckCircle,
} from "react-icons/fi";
import { HiSparkles } from "react-icons/hi2";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../context/toast";
import { formatVnd } from "../../utils/currency";
import { session } from "../../lib/storage";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MembershipInfo {
  tier: "free" | "pro" | "team";
  expiresAt: string | null;
  isActive: boolean;
  discount: number;
  history: {
    id: string;
    tier: string;
    pricePaid: number;
    durationDays: number;
    startedAt: string;
    expiresAt: string;
    status: string;
    paymentMethod: string | null;
  }[];
}

type PaymentMethod =
  | "momo" | "zalopay" | "vnpay"
  | "bank_vcb" | "bank_tcb" | "bank_acb";

// ─── Plan config ──────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: "free" as const,
    label: "Free",
    icon: <FiStar size={22} />,
    price: 0,
    priceLabel: "Miễn phí",
    period: "mãi mãi",
    discount: 0,
    color: "#64748b",
    glow: "rgba(100,116,139,0.3)",
    accentBg: "rgba(100,116,139,0.08)",
    border: "rgba(100,116,139,0.2)",
    featured: false,
    features: [
      { text: "Mua từng khóa học lẻ", ok: true },
      { text: "Wishlist & theo dõi tiến độ", ok: true },
      { text: "Ghi chú bài giảng", ok: true },
      { text: "Đánh giá khóa học", ok: true },
      { text: "Giảm giá tự động", ok: false },
      { text: "Ưu tiên hỗ trợ", ok: false },
      { text: "Badge thành viên đặc biệt", ok: false },
    ],
  },
  {
    id: "pro" as const,
    label: "Pro",
    icon: <FiZap size={22} />,
    price: 500_000,
    priceLabel: "500.000 ₫",
    period: "/ tháng",
    discount: 15,
    color: "#6366f1",
    glow: "rgba(99,102,241,0.4)",
    accentBg: "rgba(99,102,241,0.1)",
    border: "rgba(99,102,241,0.4)",
    featured: true,
    features: [
      { text: "Mua từng khóa học lẻ", ok: true },
      { text: "Wishlist & theo dõi tiến độ", ok: true },
      { text: "Ghi chú bài giảng", ok: true },
      { text: "Đánh giá khóa học", ok: true },
      { text: "Giảm giá 15% tự động mọi đơn", ok: true },
      { text: "Ưu tiên hỗ trợ qua email", ok: true },
      { text: "Badge ⚡ Pro trên profile", ok: true },
    ],
  },
  {
    id: "team" as const,
    label: "Team",
    icon: <FiUsers size={22} />,
    price: 2_000_000,
    priceLabel: "2.000.000 ₫",
    period: "/ tháng / người",
    discount: 25,
    color: "#06b6d4",
    glow: "rgba(6,182,212,0.4)",
    accentBg: "rgba(6,182,212,0.08)",
    border: "rgba(6,182,212,0.3)",
    featured: false,
    features: [
      { text: "Mua từng khóa học lẻ", ok: true },
      { text: "Wishlist & theo dõi tiến độ", ok: true },
      { text: "Ghi chú bài giảng", ok: true },
      { text: "Đánh giá khóa học", ok: true },
      { text: "Giảm giá 25% tự động mọi đơn", ok: true },
      { text: "Hỗ trợ ưu tiên 24/7", ok: true },
      { text: "Badge 🏆 Team Leader", ok: true },
    ],
  },
];

const PAYMENT_OPTS: { id: PaymentMethod; label: string; bg: string; icon: string }[] = [
  { id: "momo",     label: "MoMo",        bg: "#ae2070", icon: "M" },
  { id: "zalopay",  label: "ZaloPay",     bg: "#0068ff", icon: "Z" },
  { id: "vnpay",    label: "VNPay",       bg: "#e31837", icon: "VN" },
  { id: "bank_vcb", label: "Vietcombank", bg: "#006633", icon: "VCB" },
  { id: "bank_tcb", label: "Techcombank", bg: "#d0021b", icon: "TCB" },
  { id: "bank_acb", label: "ACB",         bg: "#005c9e", icon: "ACB" },
];

// ─── Subscribe Modal ──────────────────────────────────────────────────────────

function SubscribeModal({
  plan,
  onClose,
  onSuccess,
}: {
  plan: typeof PLANS[1] | typeof PLANS[2];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const userId = session.getUserId();
  const [method, setMethod]   = useState<PaymentMethod>("momo");
  const [duration, setDuration] = useState<1 | 3 | 12>(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const durations = [
    { months: 1,  label: "1 tháng",  save: 0 },
    { months: 3,  label: "3 tháng",  save: 5 },
    { months: 12, label: "12 tháng", save: 20 },
  ];

  const selectedDuration = durations.find(d => d.months === duration)!;
  const basePrice = plan.price * duration;
  const savePct   = selectedDuration.save;
  const finalPrice = Math.round(basePrice * (1 - savePct / 100));
  const saved      = basePrice - finalPrice;

  async function handleSubscribe() {
    if (!userId) return;
    setLoading(true);
    try {
      await axiosInstance.post("/membership/subscribe", {
        user_id:        userId,
        tier:           plan.id,
        payment_method: method,
        duration_days:  duration * 30,
      });
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? "Đăng ký thất bại, thử lại sau.";
      toast.error("Lỗi", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "rgba(2,6,23,0.85)",
          backdropFilter: "blur(6px)",
        }}
      />

      {/* Modal */}
      <div style={{
        position: "fixed", top: "50%", left: "50%", zIndex: 9001,
        transform: "translate(-50%,-50%)",
        width: "min(540px, 94vw)",
        background: "#080f1e",
        border: `1px solid ${plan.border}`,
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: `0 0 60px ${plan.glow}, 0 32px 80px rgba(0,0,0,0.8)`,
        animation: "modalIn .25s cubic-bezier(0.22,1,0.36,1)",
        fontFamily: "'Sora', system-ui, sans-serif",
      }}>
        <style>{`
          @keyframes modalIn {
            from { opacity:0; transform:translate(-50%,-48%) scale(.95); }
            to   { opacity:1; transform:translate(-50%,-50%) scale(1); }
          }
          @keyframes checkPop {
            0%  { transform:scale(0) rotate(-10deg); opacity:0; }
            60% { transform:scale(1.2) rotate(5deg); }
            100%{ transform:scale(1) rotate(0deg); opacity:1; }
          }
        `}</style>

        {/* Header */}
        <div style={{
          padding: "22px 26px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: plan.accentBg,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `linear-gradient(135deg, ${plan.color}, ${plan.color}99)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 20,
              boxShadow: `0 4px 16px ${plan.glow}`,
            }}>
              {plan.icon}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9" }}>
                Đăng ký {plan.label}
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                Giảm {plan.discount}% tự động tất cả đơn hàng
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#64748b", width: 32, height: 32, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <FiX size={15} />
          </button>
        </div>

        {success ? (
          /* Success state */
          <div style={{
            padding: "48px 26px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "rgba(34,197,94,0.12)",
              border: "2px solid rgba(34,197,94,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32, color: "#4ade80",
              animation: "checkPop .5s cubic-bezier(0.22,1,0.36,1)",
            }}>
              <FiCheckCircle />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9" }}>
              Kích hoạt thành công! 🎉
            </div>
            <div style={{ fontSize: 13, color: "#64748b", textAlign: "center" }}>
              Membership <strong style={{ color: plan.color }}>{plan.label}</strong> đã được kích hoạt.<br />
              Bạn sẽ được giảm <strong style={{ color: "#4ade80" }}>{plan.discount}%</strong> tự động khi thanh toán.
            </div>
          </div>
        ) : (
          <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Duration selector */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Thời hạn
              </label>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {durations.map(d => (
                  <button
                    key={d.months}
                    onClick={() => setDuration(d.months as 1|3|12)}
                    style={{
                      flex: 1, padding: "10px 8px", borderRadius: 10,
                      border: duration === d.months
                        ? `1.5px solid ${plan.color}`
                        : "1.5px solid rgba(255,255,255,0.08)",
                      background: duration === d.months ? plan.accentBg : "transparent",
                      color: duration === d.months ? plan.color : "#64748b",
                      fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                      cursor: "pointer", transition: "all .15s",
                      position: "relative",
                    }}
                  >
                    {d.months > 1 && (
                      <div style={{
                        position: "absolute", top: -8, right: 6,
                        background: "#22c55e", color: "#fff",
                        fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 4,
                      }}>
                        -{d.save}%
                      </div>
                    )}
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Price breakdown */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12, padding: "14px 16px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>
                  {plan.priceLabel} × {duration} tháng
                </span>
                <span style={{ fontSize: 13, color: "#94a3b8" }}>{formatVnd(basePrice)} ₫</span>
              </div>
              {savePct > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: "#22c55e" }}>Ưu đãi dài hạn (-{savePct}%)</span>
                  <span style={{ fontSize: 13, color: "#22c55e" }}>-{formatVnd(saved)} ₫</span>
                </div>
              )}
              <div style={{
                display: "flex", justifyContent: "space-between",
                paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 6,
              }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>Tổng cộng</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: plan.color }}>
                  {formatVnd(finalPrice)} ₫
                </span>
              </div>
            </div>

            {/* Payment method */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Phương thức thanh toán
              </label>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8,
              }}>
                {PAYMENT_OPTS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setMethod(opt.id)}
                    style={{
                      padding: "10px 6px",
                      border: method === opt.id
                        ? `1.5px solid ${plan.color}`
                        : "1.5px solid rgba(255,255,255,0.08)",
                      background: method === opt.id ? plan.accentBg : "rgba(255,255,255,0.03)",
                      borderRadius: 10, cursor: "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      transition: "all .15s",
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: opt.bg, color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 800,
                    }}>
                      {opt.icon}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      color: method === opt.id ? plan.color : "#64748b",
                    }}>
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Benefit reminder */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", borderRadius: 10,
              background: "rgba(34,197,94,0.06)",
              border: "1px solid rgba(34,197,94,0.2)",
            }}>
              <FiGift size={14} style={{ color: "#4ade80", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                Sau khi thanh toán, <strong style={{ color: "#4ade80" }}>giảm {plan.discount}% tự động</strong> được áp dụng ngay
                vào tất cả đơn hàng tiếp theo — không cần nhập mã.
              </span>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubscribe}
              disabled={loading}
              style={{
                padding: "13px", borderRadius: 12, border: "none",
                background: loading
                  ? `${plan.color}99`
                  : `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)`,
                color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: `0 4px 20px ${plan.glow}`,
                transition: "opacity .15s",
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: 16, height: 16, borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff",
                    animation: "spin .7s linear infinite", display: "inline-block",
                  }} />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <FiZap size={14} />
                  Thanh toán {formatVnd(finalPrice)} ₫
                </>
              )}
            </button>

            <p style={{ margin: 0, textAlign: "center", fontSize: 11, color: "#334155" }}>
              🔒 Bảo mật SSL · Hủy bất cứ lúc nào · Không tự động gia hạn
            </p>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const toast     = useToast();
  const userId    = session.getUserId();

  const [membership, setMembership]       = useState<MembershipInfo | null>(null);
  const [loading, setLoading]             = useState(true);
  const [selectedPlan, setSelectedPlan]   = useState<typeof PLANS[1] | typeof PLANS[2] | null>(null);
  const [showHistory, setShowHistory]     = useState(false);

  async function fetchMembership() {
    if (!userId) return;
    try {
      const res = await axiosInstance.get(`/membership/${userId}`);
      setMembership(res.data);
    } catch {
      // Không có membership — mặc định free
      setMembership({ tier: "free", expiresAt: null, isActive: false, discount: 0, history: [] });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!userId) { navigate("/login"); return; }
    fetchMembership();
  }, [userId]);

  const currentTier = membership?.tier ?? "free";
  const daysLeft = membership?.expiresAt
    ? Math.ceil((new Date(membership.expiresAt).getTime() - Date.now()) / 86_400_000)
    : 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#020617",
      fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif",
      color: "#e2e8f0",
      paddingBottom: 80,
    }}>
      <style>{`
        @keyframes float {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-8px); }
        }
        @keyframes glow-pulse {
          0%,100% { opacity: 0.4; }
          50%      { opacity: 0.8; }
        }
      `}</style>

      {/* ── Hero ── */}
      <div style={{
        position: "relative", overflow: "hidden",
        padding: "64px 24px 52px",
        textAlign: "center",
      }}>
        {/* Background orbs */}
        <div style={{
          position: "absolute", top: -60, left: "20%",
          width: 400, height: 400, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)",
          animation: "glow-pulse 4s ease infinite",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: -40, right: "15%",
          width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)",
          animation: "glow-pulse 4s ease infinite 2s",
          pointerEvents: "none",
        }} />

        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 16px", borderRadius: 999,
          background: "rgba(99,102,241,0.12)",
          border: "1px solid rgba(99,102,241,0.3)",
          color: "#818cf8", fontSize: 12, fontWeight: 700,
          letterSpacing: "0.08em", textTransform: "uppercase",
          marginBottom: 20,
        }}>
          <HiSparkles /> Plans &amp; Pricing
        </span>

        <h1 style={{
          fontSize: "clamp(28px, 5vw, 48px)",
          fontWeight: 900, lineHeight: 1.15,
          margin: "0 0 16px",
          letterSpacing: "-0.03em",
          color: "#f1f5f9",
        }}>
          Học nhiều hơn,{" "}
          <span style={{
            background: "linear-gradient(135deg, #6366f1, #06b6d4)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            chi ít hơn
          </span>
        </h1>

        <p style={{
          fontSize: 15, color: "#64748b", maxWidth: 480,
          margin: "0 auto 32px", lineHeight: 1.7,
        }}>
          Membership tự động giảm giá mọi khóa học bạn mua —<br />
          không cần nhập mã, không giới hạn số lượng.
        </p>

        {/* Stats row */}
        <div style={{
          display: "inline-flex", gap: 0,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14, overflow: "hidden",
          marginBottom: 8,
        }}>
          {[
            { icon: <FiTrendingUp size={13}/>, label: "Tiết kiệm đến", value: "25%" },
            { icon: <FiShield size={13}/>,     label: "Hoàn tiền",     value: "30 ngày" },
            { icon: <FiClock size={13}/>,      label: "Kích hoạt",     value: "Ngay lập tức" },
          ].map((s, i) => (
            <div key={i} style={{
              padding: "12px 22px",
              borderRight: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#6366f1" }}>
                {s.icon}
                <span style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>{s.value}</span>
              </div>
              <span style={{ fontSize: 11, color: "#475569" }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Current membership status (if active) ── */}
      {membership?.isActive && (
        <div style={{
          maxWidth: 860, margin: "0 auto 32px", padding: "0 24px",
        }}>
          <div style={{
            padding: "16px 22px",
            background: currentTier === "pro"
              ? "rgba(99,102,241,0.08)"
              : "rgba(6,182,212,0.08)",
            border: `1px solid ${currentTier === "pro" ? "rgba(99,102,241,0.3)" : "rgba(6,182,212,0.3)"}`,
            borderRadius: 14,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: currentTier === "pro" ? "#6366f1" : "#06b6d4",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 18,
              }}>
                {currentTier === "pro" ? <FiZap /> : <FiUsers />}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>
                  {currentTier === "pro" ? "⚡ Pro" : "🏆 Team"} Membership đang hoạt động
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Còn <strong style={{ color: currentTier === "pro" ? "#818cf8" : "#22d3ee" }}>
                    {daysLeft} ngày
                  </strong> · Hết hạn {membership.expiresAt?.split(" ")[0]}
                  · Giảm <strong style={{ color: "#4ade80" }}>{membership.discount}%</strong> tự động
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowHistory(v => !v)}
              style={{
                padding: "7px 14px", borderRadius: 8, cursor: "pointer",
                background: "transparent", fontFamily: "inherit", fontSize: 12,
                border: "1px solid rgba(255,255,255,0.1)", color: "#64748b",
              }}
            >
              {showHistory ? "Ẩn" : "Xem"} lịch sử
            </button>
          </div>

          {/* History */}
          {showHistory && membership.history.length > 0 && (
            <div style={{
              marginTop: 8,
              background: "#080f1e",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12, overflow: "hidden",
            }}>
              {membership.history.map((h, i) => (
                <div key={h.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px",
                  borderBottom: i < membership.history.length - 1
                    ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    padding: "2px 8px", borderRadius: 4,
                    background: h.tier === "pro"
                      ? "rgba(99,102,241,0.12)" : "rgba(6,182,212,0.1)",
                    color: h.tier === "pro" ? "#818cf8" : "#22d3ee",
                  }}>
                    {h.tier.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 12, color: "#64748b", flex: 1 }}>
                    {h.startedAt} → {h.expiresAt}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#4ade80" }}>
                    {formatVnd(h.pricePaid)} ₫
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    padding: "2px 8px", borderRadius: 4,
                    background: h.status === "active"
                      ? "rgba(34,197,94,0.1)" : "rgba(100,116,139,0.1)",
                    color: h.status === "active" ? "#4ade80" : "#64748b",
                  }}>
                    {h.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Plan cards ── */}
      <div style={{
        maxWidth: 1000, margin: "0 auto", padding: "0 24px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 20,
      }}>
        {PLANS.map((plan, i) => {
          const isCurrent = currentTier === plan.id;
          const isUpgrade = plan.id !== "free" && !isCurrent;

          return (
            <div
              key={plan.id}
              style={{
                position: "relative",
                background: "#080f1e",
                border: isCurrent
                  ? `2px solid ${plan.color}`
                  : `1px solid ${plan.featured ? plan.border : "rgba(255,255,255,0.07)"}`,
                borderRadius: 20,
                padding: "28px 26px",
                transition: "transform .2s, box-shadow .2s",
                animation: `float ${3 + i * 0.5}s ease-in-out infinite`,
                boxShadow: plan.featured
                  ? `0 0 40px ${plan.glow}, 0 16px 48px rgba(0,0,0,0.4)`
                  : "0 8px 32px rgba(0,0,0,0.3)",
                display: "flex", flexDirection: "column", gap: 20,
              }}
            >
              {/* Featured badge */}
              {plan.featured && (
                <div style={{
                  position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
                  padding: "4px 16px", borderRadius: 999,
                  background: `linear-gradient(135deg, ${plan.color}, ${plan.color}bb)`,
                  color: "#fff", fontSize: 11, fontWeight: 800,
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  boxShadow: `0 4px 16px ${plan.glow}`,
                  display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
                }}>
                  <HiSparkles size={10} /> Phổ biến nhất
                </div>
              )}

              {/* Current badge */}
              {isCurrent && (
                <div style={{
                  position: "absolute", top: 14, right: 14,
                  padding: "3px 10px", borderRadius: 6,
                  background: "rgba(34,197,94,0.12)",
                  border: "1px solid rgba(34,197,94,0.3)",
                  color: "#4ade80", fontSize: 10, fontWeight: 700,
                }}>
                  Hiện tại
                </div>
              )}

              {/* Plan header */}
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 50, height: 50, borderRadius: 14,
                  background: plan.accentBg,
                  border: `1px solid ${plan.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: plan.color, fontSize: 22,
                }}>
                  {plan.icon}
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9" }}>
                    {plan.label}
                  </div>
                  {plan.discount > 0 && (
                    <div style={{
                      fontSize: 11, fontWeight: 700,
                      color: plan.color,
                      background: plan.accentBg,
                      padding: "2px 8px", borderRadius: 4, display: "inline-block",
                    }}>
                      -{plan.discount}% mọi đơn hàng
                    </div>
                  )}
                </div>
              </div>

              {/* Price */}
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{
                    fontSize: plan.id === "free" ? 24 : 28,
                    fontWeight: 900, color: plan.color,
                  }}>
                    {plan.priceLabel}
                  </span>
                  <span style={{ fontSize: 13, color: "#475569" }}>{plan.period}</span>
                </div>
                <div style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>
                  {plan.id === "free"
                    ? "Không cần thẻ tín dụng"
                    : "Hủy bất cứ lúc nào · Không tự gia hạn"
                  }
                </div>
              </div>

              {/* CTA */}
              {plan.id === "free" ? (
                <div style={{
                  padding: "11px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  textAlign: "center",
                  fontSize: 13, fontWeight: 600, color: "#475569",
                }}>
                  {isCurrent ? "✓ Gói hiện tại" : "Miễn phí"}
                </div>
              ) : (
                <button
                  onClick={() => isUpgrade && setSelectedPlan(plan as typeof PLANS[1])}
                  disabled={isCurrent}
                  style={{
                    padding: "12px",
                    borderRadius: 12,
                    border: "none",
                    background: isCurrent
                      ? "rgba(34,197,94,0.1)"
                      : `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)`,
                    color: isCurrent ? "#4ade80" : "#fff",
                    fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                    cursor: isCurrent ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    boxShadow: isCurrent ? "none" : `0 4px 18px ${plan.glow}`,
                    transition: "opacity .15s",
                  }}
                >
                  {isCurrent ? (
                    <><FiCheckCircle size={14} /> Đang dùng</>
                  ) : (
                    <><FiArrowRight size={14} /> Đăng ký {plan.label}</>
                  )}
                </button>
              )}

              {/* Divider */}
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

              {/* Features */}
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {plan.features.map(f => (
                  <li key={f.text} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    opacity: f.ok ? 1 : 0.35,
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                      background: f.ok ? "rgba(34,197,94,0.15)" : "rgba(100,116,139,0.1)",
                      border: `1px solid ${f.ok ? "rgba(34,197,94,0.35)" : "rgba(100,116,139,0.2)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {f.ok
                        ? <FiCheck size={10} color="#4ade80" />
                        : <FiX size={10} color="#475569" />
                      }
                    </div>
                    <span style={{ fontSize: 13, color: f.ok ? "#cbd5e1" : "#475569" }}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* ── FAQ ── */}
      <div style={{
        maxWidth: 640, margin: "52px auto 0", padding: "0 24px",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <h2 style={{
          fontSize: 20, fontWeight: 800, color: "#f1f5f9",
          textAlign: "center", margin: "0 0 8px",
        }}>
          Câu hỏi thường gặp
        </h2>
        {[
          {
            q: "Giảm giá áp dụng như thế nào?",
            a: "Discount được tự động tính vào tổng đơn khi bạn checkout — bạn sẽ thấy dòng 'Membership discount' trong phần tổng tiền. Không cần nhập mã.",
          },
          {
            q: "Membership có thể stack với coupon không?",
            a: "Hiện tại hệ thống áp dụng mức giảm cao hơn giữa membership và coupon, không cộng dồn.",
          },
          {
            q: "Tôi có thể hủy không?",
            a: "Membership không tự gia hạn — khi hết hạn sẽ tự về Free. Bạn không bị trừ tiền thêm.",
          },
          {
            q: "Đăng ký nhiều tháng có rẻ hơn không?",
            a: "Có! Đăng ký 3 tháng giảm thêm 5%, đăng ký 12 tháng giảm thêm 20% so với mua tháng lẻ.",
          },
        ].map((item, i) => (
          <FaqItem key={i} q={item.q} a={item.a} />
        ))}
      </div>

      {/* Subscribe Modal */}
      {selectedPlan && (
        <SubscribeModal
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onSuccess={() => {
            fetchMembership();
            toast.success("🎉 Membership kích hoạt!", "Giảm giá tự động đã sẵn sàng.");
          }}
        />
      )}
    </div>
  );
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: "#080f1e",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12, overflow: "hidden",
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 12,
          padding: "14px 18px", background: "transparent", border: "none",
          color: "#e2e8f0", fontFamily: "inherit", fontSize: 14, fontWeight: 600,
          cursor: "pointer", textAlign: "left",
        }}
      >
        {q}
        <span style={{
          color: "#6366f1", flexShrink: 0,
          transform: open ? "rotate(45deg)" : "rotate(0deg)",
          transition: "transform .2s",
          fontSize: 18,
        }}>+</span>
      </button>
      {open && (
        <div style={{
          padding: "0 18px 14px",
          fontSize: 13, color: "#64748b", lineHeight: 1.7,
          borderTop: "1px solid rgba(255,255,255,0.04)",
          paddingTop: 12,
        }}>
          {a}
        </div>
      )}
    </div>
  );
}