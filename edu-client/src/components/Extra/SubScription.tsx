import { NavLink } from 'react-router-dom';
import { RiContactsFill, RiTeamFill, RiBuildingFill } from "react-icons/ri";
import { FaArrowRight } from "react-icons/fa6";
import { GoVerified } from "react-icons/go";
import { HiSparkles } from "react-icons/hi2";
import "../../style/components/_subscription.scss";

const plans = [
  {
    id: "personal",
    label: "Personal",
    icon: <RiContactsFill />,
    audience: "For you",
    audienceSize: "Individual",
    price: "Starting at 500.000 ₫",
    period: "per month",
    billing: "Billed monthly or annually. Cancel anytime.",
    cta: "Start subscription",
    ctaTo: "/subscription",
    accentVar: "--accent-indigo",
    featured: false,
    features: [
      "Access to 26,000+ top courses",
      "Certification prep",
      "Goal-focused recommendations",
      "AI-powered coding exercises",
    ],
  },
  {
    id: "team",
    label: "Team",
    icon: <RiTeamFill />,
    audience: "For your team",
    audienceSize: "2 to 20 people",
    price: "2.000.000 ₫",
    period: "a month per user",
    billing: "Billed monthly or annually. Cancel anytime.",
    cta: "Start subscription",
    ctaTo: "/subscription",
    accentVar: "--accent-violet",
    featured: true,
    features: [
      "Access to 26,000+ top courses",
      "Certification prep",
      "Goal-focused recommendations",
      "AI-powered coding exercises",
      "Advanced analytics dashboard",
      "Priority support",
      "Custom learning paths",
    ],
  },
  {
    id: "enterprise",
    label: "Enterprise",
    icon: <RiBuildingFill />,
    audience: "For your whole organization",
    audienceSize: "More than 20 people",
    price: "Contact sales",
    period: "for pricing",
    billing: "Billed monthly or annually. Cancel anytime.",
    cta: "Request a demo",
    ctaTo: "/subscription",
    accentVar: "--accent-cyan",
    featured: false,
    features: [
      "Everything in Team plan",
      "SSO & advanced security",
      "Dedicated Customer Success",
      "Custom integrations & API",
      "Centralized billing",
      "AI-powered coding exercises",
      "International course collection",
      "In-person onboarding",
      "SLA guarantees",
      "Volume licensing",
    ],
  },
];

function SubScription() {
  return (
    <section className="sub-section">
      <div className="sub-container">

        {/* ── Header ── */}
        <div className="sub-header">
          <span className="sub-eyebrow">
            <HiSparkles /> Plans &amp; Pricing
          </span>
          <h1 className="sub-heading">
            Accelerate growth —<br />
            <span className="sub-heading__highlight">for you or your organization</span>
          </h1>
          <p className="sub-subtext">
            Reach goals faster with one of our plans or programs.
            Try one free today or contact sales to learn more.
          </p>
        </div>

        {/* ── Cards ── */}
        <div className="sub-grid">
          {plans.map((plan, i) => (
            <div
              key={plan.id}
              className={`sub-card sub-card--${plan.id}${plan.featured ? " sub-card--featured" : ""}`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              {plan.featured && (
                <div className="sub-card__most-popular">
                  <HiSparkles /> Most Popular
                </div>
              )}

              {/* Top accent bar */}
              <div className="sub-card__bar" />

              {/* Plan identity */}
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

              {/* Pricing */}
              <div className="sub-card__pricing">
                <p className="sub-card__price">{plan.price}</p>
                <p className="sub-card__period">{plan.period}</p>
                <p className="sub-card__billing">{plan.billing}</p>

                <NavLink to={plan.ctaTo} className="sub-card__cta">
                  {plan.cta}
                  <FaArrowRight className="sub-card__cta-icon" />
                </NavLink>
              </div>

              <div className="sub-card__divider" />

              {/* Features */}
              <ul className="sub-card__features">
                {plan.features.map((f) => (
                  <li key={f} className="sub-card__feature">
                    <GoVerified className="sub-card__check" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

export default SubScription;