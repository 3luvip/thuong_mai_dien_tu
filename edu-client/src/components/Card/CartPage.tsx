import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { IoTrashOutline, IoClose } from "react-icons/io5";
import { MdOutlineVerified } from "react-icons/md";
import { BsCheck2 } from "react-icons/bs";
import { RiCoupon3Line } from "react-icons/ri";
import { useCart } from "../../context/useCart";
import { getCourseImageUrl } from "../../utils/courseImage";
import { formatVnd } from "../../utils/currency";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../context/toast";
import "../../style/components/_cart.scss";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CouponResult {
  couponId: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  discount: number;
  finalTotal: number;
  usageInfo: { userUsed: number; perUserLimit: number; remaining: number };
}

type CouponStatus = "idle" | "loading" | "success" | "error";

type PaymentMethod =
  | "momo"
  | "zalopay"
  | "vnpay"
  | "bank_vcb"
  | "bank_tcb"
  | "bank_acb"
  | "bank_mb";

interface PaymentOption {
  id: PaymentMethod;
  label: string;
  sub: string;
  group: "wallet" | "bank";
  color: string;
  bg: string;
  icon: React.ReactNode;
}

const PAYMENT_OPTIONS: PaymentOption[] = [
  // ── E-wallets ──
  {
    id: "momo",
    label: "MoMo",
    sub: "MoMo e-wallet",
    group: "wallet",
    color: "#fff",
    bg: "#ae2070",
    icon: (
      <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: -1 }}>
        M
      </span>
    ),
  },
  {
    id: "zalopay",
    label: "ZaloPay",
    sub: "ZaloPay e-wallet",
    group: "wallet",
    color: "#fff",
    bg: "#0068ff",
    icon: <span style={{ fontSize: 20, fontWeight: 900 }}>Z</span>,
  },
  {
    id: "vnpay",
    label: "VNPay",
    sub: "VNPay QR wallet",
    group: "wallet",
    color: "#fff",
    bg: "#e31837",
    icon: <span style={{ fontSize: 18, fontWeight: 900 }}>VN</span>,
  },

  // ── Banks ──
  {
    id: "bank_vcb",
    label: "Vietcombank",
    sub: "ATM / Internet Banking",
    group: "bank",
    color: "#fff",
    bg: "#006633",
    icon: <span style={{ fontSize: 14, fontWeight: 700 }}>VCB</span>,
  },
  {
    id: "bank_tcb",
    label: "Techcombank",
    sub: "ATM / Internet Banking",
    group: "bank",
    color: "#fff",
    bg: "#d0021b",
    icon: <span style={{ fontSize: 14, fontWeight: 700 }}>TCB</span>,
  },
  {
    id: "bank_acb",
    label: "ACB",
    sub: "ATM / Internet Banking",
    group: "bank",
    color: "#fff",
    bg: "#005c9e",
    icon: <span style={{ fontSize: 14, fontWeight: 700 }}>ACB</span>,
  },
  {
    id: "bank_mb",
    label: "MB Bank",
    sub: "ATM / Internet Banking",
    group: "bank",
    color: "#fff",
    bg: "#003087",
    icon: <span style={{ fontSize: 14, fontWeight: 700 }}>MB</span>,
  },
];

