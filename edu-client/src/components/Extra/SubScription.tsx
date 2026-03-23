// src/components/Extra/SubScription.tsx
// Component nhỏ hiển thị trên trang Home — click → /subscription

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RiContactsFill, RiTeamFill, RiBuildingFill } from "react-icons/ri";
import { FaArrowRight } from "react-icons/fa6";
import { GoVerified } from "react-icons/go";
import { HiSparkles } from "react-icons/hi2";
import { FiZap, FiUsers } from "react-icons/fi";
import axiosInstance from "../../lib/axios";
import { session } from "../../lib/storage";
import "../../style/components/_subscription.scss";

const plans = [
  {
    id: "personal",
    label: "Personal",
    tier: "pro",
    icon: <RiContactsFill />,
    audience: "Dành cho bạn",
    audienceSize: "Cá nhân",
    price: "500.000 ₫",
    period: "/ tháng",
    billing: "Hủy bất cứ lúc nào · Không tự gia hạn",
    cta: "Đăng ký Pro",
    accentVar: "--accent-indigo",
    featured: false,
    discount: 15,
    features: [
      "Giảm 15% tự động mọi đơn hàng",
      "Không cần nhập mã giảm giá",
      "Badge ⚡ Pro trên profile",
      "Ưu tiên hỗ trợ qua email",
    ],
  },
  {
    id: "team",
    label: "Team",
    tier: "team",
    icon: <RiTeamFill />,
    audience: "Dành cho nhóm",
    audienceSize: "2 đến 20 người",
    price: "2.000.000 ₫",
    period: "/ tháng / người",
    billing: "Hủy bất cứ lúc nào · Không tự gia hạn",
    cta: "Đăng ký Team",
    accentVar: "--accent-violet",
    featured: true,
    discount: 25,
    features: [
      "Giảm 25% tự động mọi đơn hàng",
      "Không cần nhập mã giảm giá",
      "Badge 🏆 Team Leader",
      "Hỗ trợ ưu tiên 24/7",
      "Mọi tính năng của Personal",
    ],
  },
  {
    id: "enterprise",
    label: "Enterprise",
    tier: null,
    icon: <RiBuildingFill />,
    audience: "Cả tổ chức",
    audienceSize: "Hơn 20 người",
    price: "Liên hệ",
    period: "tuỳ chỉnh",
    billing: "Thoả thuận theo nhu cầu doanh nghiệp",
    cta: "Liên hệ sales",
    accentVar: "--accent-cyan",
    featured: false,
    discount: 0,
    features: [
      "Tất cả tính năng Team",
      "SSO & bảo mật nâng cao",
      "Tích hợp API & Custom",
      "Onboarding tại chỗ",
      "SLA đảm bảo",
    ],
  },
];

function SubScription() {
  const navigate = useNavigate();
  const userId = session.getUserId();
  const [currentTier, setCurrentTier] = useState<string>("free");

  useEffect(() => {
    if (!userId) return;
    axiosInstance.get(`/membership/${userId}`)
      .then(res => setCurrentTier(res.data.tier ?? "free"))
      .catch(() => {});
  }, [userId]);

  function handleCta(plan: typeof plans[0]) {
    if (!userId) {
      navigate("/login");
      return;
    }
    navigate("/subscription");
  }

  return (
    <section className="sub-section">
      <div className="sub-container">

        {/* ── Header ── */}
        <div className="sub-header">
          <span className="sub-eyebrow">
            <HiSparkles /> Membership &amp; Pricing
          </span>
          <h1 className="sub-heading">
            Học nhiều hơn,{" "}
            <span className="sub-heading__highlight">chi ít hơn</span>
          </h1>
          <p className="sub-subtext">
            Membership tự động giảm giá mọi khóa học bạn mua —<br />
            không cần nhập mã, không giới hạn.
          </p>

          {/* Active membership banner */}
          {currentTier !== "free" && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "8px 18px", borderRadius: 999,
              background: currentTier === "pro"
                ? "rgba(99,102,241,0.12)" : "rgba(6,182,212,0.1)",
              border: `1px solid ${currentTier === "pro" ? "rgba(99,102,241,0.35)" : "rgba(6,182,212,0.3)"}`,
              color: currentTier === "pro" ? "#818cf8" : "#22d3ee",
              fontSize: 12, fontWeight: 700, marginTop: 16,
            }}>
              {currentTier === "pro" ? <FiZap size={13}/> : <FiUsers size={13}/>}
              Bạn đang dùng {currentTier === "pro" ? "⚡ Pro" : "🏆 Team"} Membership
            </div>
          )}
        </div>

        {/* ── Cards ── */}
        <div className="sub-grid">
          {plans.map((plan, i) => {
            const isCurrent = plan.tier === currentTier;
            return (
              <div
                key={plan.id}
                className={`sub-card sub-card--${plan.id}${plan.featured ? " sub-card--featured" : ""}`}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                {plan.featured && (
                  <div className="sub-card__most-popular">
                    <HiSparkles /> Phổ biến nhất
                  </div>
                )}

                {/* Discount badge */}
                {plan.discount > 0 && (
                  <div style={{
                    position: "absolute", top: plan.featured ? 44 : 14, right: 14,
                    padding: "3px 10px", borderRadius: 6,
                    background: "rgba(34,197,94,0.12)",
                    border: "1px solid rgba(34,197,94,0.3)",
                    color: "#4ade80", fontSize: 11, fontWeight: 800,
                  }}>
                    -{plan.discount}% off
                  </div>
                )}

                <div className="sub-card__bar" />

                <div className="sub-card__head">
                  <div className="sub-card__icon">{plan.icon}</div>
                  <div>
                    <h2 className="sub-card__plan">{plan.label} Plan</h2>
                    <p className="sub-card__audience">{plan.audience}</p>
                    <p className="sub-card__size">
                      <RiContactsFill /> {plan.audienceSize}
                    </p>
                  </div>
                </div>

                <div className="sub-card__divider" />

                <div className="sub-card__pricing">
                  <p className="sub-card__price">{plan.price}</p>
                  <p className="sub-card__period">{plan.period}</p>
                  <p className="sub-card__billing">{plan.billing}</p>

                  <button
                    onClick={() => handleCta(plan)}
                    disabled={isCurrent}
                    className="sub-card__cta"
                    style={{
                      cursor: isCurrent ? "default" : "pointer",
                      opacity: isCurrent ? 0.7 : 1,
                      border: "none",
                      width: "100%",
                      fontFamily: "inherit",
                    }}
                  >
                    {isCurrent ? "✓ Đang dùng" : plan.cta}
                    {!isCurrent && <FaArrowRight className="sub-card__cta-icon" />}
                  </button>
                </div>

                <div className="sub-card__divider" />

                <ul className="sub-card__features">
                  {plan.features.map((f) => (
                    <li key={f} className="sub-card__feature">
                      <GoVerified className="sub-card__check" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* View all plans link */}
        <div style={{ textAlign: "center", marginTop: 28 }}>
          <button
            onClick={() => navigate("/subscription")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 22px", borderRadius: 10,
              background: "rgba(99,102,241,0.1)",
              border: "1px solid rgba(99,102,241,0.3)",
              color: "#818cf8", fontFamily: "inherit",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            Xem chi tiết tất cả gói <FaArrowRight size={12} />
          </button>
        </div>

      </div>
    </section>
  );
}

export default SubScription;