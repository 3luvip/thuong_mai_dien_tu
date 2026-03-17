import { FaArrowRight } from "react-icons/fa6";
import { NavLink } from "react-router-dom";
import { HiSparkles } from "react-icons/hi2";
import "../../style/components/_buniness_leader.scss";

function BusinessLeader() {
  return (
    <section className="biz-section">
      <div className="biz-grid">

        <div className="biz-content">
          <span className="biz-eyebrow">
            <HiSparkles /> Featured Program
          </span>
          <h1 className="biz-heading">
            AI for <span className="biz-heading__accent">Business</span> Leaders
          </h1>
          <p className="biz-desc">
            Build an AI-habit for you and your team that builds hands-on
            skills to help you lead effectively.
          </p>
          <NavLink to="/" className="biz-cta">
            Start Learning
            <FaArrowRight className="biz-cta__icon" />
          </NavLink>
        </div>

        <div className="biz-img-wrap">
          <div className="biz-img-glow" />
          <img
            className="biz-img"
            src="https://cms-images.udemycdn.com/96883mtakkm8/32egVZ5YRgjxrz5mr45EwO/2328193d64d64dd0ab01b6019791da22/ai_for_business_leaders_photo__1_.png"
            alt="AI for Business Leaders"
          />
        </div>

      </div>
    </section>
  );
}

export default BusinessLeader;