// ─── Payment Modal ────────────────────────────────────────────────────────────
function PaymentModal({
  finalTotal,
  onConfirm,
  onClose,
  loading,
}: {
  finalTotal: number;
  onConfirm: (method: PaymentMethod) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [selected, setSelected] = useState<PaymentMethod>("momo");

  const wallets = PAYMENT_OPTIONS.filter((p) => p.group === "wallet");
  const banks = PAYMENT_OPTIONS.filter((p) => p.group === "bank");

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2,6,23,0.8)",
          backdropFilter: "blur(4px)",
          zIndex: 9000,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          zIndex: 9001,
          width: "min(520px, 94vw)",
          background: "#0f172a",
          border: "1px solid rgba(99,102,241,0.25)",
          borderRadius: 20,
          boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
          fontFamily: '"Inter", system-ui, sans-serif',
          overflow: "hidden",
          animation: "pmFadeIn .22s ease",
        }}
      >
        <style>{`
          @keyframes pmFadeIn {
            from { opacity: 0; transform: translate(-50%,-48%) scale(.96); }
            to   { opacity: 1; transform: translate(-50%,-50%) scale(1); }
          }
        `}</style>

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 24px 16px",
            borderBottom: "1px solid rgba(148,163,184,0.1)",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: "#f1f5f9",
              }}
            >
              Select payment method
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
              Total amount:{" "}
              <strong style={{ color: "#f97316" }}>
                {formatVnd(finalTotal)} ₫
              </strong>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(148,163,184,0.08)",
              border: "none",
              color: "#94a3b8",
              width: 36,
              height: 36,
              borderRadius: 10,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            <IoClose />
          </button>
        </div>

        {/* Body */}
        <div
          style={{ padding: "20px 24px", maxHeight: "60vh", overflowY: "auto" }}
        >
          {/* Ví điện tử */}
          <p style={sectionLabel}>🪙 E-wallets</p>
          <div style={optionGrid}>
            {wallets.map((opt) => (
              <PaymentOptionCard
                key={opt.id}
                opt={opt}
                selected={selected === opt.id}
                onSelect={() => setSelected(opt.id)}
              />
            ))}
          </div>

          {/* Ngân hàng */}
          <p style={{ ...sectionLabel, marginTop: 20 }}>🏦 Banks</p>
          <div style={optionGrid}>
            {banks.map((opt) => (
              <PaymentOptionCard
                key={opt.id}
                opt={opt}
                selected={selected === opt.id}
                onSelect={() => setSelected(opt.id)}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px 20px",
            borderTop: "1px solid rgba(148,163,184,0.1)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* Selected method summary */}
          {(() => {
            const opt = PAYMENT_OPTIONS.find((p) => p.id === selected)!;
            return (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  background: "rgba(99,102,241,0.08)",
                  border: "1px solid rgba(99,102,241,0.25)",
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: opt.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: opt.color,
                    flexShrink: 0,
                  }}
                >
                  {opt.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}
                  >
                    {opt.label}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    {opt.sub}
                  </div>
                </div>
                <div
                  style={{ fontSize: 15, fontWeight: 700, color: "#f97316" }}
                >
                  {formatVnd(finalTotal)} ₫
                </div>
              </div>
            );
          })()}

          <button
            type="button"
            onClick={() => onConfirm(selected)}
            disabled={loading}
            style={{
              width: "100%",
              padding: "13px",
              background: loading
                ? "#4f46e5"
                : "linear-gradient(135deg,#6366f1,#4f46e5)",
              border: "none",
              borderRadius: 12,
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: loading ? 0.75 : 1,
              transition: "opacity .15s",
            }}
          >
            {loading ? (
              <>
                <span
                  style={{
                    width: 18,
                    height: 18,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "pmSpin .7s linear infinite",
                    display: "inline-block",
                  }}
                />
                Processing your payment...
              </>
            ) : (
              <>✓ Confirm payment</>
            )}
          </button>

          <style>{`@keyframes pmSpin { to { transform: rotate(360deg); } }`}</style>

          <p
            style={{
              margin: 0,
              textAlign: "center",
              fontSize: 12,
              color: "#475569",
            }}
          >
            🔒 Transactions are secured with SSL encryption — 100% safe
          </p>
        </div>
      </div>
    </>,
    document.body,
  );
}

// ─── PaymentOptionCard ────────────────────────────────────────────────────────
function PaymentOptionCard({
  opt,
  selected,
  onSelect,
}: {
  opt: PaymentOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "14px 10px",
        background: selected
          ? "rgba(99,102,241,0.12)"
          : "rgba(255,255,255,0.03)",
        border: selected
          ? "1.5px solid rgba(99,102,241,0.6)"
          : "1.5px solid rgba(148,163,184,0.1)",
        borderRadius: 12,
        cursor: "pointer",
        transition: "all .15s",
        position: "relative",
      }}
    >
      {/* Selected check */}
      {selected && (
        <span
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#6366f1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            color: "#fff",
            fontWeight: 700,
          }}
        >
          ✓
        </span>
      )}

      {/* Logo */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: opt.bg,
          color: opt.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: selected ? `0 4px 16px ${opt.bg}66` : "none",
          transition: "box-shadow .15s",
        }}
      >
        {opt.icon}
      </div>

      <span
        style={{
          fontSize: 12,
          fontWeight: selected ? 600 : 400,
          color: selected ? "#c7d2fe" : "#94a3b8",
          transition: "color .15s",
        }}
      >
        {opt.label}
      </span>
    </button>
  );
}

