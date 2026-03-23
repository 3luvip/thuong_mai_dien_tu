import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import axiosInstance from "../../lib/axios";
import { formatVnd } from "../../utils/currency";
import { getCourseImageUrl } from "../../utils/courseImage";
import Rating from "../Course/Rating";
import "../../style/components/_tabs.scss";
import { ratingFromCourseListItem } from "../../utils/courseRating";

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
  avgRating?: number;
  totalReviews?: number;
}

const menuCategories: Record<string, string[]> = {
  Development: [
    "Web Development",
    "App Development",
    "Game Development",
    "Programming Language",
    "Database Design & Development",
  ],
  Business: ["Entrepreneurship", "Leadership", "Strategy"],
  FinanceAccounting: [
    "Accounting & Bookkeeping",
    "CryptoCurrency & Blockchain",
    "Finance",
    "Investing & Trading",
  ],
  Software: [
    "IT Certification",
    "Network & Security",
    "Hardware",
    "Operating Systems & Server",
    "Other IT & Services",
  ],
  Productivity: ["Microsoft", "Apple", "Linux", "Google", "Samsung"],
  PersonalDevelopment: [
    "Personal Transformation",
    "Personal Productivity",
    "Career Development",
    "Parenting & Relationship",
  ],
  Design: ["UX Design", "Graphic Design", "Interior Design"],
  Marketing: ["Digital Marketing", "SEO", "Content Marketing"],
  Health: ["Fitness", "Mental Health", "Nutrition"],
  Music: ["Instruments", "Music Production", "Vocal"],
};

const normalize = (v: string) =>
  v
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");

const matchesCategory = (label: string, courseCategory: string) => {
  const l = normalize(label);
  const c = normalize(courseCategory);
  return c === l || c.includes(l) || l.includes(c);
};

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function CoursesPage() {
  const query = useQuery();
  const initialCategory = query.get("category") ?? "";

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState(initialCategory);
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    setLoading(true);
    setError(null);
    axiosInstance
      .get("/courseCreation/all-courses")
      .then((res) => {
        setCourses(res.data.courses ?? []);
      })
      .catch(() => setError("Khong the tai danh sach khoa hoc."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (initialCategory) setCategory(initialCategory);
  }, [initialCategory]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => set.add(c.category));
    return Array.from(set).sort();
  }, [courses]);

  const filtered = useMemo(() => {
    let data = courses;
    if (category) {
      const parentSubs = menuCategories[category];
      if (parentSubs) {
        data = data.filter((c) => {
          if (matchesCategory(category, c.category)) return true;
          return parentSubs.some((sub) => matchesCategory(sub, c.category));
        });
      } else {
        data = data.filter((c) => matchesCategory(category, c.category));
      }
    }
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      data = data.filter(
        (c) =>
          c.title.toLowerCase().includes(kw) ||
          c.author.toLowerCase().includes(kw) ||
          c.courseSub.toLowerCase().includes(kw),
      );
    }
    return data;
  }, [courses, category, keyword]);

  return (
    <section className="Tabs-box">
      <div className="Tabs-container">
        <h1>Browse Courses</h1>
        <p>Explore courses by category or keyword.</p>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            margin: "16px 0 24px",
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label htmlFor="category" style={{ fontSize: 14, color: "#475569" }}>
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#fff",
              }}
            >
              <option value="">All</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search by title, author, or subtitle"
            style={{
              minWidth: 260,
              flex: "1 1 280px",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
            }}
          />
        </div>

        {error && <p className="tabs-error">{error}</p>}

        {!error && loading && (
          <div className="tabs-grid">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="tabs-card tabs-card--skeleton">
                <div className="sk-img" />
                <div className="tabs-card__body">
                  <div className="sk sk--title" />
                  <div className="sk sk--author" />
                  <div className="sk sk--rating" />
                  <div className="sk sk--price" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!error && !loading && filtered.length === 0 && (
          <p style={{ color: "#475569", fontSize: "0.95rem" }}>
            Khong tim thay khoa hoc phu hop.
          </p>
        )}

        {!error && !loading && filtered.length > 0 && (
          <div className="tabs-grid">
            {filtered.map((course) => {
              const hasDiscount =
                course.currentPrice > 0 && course.currentPrice < course.price;
              const to = course.cardId
                ? `/course-detail/${course.cardId}`
                : "#";
              const { value, review } = ratingFromCourseListItem(course);

              return (
                <div key={course.id} className="tabs-card">
                  <Link to={to} className="tabs-card__link">
                    <img
                      src={getCourseImageUrl(course.path)}
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
                      <p className="tabs-card__author">
                        {course.instructorName ?? course.author}
                      </p>
                      <div className="tabs-card__rating">
                        <Rating value={value} totalstar={5} review={review} />
                      </div>
                      <div className="tabs-card__price">
                        {hasDiscount ? (
                          <>
                            <span className="tabs-price--now">
                              {formatVnd(course.currentPrice)} VND
                            </span>
                            <span className="tabs-price--was">
                              {formatVnd(course.price)} VND
                            </span>
                          </>
                        ) : (
                          <span className="tabs-price--now">
                            {formatVnd(course.price)} VND
                          </span>
                        )}
                      </div>
                      <div className="tabs-card__tags">
                        <span className="tabs-tag tabs-tag--premium">Premium</span>
                        <span className="tabs-tag tabs-tag--new">New</span>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
