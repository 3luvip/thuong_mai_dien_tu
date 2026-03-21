import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import { Link } from "react-router-dom";
import { MdOutlineVerified } from "react-icons/md";
import { BsCheck2 } from "react-icons/bs";
import { IoCartOutline } from "react-icons/io5";
import axiosInstance from "../lib/axios";
import { formatVnd } from "../utils/currency";
import Rating from "../components/Course/Rating";
import HeartButton from "../components/Wishlist/HeartButton";
import { useWishlist } from "../context/wishlistContext";
import { useCart } from "../context/useCart";
import { useToast } from "../context/toast";
import "../style/components/_tabs.scss";


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

interface CategoryGroup {
  category: string;
  courses: Course[];
}

const TAB_ORDER = [
  "Web Development",
  "BlockChain",
  "App Development",
  "IT Certifications",
  "Data Science",
  "AI",
  "Communication",
  "Certifications by Skill",
  "Leadership",
  "Business Analytics",
];

function getMockRating(id: string) {
  const h = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return {
    value: Math.min(3.5 + (h % 15) / 10, 4.9),
    review: 800 + (h % 9) * 200 + (h % 37) * 10,
  };
}

const MOCK_HIGHLIGHTS = [
  "Lifetime access",
  "Certificate of completion",
  "Hands-on projects",
  "Access on mobile and desktop",
];

// ─── Popup ────────────────────────────────────────────────────────────────────
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
  const userId = localStorage.getItem("userId");
  const { value, review } = getMockRating(course.id);
  const hasDiscount =
    course.currentPrice > 0 && course.currentPrice < course.price;

  const spaceRight = window.innerWidth - anchorRect.right;
  const left =
    spaceRight >= POPUP_WIDTH + GAP
      ? anchorRect.right + GAP
      : anchorRect.left - POPUP_WIDTH - GAP;
  const top = Math.min(
    Math.max(anchorRect.top + window.scrollY, 8),
    window.scrollY + window.innerHeight - 460,
  );

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
          <IoCartOutline style={{ marginRight: 5, verticalAlign: "middle" }} />
          Add to cart
        </button>

        <HeartButton
          courseId={course.id}
          userId={userId}
          courseTitle={course.title}
          size={18}
        />
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

