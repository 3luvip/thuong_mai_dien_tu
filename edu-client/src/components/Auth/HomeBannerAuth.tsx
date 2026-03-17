import { useEffect, useState } from "react";
import axiosInstance from "../../lib/axios";
import { Link } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import { Navigation, Autoplay, EffectFade } from "swiper/modules";
import "swiper/css/effect-fade";
import "../../style/components/_home_banner_auth.scss";

const BannerSlide = [
  {
    id: 1,
    img: "https://img-c.udemycdn.com/notices/web_carousel_slide/image/bedc6aeb-62a6-48d1-a8c3-187c075b1fe4.jpg",
    tag: "Career Accelerator",
    title: "Skills that start careers",
    description:
      "Focus on the skills and real-world experience that get you noticed by top employers.",
    link: "Explore Career Accelerators",
  },
  {
    id: 2,
    img: "https://img-c.udemycdn.com/notices/web_carousel_slide/image/1ca69d1f-7b08-4753-8549-61c56d0f5e23.png",
    tag: "New Release",
    title: "Learn from industry experts",
    description:
      "Thousands of courses taught by real professionals, updated regularly with new content.",
    link: "Browse New Courses",
  },
  {
    id: 3,
    img: "https://img-c.udemycdn.com/notices/web_carousel_slide/image/b8958bb4-65ed-4735-b5f3-bdc1178de8ad.jpg",
    tag: "Top Rated",
    title: "Master in-demand skills",
    description:
      "From AI to cloud computing — gain certifications that open doors to new opportunities.",
    link: "View Top Courses",
  },
];

function HomeBannerAuth() {
  const [userName, setuserName] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axiosInstance.get("/auth/user-Info");
        setuserName(response.data.name);
      } catch (err) {
        console.log("Error fetching ", err);
      }
    };
    fetchUser();
  }, []);

  const firstLetter = userName ? userName.charAt(0).toUpperCase() : "?";

  return (
    <section className="auth-section">
      {/* ── User greeting bar ── */}
      <div className="auth-greeting">
        <div className="auth-greeting__avatar">{firstLetter}</div>
        <div className="auth-greeting__text">
          <h1 className="auth-greeting__name">
            Welcome back,
            <span>{userName ? ` ${userName}` : "..."}</span>
          </h1>
          <p className="auth-greeting__sub">
            Web Developer ·{" "}
            <Link to="/" className="auth-greeting__edit">
              Edit occupation &amp; interests
            </Link>
          </p>
        </div>
      </div>

      {/* ── Banner Swiper ── */}
      <div className="auth-banner">
        <Swiper
          navigation
          loop
          effect="fade"
          autoplay={{ delay: 5000, disableOnInteraction: false }}
          modules={[Navigation, Autoplay, EffectFade]}
          className="auth-swiper"
        >
          {BannerSlide.map((slide) => (
            <SwiperSlide key={slide.id}>
              <div className="auth-slide">
                {/* Full-bleed image */}
                <img
                  className="auth-slide__img"
                  src={slide.img}
                  alt={slide.title}
                />

                {/* Gradient overlay */}
                <div className="auth-slide__overlay" />

                {/* Content box — no opaque box, floats over image */}
                <div className="auth-slide__content">
                  <span className="auth-slide__tag">{slide.tag}</span>
                  <h2 className="auth-slide__title">{slide.title}</h2>
                  <p className="auth-slide__desc">{slide.description}</p>
                  <Link to="/" className="auth-slide__cta">
                    {slide.link} →
                  </Link>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}

export default HomeBannerAuth;
