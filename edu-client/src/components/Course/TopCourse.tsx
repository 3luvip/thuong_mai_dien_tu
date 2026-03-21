import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { MdOutlineVerified } from "react-icons/md";
import { FiHeart } from "react-icons/fi";
import { BsCheck2 } from "react-icons/bs";
import Rating from "./Rating";
import { formatVnd } from "../../utils/currency";
import { getCourseImageUrl } from "../../utils/courseImage";
import "../../style/components/_top_course.scss";
import "../../style/components/_tabs.scss";
import axiosInstance from "../../lib/axios";
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getMockRating(id: string): { value: number; review: number } {
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
  "Practice with real-world projects",
  "Access on mobile and desktop",
];

// ─── Hover Popup ──────────────────────────────────────────────────────────────
interface PopupProps {
  course: Course;
  anchorRect: DOMRect;
  onAddToCart: (course: Course) => void;
}

function CoursePopup({ course, anchorRect, onAddToCart }: PopupProps) {
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
  const hasDiscount =
    course.currentPrice > 0 && course.currentPrice < course.price;

  return createPortal(
    <div className="tabs-popup" style={{ top, left }}>
      <div className="tabs-popup__header">
        <span className="tabs-popup__updated">
          Updated <strong>2025</strong>
        </span>
        <span className="tabs-popup__meta">
          {course.level} · {course.language} · Subtitles
        </span>
      </div>
      <h3 className="tabs-popup__title">{course.title}</h3>
      <p className="tabs-popup__sub">{course.courseSub}</p>
      <div className="tabs-popup__rating">
        <Rating value={value} totalstar={5} review={review} />
      </div>
      <ul className="tabs-popup__highlights">
        {MOCK_HIGHLIGHTS.map((h) => (
          <li key={h}>
            <BsCheck2 className="tabs-popup__check" />
            <span>{h}</span>
          </li>
        ))}
      </ul>
      <div className="tabs-popup__tags">
        <span className="tabs-popup__tag tabs-popup__tag--premium">
          <MdOutlineVerified /> Premium
        </span>
        <span className="tabs-popup__tag tabs-popup__tag--new">New</span>
      </div>
      <div className="tabs-popup__actions">
        <button
          className="tabs-popup__cart"
          type="button"
          onClick={() => onAddToCart(course)}
        >
          Add to cart
        </button>
        <button
          className="tabs-popup__wish"
          type="button"
          aria-label="Wishlist"
        >
          <FiHeart />
        </button>
      </div>
      <div className="tabs-popup__price">
        {hasDiscount ? (
          <>
            <span className="tabs-popup__price--now">
              {formatVnd(course.currentPrice)} ₫
            </span>
            <span className="tabs-popup__price--was">
              {formatVnd(course.price)} ₫
            </span>
          </>
        ) : (
          <span className="tabs-popup__price--now">
            {formatVnd(course.price)} ₫
          </span>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─── Single Trending Card (horizontal row item) ───────────────────────────────
interface TrendingCardProps {
  course: Course;
  rank: number;
  onMouseEnter: (id: string, el: HTMLDivElement) => void;
  onMouseLeave: () => void;
}

function TrendingCard({
  course,
  rank,
  onMouseEnter,
  onMouseLeave,
}: TrendingCardProps) {
  const { value, review } = getMockRating(course.id);
  const badge = getBadge(course.id);
  const hasDiscount =
    course.currentPrice > 0 && course.currentPrice < course.price;
  const discountPct = hasDiscount
    ? Math.round(((course.price - course.currentPrice) / course.price) * 100)
    : 0;

  return (
    <div
      className="trending-card"
      onMouseEnter={(e) => onMouseEnter(course.id, e.currentTarget)}
      onMouseLeave={onMouseLeave}
    >
      {/* Rank number */}
      <div className="trending-card__rank">{rank}</div>

      {/* Thumbnail */}
      <Link
        to={`/course-detail/${course.cardId ?? course.id}`}
        className="trending-card__img-wrap"
      >
        <img
          className="trending-card__img"
          src={getCourseImageUrl(course.path)}
          alt={course.title}
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://s.udemycdn.com/course/750x422/placeholder.jpg";
          }}
        />
        {hasDiscount && (
          <span className="trending-card__discount">-{discountPct}%</span>
        )}
      </Link>

      {/* Info */}
      <div className="trending-card__info">
        <Link
          to={`/course-detail/${course.cardId ?? course.id}`}
          className="trending-card__title-link"
        >
          <h3 className="trending-card__title">{course.title}</h3>
        </Link>
        <p className="trending-card__author">
          {course.instructorName ?? course.author}
        </p>

        {/* Rating */}
        <div className="trending-card__rating">
          <Rating value={value} totalstar={5} review={review} />
        </div>

        {/* Price */}
        <div className="trending-card__price-row">
          {hasDiscount ? (
            <>
              <span className="tabs-price--now">
                {formatVnd(course.currentPrice)} ₫
              </span>
              <span className="tabs-price--was">
                {formatVnd(course.price)} ₫
              </span>
            </>
          ) : (
            <span className="tabs-price--now">{formatVnd(course.price)} ₫</span>
          )}
        </div>

        {/* Tags */}
        {badge && (
          <div className="trending-card__tags">
            {badge === "bestseller" ? (
              <span className="tabs-tag tabs-tag--premium">Best sellers</span>
            ) : (
              <span className="tabs-tag tabs-tag--new">New</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function TrendingCardSkeleton() {
  return (
    <div className="trending-card trending-card--skeleton">
      <div className="trending-card__rank" style={{ opacity: 0.2 }}>
        –
      </div>
      <div className="trending-card__img-wrap">
        <div className="sk-img" />
      </div>
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

// ─── Main TrendingCourse component ───────────────────────────────────────────
function TrendingCourse() {
  const toast = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    axiosInstance
      .get("/courseCreation/all-courses")
      .then((res) => setCourses(res.data.courses || []))
      .catch(() => setError("Unable to load courses. Please try again."))
      .finally(() => setLoading(false));
  }, []);

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

  const handleAddToCart = (course: Course) => {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      toast.warning(
        "Please log in",
        "You need to log in to add this to your cart.",
      );
      return;
    }
    
    const courseId = course.cardId ?? course.id;
    axiosInstance
      .post("/courseCreation/add-cart", {
        user_id: userId,
        course_id: courseId,
      })
      .then(() => alert(`Added "${course.title}" to cart!`))
      .catch(console.error);
  };

  const topCourses = courses.slice(0, 5);
  const hoveredCourse = courses.find((c) => c.id === hoveredId) ?? null;

  return (
    <section className="Tabs-box">
      <div className="Tabs-container">
        {/* Header */}
        <h1>Top Trending</h1>
        <p>
          Discover the most popular courses chosen by thousands of learners to
          improve their skills and knowledge.
        </p>

        {error && <p className="tabs-error">{error}</p>}

        <div className="Tabs-content">
          <div className="trending-row">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TrendingCardSkeleton key={i} />
                ))
              : topCourses.map((course, i) => (
                  <TrendingCard
                    key={course.id}
                    course={course}
                    rank={i + 1}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  />
                ))}
          </div>
        </div>

        {!loading && courses.length > 5 && (
          <Link to="/courses" className="All-Data-science-course">
            View all courses →
          </Link>
        )}
      </div>

      {hoveredCourse && anchorRect && (
        <div
          onMouseEnter={() => {
            if (hoverTimer.current) clearTimeout(hoverTimer.current);
          }}
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

export default TrendingCourse;
