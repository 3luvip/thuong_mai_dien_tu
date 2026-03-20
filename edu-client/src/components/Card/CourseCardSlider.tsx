import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { MdOutlineVerified } from "react-icons/md";
import { FiHeart } from "react-icons/fi";
import { BsCheck2 } from "react-icons/bs";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import Rating from "../Course/Rating";
import { formatVnd } from "../../utils/currency";
import { getCourseImageUrl } from "../../utils/courseImage";
import axiosInstance from "../../lib/axios";
import "../../style/components/_top_course.scss";
import "../../style/components/_tabs.scss";
import { useToast } from "../../context/toast";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Course {
  id: string;
  cardId: string | null;
  title: string;
  author: string;
  courseSub: string;
  price: number;
  currentPrice: number;
  language: string;
  level: string;
  category: string;
  path: string;
  instructorName: string | null;
}

interface CourseCardSliderProps {
  title: string;
  subtitle?: string;
  /** Filter theo category — nếu không truyền thì lấy tất cả */
  category?: string;
  /** Số card tối đa (mặc định 10) */
  limit?: number;
  /**
   * Đường dẫn nút "Xem tất cả":
   *   - string  → dùng path đó
   *   - false   → ẩn nút
   *   - không truyền → tự tính: /courses?category=<category>
   */
  viewAllLink?: string | false;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getMockRating(id: string) {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return {
    value: Math.min(3.5 + (hash % 15) / 10, 4.9),
    review: 800 + (hash % 9) * 200 + (hash % 37) * 10,
  };
}

function getBadge(id: string): "bestseller" | "new" | null {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  if (hash % 3 === 0) return "bestseller";
  if (hash % 3 === 1) return "new";
  return null;
}

const MOCK_HIGHLIGHTS = [
  "Lifetime access · Certificate of completion",
  "Thực hành với dự án thực tế",
  "Access on mobile and desktop",
];

/** Tạo link "Xem tất cả" từ category */
function buildViewAllLink(category?: string): string {
  if (!category) return "/courses";
  return `/courses?category=${encodeURIComponent(category)}`;
}

// ─── Hover Popup ──────────────────────────────────────────────────────────────
function CoursePopup({
  course,
  anchorRect,
  onAddToCart,
}: {
  course: Course;
  anchorRect: DOMRect;
  onAddToCart: (c: Course) => void;
}) {
  const POPUP_WIDTH = 320;
  const GAP = 8;
  const spaceRight = window.innerWidth - anchorRect.right;
  const left =
    spaceRight >= POPUP_WIDTH + GAP
      ? anchorRect.right + GAP
      : anchorRect.left - POPUP_WIDTH - GAP;
  const top = Math.min(
    Math.max(anchorRect.top + window.scrollY, 8),
    window.scrollY + window.innerHeight - 440,
  );
  const { value, review } = getMockRating(course.id);
  const hasDiscount = course.currentPrice > 0 && course.currentPrice < course.price;

  return createPortal(
    <div className="tabs-popup" style={{ top, left }}>
      <div className="tabs-popup__header">
        <span className="tabs-popup__updated">Updated <strong>2025</strong></span>
        <span className="tabs-popup__meta">{course.level} · {course.language} · Subtitles</span>
      </div>
      <h3 className="tabs-popup__title">{course.title}</h3>
      <p className="tabs-popup__sub">{course.courseSub}</p>
      <div className="tabs-popup__rating">
        <Rating value={value} totalstar={5} review={review} />
      </div>
      <ul className="tabs-popup__highlights">
        {MOCK_HIGHLIGHTS.map((h) => (
          <li key={h}><BsCheck2 className="tabs-popup__check" /><span>{h}</span></li>
        ))}
      </ul>
      <div className="tabs-popup__tags">
        <span className="tabs-popup__tag tabs-popup__tag--premium"><MdOutlineVerified /> Premium</span>
        <span className="tabs-popup__tag tabs-popup__tag--new">New</span>
      </div>
      <div className="tabs-popup__actions">
        <button className="tabs-popup__cart" type="button" onClick={() => onAddToCart(course)}>
          Add to cart
        </button>
        <button className="tabs-popup__wish" type="button" aria-label="Wishlist">
          <FiHeart />
        </button>
      </div>
      <div className="tabs-popup__price">
        {hasDiscount ? (
          <>
            <span className="tabs-popup__price--now">{formatVnd(course.currentPrice)} ₫</span>
            <span className="tabs-popup__price--was">{formatVnd(course.price)} ₫</span>
          </>
        ) : (
          <span className="tabs-popup__price--now">{formatVnd(course.price)} ₫</span>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─── Single Card ──────────────────────────────────────────────────────────────
function CourseCard({
  course,
  onMouseEnter,
  onMouseLeave,
}: {
  course: Course;
  onMouseEnter: (id: string, el: HTMLDivElement) => void;
  onMouseLeave: () => void;
}) {
  const { value, review } = getMockRating(course.id);
  const badge = getBadge(course.id);
  const hasDiscount = course.currentPrice > 0 && course.currentPrice < course.price;
  const discountPct = hasDiscount
    ? Math.round(((course.price - course.currentPrice) / course.price) * 100)
    : 0;

  return (
    <div
      className="trending-card"
      onMouseEnter={(e) => onMouseEnter(course.id, e.currentTarget)}
      onMouseLeave={onMouseLeave}
    >
      <Link to={`/course-detail/${course.cardId ?? course.id}`} className="trending-card__img-wrap">
        <img
          className="trending-card__img"
          src={getCourseImageUrl(course.path)}
          alt={course.title}
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://s.udemycdn.com/course/750x422/placeholder.jpg";
          }}
        />
        {hasDiscount && <span className="trending-card__discount">-{discountPct}%</span>}
      </Link>

      <div className="trending-card__info">
        <Link to={`/course-detail/${course.cardId ?? course.id}`} className="trending-card__title-link">
          <h3 className="trending-card__title">{course.title}</h3>
        </Link>
        <p className="trending-card__author">{course.instructorName ?? course.author}</p>
        <div className="trending-card__rating">
          <Rating value={value} totalstar={5} review={review} />
        </div>
        <div className="trending-card__price-row">
          {hasDiscount ? (
            <>
              <span className="tabs-price--now">{formatVnd(course.currentPrice)} ₫</span>
              <span className="tabs-price--was">{formatVnd(course.price)} ₫</span>
            </>
          ) : (
            <span className="tabs-price--now">{formatVnd(course.price)} ₫</span>
          )}
        </div>
        {badge && (
          <div className="trending-card__tags">
            {badge === "bestseller"
              ? <span className="tabs-tag tabs-tag--premium">Bán chạy nhất</span>
              : <span className="tabs-tag tabs-tag--new">Mới</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="trending-card trending-card--skeleton">
      <div className="trending-card__img-wrap"><div className="sk-img" /></div>
      <div className="trending-card__info" style={{ flex: 1 }}>
        <div className="sk sk--title" />
        <div className="sk sk--title" style={{ width: "70%" }} />
        <div className="sk sk--author" />
        <div className="sk sk--rating" />
        <div className="sk sk--price" />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
function CourseCardSlider({ title, subtitle, category, limit = 10, viewAllLink }: CourseCardSliderProps) {
  const toast = useToast();
  const [courses, setCourses]     = useState<Course[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Chỉ fetch đúng số lượng cần thiết, không load toàn bộ
    const qp = new URLSearchParams();
    qp.set("page",  "1");
    qp.set("limit", String(limit));
    if (category) qp.set("category", category);

    axiosInstance
      .get(`/courseCreation/all-courses?${qp.toString()}`)
      .then((res) => setCourses(res.data.courses ?? []))
      .catch(() => setError("Không thể tải khóa học."))
      .finally(() => setLoading(false));
  }, [category, limit]);

  const handleMouseEnter = (id: string, el: HTMLDivElement) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setAnchorRect(el.getBoundingClientRect());
      setHoveredId(id);
    }, 280);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setHoveredId(null);
      setAnchorRect(null);
    }, 180);
  };

  const handleAddToCart = async (course: Course) => {
    const userId = localStorage.getItem("userId");
    if (!userId) return;
    try {
      await axiosInstance.post("/courseCreation/add-cart", {
        user_id: userId,
        course_id: course.id,
      });
      toast.success(`Đã thêm "${course.title}" vào giỏ hàng!`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Thêm vào giỏ thất bại";
      toast.error(msg);
    }
  };

  const hoveredCourse = courses.find((c) => c.id === hoveredId) ?? null;

  // Tính link "Xem tất cả"
  //   false            → ẩn nút
  //   string           → dùng path đó
  //   undefined        → tự tính từ category → /courses?category=...
  const resolvedLink: string | false =
    viewAllLink === false
      ? false
      : typeof viewAllLink === "string"
        ? viewAllLink
        : buildViewAllLink(category);

  return (
    <section className="Tabs-box">
      <div className="Tabs-container">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        {error && <p className="tabs-error">{error}</p>}

        <div className="Tabs-content">
          {loading ? (
            <div className="trending-row">
              {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : courses.length === 0 ? (
            <p style={{ color: "#475569", fontSize: "0.9rem" }}>
              Chưa có khóa học nào{category ? ` trong "${category}"` : ""}.
            </p>
          ) : (
            <Swiper
              spaceBetween={14}
              slidesPerView={5}
              navigation
              modules={[Navigation]}
              className="course-card-swiper"
              breakpoints={{
                320: { slidesPerView: 1.2 },
                480: { slidesPerView: 2.1 },
                768: { slidesPerView: 3.1 },
                1024: { slidesPerView: 4.1 },
                1280: { slidesPerView: 5 },
              }}
            >
              {courses.map((course) => (
                <SwiperSlide key={course.id}>
                  <CourseCard
                    course={course}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  />
                </SwiperSlide>
              ))}
            </Swiper>
          )}
        </div>

        {/* Nút Xem tất cả → /courses?category=... */}
        {resolvedLink !== false && !loading && courses.length > 0 && (
          <Link to={resolvedLink} className="All-Data-science-course">
            Xem tất cả {category ? `"${category}"` : ""} →
          </Link>
        )}
      </div>

      {hoveredCourse && anchorRect && (
        <div
          onMouseEnter={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }}
          onMouseLeave={handleMouseLeave}
        >
          <CoursePopup
            course={hoveredCourse}
            anchorRect={anchorRect}
            onAddToCart={handleAddToCart}
          />
        </div>
      )}
    </section>
  );
}

export default CourseCardSlider;