const sectionLabel: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: 12,
  fontWeight: 600,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const optionGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
  gap: 10,
};

// ─── CartPage ─────────────────────────────────────────────────────────────────
function CartPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { cartItems, fetchCart, removeFromCart, clearCart } = useCart();
  const [userId, setUserId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  // Coupon
  const [couponCode, setCouponCode] = useState("");
  const [couponStatus, setCouponStatus] = useState<CouponStatus>("idle");
  const [couponResult, setCouponResult] = useState<CouponResult | null>(null);
  const [couponError, setCouponError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    const uid = localStorage.getItem("userId");
    if (!uid) {
      navigate("/login");
      return;
    }
    setUserId(uid);
    fetchCart(uid);
  }, []);

  useEffect(() => {
    setCouponResult(null);
    setCouponStatus("idle");
    setCouponError("");
    setCouponCode("");
  }, [cartItems.length]);

  // ── Tính giá ──────────────────────────────────────────────────────────────
  const totalOriginal = cartItems.reduce((sum, c) => {
    return sum + (Number(String(c.price).replace(/[^0-9.]/g, "")) || 0);
  }, 0);

  const totalAfterCourseDiscount = cartItems.reduce((sum, c) => {
    const original = Number(String(c.price).replace(/[^0-9.]/g, "")) || 0;
    const current =
      c.currentPrice != null
        ? Number(String(c.currentPrice).replace(/[^0-9.]/g, ""))
        : null;
    const eff =
      current != null && current > 0 && current < original ? current : original;
    return sum + eff;
  }, 0);

  const courseDiscount = totalOriginal - totalAfterCourseDiscount;
  const couponDiscount = couponResult?.discount ?? 0;
  const finalTotal = couponResult?.finalTotal ?? totalAfterCourseDiscount;
  const totalSaved = courseDiscount + couponDiscount;

  // ── Coupon ────────────────────────────────────────────────────────────────
  const handleApplyCoupon = async () => {
    const code = couponCode.trim();
    if (!code || !userId) return;
    setCouponStatus("loading");
    setCouponError("");
    setCouponResult(null);
    try {
      const res = await axiosInstance.post("/courseCreation/apply-coupon", {
        user_id: userId,
        code,
        order_total: totalAfterCourseDiscount,
      });
      const data = res.data;
      setCouponResult({
        couponId: data.couponId,
        code: data.coupon.code,
        type: data.coupon.type,
        value: data.coupon.value,
        discount: data.discount,
        finalTotal: data.finalTotal,
        usageInfo: data.usageInfo,
      });
      setCouponStatus("success");
      toast.success(
        "Coupon applied successfully!",
        `You saved ${formatVnd(data.discount)} ₫`,
      );
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Invalid code.";
      setCouponError(msg);
      setCouponStatus("error");
      toast.error("Invalid code.", msg);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponResult(null);
    setCouponCode("");
    setCouponStatus("idle");
    setCouponError("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleRemove = async (courseId: string) => {
    if (!userId) return;
    setRemoving(courseId);
    await removeFromCart(userId, courseId);
    setRemoving(null);
  };

  const handleClearAll = async () => {
    if (!userId) return;
    if (!confirm("Are you sure you want to clear your cart?")) return;
    await clearCart(userId);
  };

  // ── Checkout: bước 1 → mở modal chọn phương thức ─────────────────────────
  const handleOpenPayment = () => {
    if (!userId || cartItems.length === 0) return;
    setShowPaymentModal(true);
  };

  // ── Checkout: bước 2 → confirm sau khi chọn phương thức ──────────────────
  const handleConfirmPayment = async (method: PaymentMethod) => {
    if (!userId) return;
    setCheckingOut(true);
    try {
      if (couponResult) {
        await axiosInstance.post("/courseCreation/confirm-coupon", {
          user_id: userId,
          coupon_id: couponResult.couponId,
          discount_amount: couponResult.discount,
        });
      }

      await axiosInstance.post("/orders/checkout", {
        user_id: userId,
        course_ids: cartItems.map((c) => c.id),
        coupon_id: couponResult?.couponId ?? null,
        total_amount: totalOriginal,
        discount_amount: totalSaved,
        final_amount: finalTotal,
        payment_method: method, // gửi kèm method cho backend nếu cần
      });

      setShowPaymentModal(false);

      const methodLabel =
        PAYMENT_OPTIONS.find((p) => p.id === method)?.label ?? method;
      toast.success(
        "Payment successful",
        `${methodLabel} · ${cartItems.length} courses · ${formatVnd(finalTotal)}`,
      );

      await fetchCart(userId);
      navigate("/my-courses");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "We couldn't process your payment. Please try again.";

      toast.error("Payment failed", msg);
    } finally {
      setCheckingOut(false);
    }
  };

  // ── Empty state ───────────────────────────────────────────────────────────
  if (cartItems.length === 0) {
    return (
      <div className="cart-page">
        <div className="cart-empty">
          <div className="cart-empty__icon">🛒</div>
          <h2 className="cart-empty__title">Your cart is empty</h2>
          <p className="cart-empty__sub">
            Add a course to start your learning journey!
          </p>
          <Link to="/" className="cart-empty__btn">
            Browse courses
          </Link>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="cart-page">
      <div className="cart-page__inner">
        <div className="cart-page__header">
          <div>
            <h1 className="cart-page__title">Your cart</h1>
            <p className="cart-page__count">
              {cartItems.length} courses in your cart
            </p>
          </div>
          {cartItems.length > 1 && (
            <button
              type="button"
              className="cart-page__clear-btn"
              onClick={handleClearAll}
            >
              Clear all
            </button>
          )}
        </div>

        <div className="cart-page__layout">
          {/* ── Danh sách khóa học ── */}
          <div className="cart-list">
            {cartItems.map((course) => {
              const courseId = course.id;
              const price =
                Number(String(course.price).replace(/[^0-9.]/g, "")) || 0;
              const current =
                course.currentPrice != null
                  ? Number(String(course.currentPrice).replace(/[^0-9.]/g, ""))
                  : null;
              const hasDiscount =
                current != null && current > 0 && current < price;
              const effectivePrice = hasDiscount ? current! : price;
              const discountPct = hasDiscount
                ? Math.round(((price - current!) / price) * 100)
                : 0;

              return (
                <div key={courseId} className="cart-item">
                  <Link
                    to={`/course-detail/${courseId}`}
                    className="cart-item__img-wrap"
                  >
                    <img
                      className="cart-item__img"
                      src={getCourseImageUrl(course.path)}
                      alt={course.title}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://s.udemycdn.com/course/750x422/placeholder.jpg";
                      }}
                    />
                  </Link>
                  <div className="cart-item__info">
                    <Link
                      to={`/course-detail/${courseId}`}
                      className="cart-item__title"
                    >
                      {course.title}
                    </Link>
                    <p className="cart-item__author">
                      By <span>{course.author}</span>
                    </p>
                    <div className="cart-item__meta">
                      <span className="cart-item__level">
                        <BsCheck2 /> {course.level}
                      </span>
                      <span className="cart-item__badge">
                        <MdOutlineVerified /> Premium
                      </span>
                    </div>
                  </div>
                  <div className="cart-item__right">
                    <div className="cart-item__price-col">
                      <span className="cart-item__price-now">
                        {formatVnd(effectivePrice)} ₫
                      </span>
                      {hasDiscount && (
                        <>
                          <span className="cart-item__price-was">
                            {formatVnd(price)} ₫
                          </span>
                          <span className="cart-item__discount-badge">
                            -{discountPct}%
                          </span>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      className={`cart-item__remove ${removing === courseId ? "cart-item__remove--loading" : ""}`}
                      onClick={() => handleRemove(courseId)}
                      disabled={removing === courseId}
                      aria-label="Remove from cart"
                    >
                      <IoTrashOutline />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Order summary ── */}
          <div className="cart-summary">
            <h2 className="cart-summary__title">Order total</h2>

            <div className="cart-summary__rows">
              <div className="cart-summary__row">
                <span>Original price ({cartItems.length} courses)</span>
                <span>{formatVnd(totalOriginal)} ₫</span>
              </div>
              {courseDiscount > 0 && (
                <div className="cart-summary__row cart-summary__row--discount">
                  <span>Discount</span>
                  <span>-{formatVnd(courseDiscount)} ₫</span>
                </div>
              )}
              {couponResult && couponDiscount > 0 && (
                <div className="cart-summary__row cart-summary__row--coupon">
                  <span>
                    Coupon <strong>{couponResult.code}</strong>
                    {couponResult.type === "percent"
                      ? ` (${couponResult.value}% off)`
                      : ""}
                  </span>
                  <span>-{formatVnd(couponDiscount)} ₫</span>
                </div>
              )}
              <div className="cart-summary__divider" />
              <div className="cart-summary__row cart-summary__row--total">
                <span>Total</span>
                <span className="cart-summary__final-price">
                  {formatVnd(finalTotal)} ₫
                </span>
              </div>
              {totalSaved > 0 && (
                <div className="cart-summary__saved">
                  🎉 Total savings: <strong>{formatVnd(totalSaved)} ₫</strong>
                </div>
              )}
            </div>

            {/* ── Nút thanh toán ── */}
            <button
              type="button"
              className="cart-summary__checkout-btn"
              onClick={handleOpenPayment}
            >
              <span>Pay now</span>
              <span className="cart-summary__checkout-price">
                {formatVnd(finalTotal)} ₫
              </span>
            </button>

            {/* ── Payment methods bar ── */}
            <div className="cart-summary__methods">
              <p className="cart-summary__methods-label">
                Accepted payment methods
              </p>
              <div className="cart-summary__methods-icons">
                {PAYMENT_OPTIONS.map((p) => (
                  <div
                    key={p.id}
                    className="cart-summary__method-chip"
                    title={p.label}
                    style={{ background: p.bg, color: p.color }}
                  >
                    {p.icon}
                  </div>
                ))}
              </div>
            </div>

            <p className="cart-summary__guarantee">
              🔒 SSL secure payment · 30-day refund
            </p>

            {/* ── Coupon ── */}
            <div className="cart-summary__coupon">
              <p className="cart-summary__coupon-label">
                <RiCoupon3Line /> Discount code
              </p>

              {couponResult ? (
                <div className="coupon-applied">
                  <div className="coupon-applied__info">
                    <span className="coupon-applied__tag">
                      {couponResult.code}
                    </span>
                    <span className="coupon-applied__desc">
                      {couponResult.type === "percent"
                        ? `Save ${couponResult.value}% → -${formatVnd(couponDiscount)} ₫`
                        : `-${formatVnd(couponDiscount)} ₫`}
                    </span>
                  </div>
                  {couponResult.usageInfo.remaining > 0 && (
                    <span className="coupon-applied__remaining">
                      Remaining {couponResult.usageInfo.remaining} uses
                    </span>
                  )}
                  <button
                    type="button"
                    className="coupon-applied__remove"
                    onClick={handleRemoveCoupon}
                    aria-label="Remove code"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="cart-summary__coupon-row">
                  <input
                    ref={inputRef}
                    type="text"
                    className={`cart-summary__coupon-input ${couponStatus === "error" ? "cart-summary__coupon-input--error" : ""}`}
                    placeholder="Enter discount code..."
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      if (couponStatus === "error") {
                        setCouponStatus("idle");
                        setCouponError("");
                      }
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                    disabled={couponStatus === "loading"}
                  />
                  <button
                    type="button"
                    className={`cart-summary__coupon-btn ${couponStatus === "loading" ? "cart-summary__coupon-btn--loading" : ""}`}
                    onClick={handleApplyCoupon}
                    disabled={couponStatus === "loading" || !couponCode.trim()}
                  >
                    {couponStatus === "loading" ? (
                      <span className="coupon-spinner" />
                    ) : (
                      "Apply"
                    )}
                  </button>
                </div>
              )}

              {couponStatus === "error" && (
                <p className="coupon-error">⚠ {couponError}</p>
              )}

              {couponStatus === "idle" && !couponCode && (
                <p className="coupon-hint">
                  Try:{" "}
                  {["WELCOME20", "SAVE50K", "CTUET2025"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCouponCode(c)}
                    >
                      {c}
                    </button>
                  ))}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Payment Modal ── */}
      {showPaymentModal && (
        <PaymentModal
          finalTotal={finalTotal}
          onConfirm={handleConfirmPayment}
          onClose={() => !checkingOut && setShowPaymentModal(false)}
          loading={checkingOut}
        />
      )}
    </div>
  );
}

export default CartPage;