// ─── Course Card ──────────────────────────────────────────────────────────────
function CourseItem({
  course,
  onMouseEnter,
  onMouseLeave,
}: {
  course: Course;
  onMouseEnter: (id: string, el: HTMLDivElement) => void;
  onMouseLeave: () => void;
}) {
  const userId = localStorage.getItem("userId");
  const [hovered, setHovered] = useState(false);
  const { value, review } = getMockRating(course.id);
  const hasDiscount =
    course.currentPrice > 0 && course.currentPrice < course.price;
  const discountPct = hasDiscount
    ? Math.round(((course.price - course.currentPrice) / course.price) * 100)
    : 0;
  const to = course.cardId ? `/course-detail/${course.cardId}` : "#";

  return (
    <div
      className="tabs-card"
      style={{ position: "relative" }}
      onMouseEnter={(e) => {
        setHovered(true);
        onMouseEnter(course.id, e.currentTarget);
      }}
      onMouseLeave={() => {
        setHovered(false);
        onMouseLeave();
      }}
    >
      {userId && (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 3,
            opacity: hovered ? 1 : 0,
            transition: "opacity 0.2s ease",
            pointerEvents: hovered ? "auto" : "none",
          }}
        >
          <HeartButton
            courseId={course.id}
            userId={userId}
            courseTitle={course.title}
            size={16}
          />
        </div>
      )}

      <Link to={to} className="tabs-card__link">
        <img
          src={course.path}
          alt={course.title}
          className="tabs-card__img"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://s.udemycdn.com/course/750x422/placeholder.jpg";
          }}
        />
        <div className="tabs-card__body">
          <h3 className="tabs-card__title">
            {course.title.length > 56
              ? `${course.title.slice(0, 53)}...`
              : course.title}
          </h3>
          <p className="tabs-card__author">{course.author}</p>
          <div className="tabs-card__rating">
            <Rating value={value} totalstar={5} review={review} />
          </div>
          <div className="tabs-card__price">
            {hasDiscount ? (
              <>
                <span className="tabs-price--now">
                  {formatVnd(course.currentPrice)} ₫
                </span>
                <span className="tabs-price--was">
                  {formatVnd(course.price)} ₫
                </span>
                {discountPct > 0 && (
                  <span className="tabs-price--off">{discountPct}% OFF</span>
                )}
              </>
            ) : (
              <span className="tabs-price--now">
                {formatVnd(course.price)} ₫
              </span>
            )}
          </div>
          <div className="tabs-card__tags">
            <span className="tabs-tag tabs-tag--premium">
              <MdOutlineVerified /> Premium
            </span>
            <span className="tabs-tag tabs-tag--new">New</span>
          </div>
        </div>
      </Link>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="tabs-card tabs-card--skeleton">
      <div className="sk-img" />
      <div className="tabs-card__body">
        <div className="sk sk--title" />
        <div className="sk sk--author" />
        <div className="sk sk--rating" />
        <div className="sk sk--price" />
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function TabComponent() {
  const MAX_COURSES = 10;
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { addToCart } = useCart();
  const { fetchWishlist } = useWishlist();
  const toast = useToast();
  const userId = localStorage.getItem("userId");

  // Fetch danh sách courses
  useEffect(() => {
    axiosInstance
      .get("/courseCreation/all-courses")
      .then((res) => {
        const courses: Course[] = res.data.courses ?? [];
        const map = new Map<string, Course[]>();
        courses.forEach((c) => {
          if (!map.has(c.category)) map.set(c.category, []);
          map.get(c.category)!.push(c);
        });
        const ordered: CategoryGroup[] = [];
        TAB_ORDER.forEach((cat) => {
          if (map.has(cat)) {
            ordered.push({ category: cat, courses: map.get(cat)! });
            map.delete(cat);
          }
        });
        map.forEach((courses, category) => ordered.push({ category, courses }));
        setGroups(ordered);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // Load wishlist ids để HeartButton hiển thị đúng trạng thái
  useEffect(() => {
    if (userId) fetchWishlist(userId);
  }, [userId, fetchWishlist]);

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
    if (!userId) {
      toast.warning(
        "Please log in",
        "You need to log in to add this to your cart.",
      );
      return;
    }
    addToCart(userId, course.id);
  };

  const allCourses = groups.flatMap((g) => g.courses);
  const hoveredCourse = allCourses.find((c) => c.id === hoveredId) ?? null;
  const activeCategory = groups[0]?.category ?? "";

  return (
    <section className="Tabs-box">
      <div className="Tabs-container">
        <h1>All the skills you need in one place</h1>
        <p>
          From critical skills to technical topics, CTUET supports your
          professional development.
        </p>

        {error && (
          <p className="tabs-error">
            Unable to load data. Please try again later.
          </p>
        )}

        {!error && (
          <div className="Tabs-content">
            <Tabs>
              <TabList className="tab-flex">
                {loading
                  ? [...Array(7)].map((_, i) => (
                      <li key={i} className="sk-tab-btn" />
                    ))
                  : groups.map(({ category }) => (
                      <Tab key={category}>{category}</Tab>
                    ))}
              </TabList>

              {loading ? (
                <div className="tabs-grid">
                  {[...Array(5)].map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : (
                groups.map(({ category, courses }) => (
                  <TabPanel key={category}>
                    <div className="tabs-grid">
                      {courses.slice(0, MAX_COURSES).map((course) => (
                        <CourseItem
                          key={course.id}
                          course={course}
                          onMouseEnter={handleMouseEnter}
                          onMouseLeave={handleMouseLeave}
                        />
                      ))}
                    </div>
                  </TabPanel>
                ))
              )}
            </Tabs>
          </div>
        )}

        <Link
          to={`/courses?category=${encodeURIComponent(activeCategory)}`}
          className="All-Data-science-course"
        >
          Show all {activeCategory} courses →
        </Link>
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

export default TabComponent;