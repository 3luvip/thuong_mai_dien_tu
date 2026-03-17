import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IoTrashOutline } from "react-icons/io5";
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
  usageInfo: {
    userUsed: number;
    perUserLimit: number;
    remaining: number;
  };
}

type CouponStatus = "idle" | "loading" | "success" | "error";

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

  // ── Apply coupon ──────────────────────────────────────────────────────────
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
      toast.success("Áp dụng mã thành công!", `Bạn tiết kiệm được ${formatVnd(data.discount)} ₫`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Mã không hợp lệ.";
      setCouponError(msg);
      setCouponStatus("error");
      toast.error("Mã không hợp lệ", msg);
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
    if (!confirm("Bạn có chắc muốn xóa toàn bộ giỏ hàng?")) return;
    await clearCart(userId);
  };

  // ── Checkout ──────────────────────────────────────────────────────────────
  const [checkingOut, setCheckingOut] = useState(false);

  const handleCheckout = async () => {
    if (!userId || cartItems.length === 0) return;
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
      });

      toast.success(
        "Thanh toán thành công! 🎉",
        `Bạn đã mua ${cartItems.length} khóa học với tổng ${formatVnd(finalTotal)} ₫`,
      );

      await fetchCart(userId);
      // ← Chuyển sang My Learning thay vì authenticated-home
      navigate("/my-courses");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Thanh toán thất bại. Vui lòng thử lại.";
      toast.error("Thanh toán thất bại", msg);
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
          <h2 className="cart-empty__title">Giỏ hàng của bạn đang trống</h2>
          <p className="cart-empty__sub">
            Hãy thêm một khóa học để bắt đầu hành trình học tập!
          </p>
          <Link to="/" className="cart-empty__btn">
            Khám phá khóa học
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
            <h1 className="cart-page__title">Giỏ hàng của bạn</h1>
            <p className="cart-page__count">
              {cartItems.length} khóa học trong giỏ hàng
            </p>
          </div>
          {cartItems.length > 1 && (
            <button type="button" className="cart-page__clear-btn" onClick={handleClearAll}>
              Xóa tất cả
            </button>
          )}
        </div>

        <div className="cart-page__layout">
          {/* ── Danh sách khóa học ── */}
          <div className="cart-list">
            {cartItems.map((course) => {
              const courseId = course.id;
              const price = Number(String(course.price).replace(/[^0-9.]/g, "")) || 0;
              const current =
                course.currentPrice != null
                  ? Number(String(course.currentPrice).replace(/[^0-9.]/g, ""))
                  : null;
              const hasDiscount = current != null && current > 0 && current < price;
              const effectivePrice = hasDiscount ? current! : price;
              const discountPct = hasDiscount
                ? Math.round(((price - current!) / price) * 100)
                : 0;

              return (
                <div key={courseId} className="cart-item">
                  <Link to={`/course-detail/${courseId}`} className="cart-item__img-wrap">
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
                    <Link to={`/course-detail/${courseId}`} className="cart-item__title">
                      {course.title}
                    </Link>
                    <p className="cart-item__author">
                      Bởi <span>{course.author}</span>
                    </p>
                    <div className="cart-item__meta">
                      <span className="cart-item__level"><BsCheck2 /> {course.level}</span>
                      <span className="cart-item__badge"><MdOutlineVerified /> Premium</span>
                    </div>
                  </div>

                  <div className="cart-item__right">
                    <div className="cart-item__price-col">
                      <span className="cart-item__price-now">{formatVnd(effectivePrice)} ₫</span>
                      {hasDiscount && (
                        <>
                          <span className="cart-item__price-was">{formatVnd(price)} ₫</span>
                          <span className="cart-item__discount-badge">-{discountPct}%</span>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      className={`cart-item__remove ${removing === courseId ? "cart-item__remove--loading" : ""}`}
                      onClick={() => handleRemove(courseId)}
                      disabled={removing === courseId}
                      aria-label="Xóa khỏi giỏ hàng"
                    >
                      <IoTrashOutline />
                      <span>Xóa</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Order summary ── */}
          <div className="cart-summary">
            <h2 className="cart-summary__title">Tổng đơn hàng</h2>

            <div className="cart-summary__rows">
              <div className="cart-summary__row">
                <span>Giá gốc ({cartItems.length} khóa học)</span>
                <span>{formatVnd(totalOriginal)} ₫</span>
              </div>
              {courseDiscount > 0 && (
                <div className="cart-summary__row cart-summary__row--discount">
                  <span>Giảm giá khóa học</span>
                  <span>-{formatVnd(courseDiscount)} ₫</span>
                </div>
              )}
              {couponResult && couponDiscount > 0 && (
                <div className="cart-summary__row cart-summary__row--coupon">
                  <span>
                    Mã <strong>{couponResult.code}</strong>
                    {couponResult.type === "percent" ? ` (${couponResult.value}%)` : ""}
                  </span>
                  <span>-{formatVnd(couponDiscount)} ₫</span>
                </div>
              )}
              <div className="cart-summary__divider" />
              <div className="cart-summary__row cart-summary__row--total">
                <span>Tổng cộng</span>
                <span className="cart-summary__final-price">{formatVnd(finalTotal)} ₫</span>
              </div>
              {totalSaved > 0 && (
                <div className="cart-summary__saved">
                  🎉 Tiết kiệm <strong>{formatVnd(totalSaved)} ₫</strong>
                </div>
              )}
            </div>

            <button
              type="button"
              className="cart-summary__checkout-btn"
              onClick={handleCheckout}
              disabled={checkingOut}
            >
              {checkingOut ? "Đang xử lý..." : "Thanh toán ngay"}
            </button>

            <p className="cart-summary__guarantee">🔒 Đảm bảo hoàn tiền trong 30 ngày</p>

            {/* ── Coupon ── */}
            <div className="cart-summary__coupon">
              <p className="cart-summary__coupon-label">
                <RiCoupon3Line /> Mã giảm giá
              </p>

              {couponResult ? (
                <div className="coupon-applied">
                  <div className="coupon-applied__info">
                    <span className="coupon-applied__tag">{couponResult.code}</span>
                    <span className="coupon-applied__desc">
                      {couponResult.type === "percent"
                        ? `Giảm ${couponResult.value}% → -${formatVnd(couponDiscount)} ₫`
                        : `-${formatVnd(couponDiscount)} ₫`}
                    </span>
                  </div>
                  {couponResult.usageInfo.remaining > 0 && (
                    <span className="coupon-applied__remaining">
                      Còn {couponResult.usageInfo.remaining} lượt
                    </span>
                  )}
                  <button
                    type="button"
                    className="coupon-applied__remove"
                    onClick={handleRemoveCoupon}
                    aria-label="Xóa mã"
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
                    placeholder="Nhập mã giảm giá..."
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
                    {couponStatus === "loading" ? <span className="coupon-spinner" /> : "Áp dụng"}
                  </button>
                </div>
              )}

              {couponStatus === "error" && <p className="coupon-error">⚠ {couponError}</p>}

              {couponStatus === "idle" && !couponCode && (
                <p className="coupon-hint">
                  Thử:{" "}
                  {["WELCOME20", "SAVE50K", "CTUET2025"].map((c) => (
                    <button key={c} type="button" onClick={() => setCouponCode(c)}>
                      {c}
                    </button>
                  ))}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CartPage;