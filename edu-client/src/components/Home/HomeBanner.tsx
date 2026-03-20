import { NavLink } from "react-router-dom";
import "../../style/components/_homebanner.scss";

function HomeBanner() {
  return (
    <section className="hero">
      {/* Background image */}
      <div className="hero__bg">
        <img
          src="https://img-c.udemycdn.com/notices/web_carousel_slide/image/736cd7ed-d5ca-4efe-9e8d-2eb845e414cb.png"
          alt="Hero background"
        />
        {/* Gradient overlays */}
        <div className="hero__overlay" />
        <div className="hero__overlay-right" />
      </div>

      {/* Content */}
      <div className="hero__content">
        <span className="hero__eyebrow">✦ LEARNING FLATFORM</span>

        <h1 className="hero__heading">
          Skills that drive<br />
          <span className="hero__heading-accent">you forward</span>
        </h1>

        <p className="hero__sub">
          Technology and the world of work change fast —<br />
          with us, you're faster. Get the skills to achieve<br />
          goals and stay competitive.
        </p>

        <div className="hero__actions">
          <NavLink to="/view-plan" className="hero__cta hero__cta--primary">
            View Plans
          </NavLink>
          <NavLink to="/courses" className="hero__cta hero__cta--ghost">
            Browse Courses →
          </NavLink>
        </div>

        {/* Stats row */}
        <div className="hero__stats">
          <div className="hero__stat">
            <span className="hero__stat-num">26K+</span>
            <span className="hero__stat-label">Courses</span>
          </div>
          <div className="hero__stat-divider" />
          <div className="hero__stat">
            <span className="hero__stat-num">50M+</span>
            <span className="hero__stat-label">Learners</span>
          </div>
          <div className="hero__stat-divider" />
          <div className="hero__stat">
            <span className="hero__stat-num">180+</span>
            <span className="hero__stat-label">Countries</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HomeBanner;