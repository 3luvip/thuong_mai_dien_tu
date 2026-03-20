// src/components/Course/CourseCategoryPage.tsx
// Server-side pagination + hover popup giống CourseCardSlider

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  FiChevronDown, FiChevronUp, FiX, FiStar, FiClock,
  FiChevronLeft, FiChevronRight,
} from "react-icons/fi";
import { BsCheck2 } from "react-icons/bs";
import { MdOutlineVerified } from "react-icons/md";
import axiosInstance from "../../lib/axios";
import { getCourseImageUrl } from "../../utils/courseImage";
import { formatVnd } from "../../utils/currency";
import { useToast } from "../../context/toast";
import Rating from "./Rating";
import HeartButton from "../Wishlist/HeartButton";

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

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type SortKey = "popular" | "newest" | "price_asc" | "price_desc" | "rating";

const LEVELS    = ["Beginner Level", "Intermediate Level", "Expert", "All Level"];
const RATINGS   = [4.5, 4.0, 3.5, 3.0];
const PAGE_SIZE = 18;

const MOCK_HIGHLIGHTS = [
  "Lifetime access · Certificate of completion",
  "Thực hành với dự án thực tế",
  "Access on mobile and desktop",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMockRating(id: string) {
  const h = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return {
    value:  +(3.5 + (h % 15) / 10).toFixed(1),
    review: 800  + (h % 9)  * 200 + (h % 37) * 10,
    hours:  5    + (h % 30),
  };
}

function StarRow({ value, size = 11 }: { value: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <FiStar key={s} size={size} style={{
          fill:  s <= Math.round(value) ? "#f59e0b" : "none",
          color: s <= Math.round(value) ? "#f59e0b" : "#4b5563",
          flexShrink: 0,
        }} />
      ))}
    </span>
  );
}

// ─── Hover Popup ──────────────────────────────────────────────────────────────

function CoursePopup({
  course, anchorRect, onAddToCart,
}: {
  course: Course;
  anchorRect: DOMRect;
  onAddToCart: (c: Course) => void;
}) {
  const POPUP_W = 320;
  const GAP     = 8;
  const userId  = localStorage.getItem("userId");
  const { value, review } = getMockRating(course.id);
  const hasDiscount = course.currentPrice > 0 && course.currentPrice < course.price;

  // anchorRect là rect của thumbnail → popup hiện sát bên phải ảnh
  const spaceRight = window.innerWidth - anchorRect.right;
  const left = spaceRight >= POPUP_W + GAP
    ? anchorRect.right + GAP                    // còn chỗ bên phải → hiện phải
    : anchorRect.left - POPUP_W - GAP;          // hết chỗ → hiện bên trái

  // Căn top theo giữa ảnh để popup trông tự nhiên
  const imgMidY  = anchorRect.top + anchorRect.height / 2 + window.scrollY;
  const POPUP_H  = 460;
  const top = Math.min(
    Math.max(imgMidY - POPUP_H / 2, 8),
    window.scrollY + window.innerHeight - POPUP_H - 8,
  );

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
        <button className="tabs-popup__cart" type="button" onClick={() => onAddToCart(course)}>
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CourseCategoryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast    = useToast();

  const urlParams     = new URLSearchParams(location.search);
  const categoryParam = urlParams.get("category") ?? "";
  const keywordParam  = urlParams.get("keyword")  ?? "";

  const [courses,    setCourses]    = useState<Course[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading,    setLoading]    = useState(true);
  const [page,       setPage]       = useState(1);
  const [sort,       setSort]       = useState<SortKey>("popular");
  const [keyword,    setKeyword]    = useState(keywordParam);
  const [debouncedKeyword, setDebouncedKeyword] = useState(keywordParam);
  const [filterLevels, setFilterLevels] = useState<string[]>([]);
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [open, setOpen] = useState({ rating: true, level: true });

  // Popup
  const [hoveredId,  setHoveredId]  = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const hoverTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset khi URL thay đổi
  useEffect(() => {
    setPage(1);
    setFilterLevels([]);
    setFilterRating(null);
    setKeyword(keywordParam);
    setDebouncedKeyword(keywordParam);
    setSort("popular");
  }, [categoryParam, keywordParam]);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedKeyword(keyword);
      setPage(1);
    }, 400);
  }, [keyword]);

  // Fetch
  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      qp.set("page",  String(page));
      qp.set("limit", String(PAGE_SIZE));
      if (categoryParam)           qp.set("category", categoryParam);
      if (debouncedKeyword)        qp.set("keyword",  debouncedKeyword);
      if (filterLevels.length === 1) qp.set("level",  filterLevels[0]);

      const res = await axiosInstance.get(`/courseCreation/all-courses?${qp.toString()}`);
      let data: Course[] = res.data.courses ?? [];

      if (sort === "price_asc")  data = [...data].sort((a, b) => (a.currentPrice || a.price) - (b.currentPrice || b.price));
      if (sort === "price_desc") data = [...data].sort((a, b) => (b.currentPrice || b.price) - (a.currentPrice || a.price));
      if (sort === "rating")     data = [...data].sort((a, b) => getMockRating(b.id).value - getMockRating(a.id).value);
      if (filterRating !== null) data = data.filter((c) => getMockRating(c.id).value >= filterRating!);
      if (filterLevels.length > 1) data = data.filter((c) => filterLevels.includes(c.level));

      setCourses(data);
      setPagination(res.data.pagination ?? { page, limit: PAGE_SIZE, total: data.length, totalPages: 1 });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, categoryParam, debouncedKeyword, sort, filterLevels, filterRating]);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  // Popup handlers
  const handleMouseEnter = (id: string, el: HTMLDivElement) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setAnchorRect(el.getBoundingClientRect());
      setHoveredId(id);
    }, 260);
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
    if (!userId) { navigate("/login"); return; }
    try {
      await axiosInstance.post("/courseCreation/add-cart", {
        user_id:   userId,
        course_id: course.cardId ?? course.id,
      });
      toast.success("Đã thêm vào giỏ hàng!", course.title);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error("Thêm thất bại", msg ?? "Vui lòng thử lại.");
    }
  };

  const toggleLevel  = (lv: string) => { setPage(1); setFilterLevels((prev) => prev.includes(lv) ? prev.filter((l) => l !== lv) : [...prev, lv]); };
  const toggleOpen   = (k: keyof typeof open) => setOpen((prev) => ({ ...prev, [k]: !prev[k] }));
  const clearFilters = () => { setFilterLevels([]); setFilterRating(null); setPage(1); };
  const hasFilters   = filterLevels.length > 0 || filterRating !== null;
  const goPage       = (p: number) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const hoveredCourse = courses.find((c) => c.id === hoveredId) ?? null;

  return (
    <div style={pg.page}>

      {/* Hero */}
      <div style={pg.hero}>
        <div style={pg.inner}>
          <nav style={pg.breadcrumb}>
            <span style={pg.bcBtn} onClick={() => navigate("/")}>Trang chủ</span>
            <span style={pg.bcSep}>›</span>
            <span style={pg.bcBtn} onClick={() => navigate("/courses")}>Khóa học</span>
            {categoryParam && (<><span style={pg.bcSep}>›</span><span style={pg.bcCur}>{categoryParam}</span></>)}
            {!categoryParam && keywordParam && (<><span style={pg.bcSep}>›</span><span style={pg.bcCur}>"{keywordParam}"</span></>)}
          </nav>
          <h1 style={pg.heroTitle}>
            {categoryParam ? `Khóa học ${categoryParam}` : keywordParam ? `Kết quả cho "${keywordParam}"` : "Tất cả khóa học"}
          </h1>
          <p style={pg.heroSub}>
            <strong style={{ color: "#e5e7eb" }}>{pagination.total.toLocaleString("vi-VN")}</strong>{" "}khóa học
            {categoryParam && ` trong "${categoryParam}"`}
            {!categoryParam && keywordParam && ` khớp với "${keywordParam}"`}
          </p>
          <div style={pg.searchBar}>
            <input style={pg.searchInput} placeholder="Tìm kiếm khóa học..."
              value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            {keyword && (
              <button style={pg.searchClear} onClick={() => { setKeyword(""); setDebouncedKeyword(""); }}>
                <FiX size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={pg.main}>
        <div style={pg.inner}>
          <div style={pg.layout}>

            {/* Sidebar */}
            <aside style={pg.sidebar}>
              <div style={pg.sbHead}>
                <span style={pg.sbTitle}>Bộ lọc</span>
                {hasFilters && (
                  <button type="button" style={pg.clearBtn} onClick={clearFilters}>
                    <FiX size={11} /> Xóa tất cả
                  </button>
                )}
              </div>
              <Accordion title="Xếp hạng" open={open.rating} onToggle={() => toggleOpen("rating")}>
                {RATINGS.map((r) => (
                  <label key={r} style={pg.row}>
                    <input type="radio" name="rating" style={pg.radio}
                      checked={filterRating === r}
                      onChange={() => setFilterRating(filterRating === r ? null : r)} />
                    <StarRow value={r} />
                    <span style={pg.rowLabel}>Từ {r} trở lên</span>
                  </label>
                ))}
              </Accordion>
              <Accordion title="Cấp độ" open={open.level} onToggle={() => toggleOpen("level")}>
                {LEVELS.map((lv) => (
                  <label key={lv} style={pg.row}>
                    <input type="checkbox" style={pg.checkbox}
                      checked={filterLevels.includes(lv)}
                      onChange={() => toggleLevel(lv)} />
                    <span style={pg.rowLabel}>{lv}</span>
                  </label>
                ))}
              </Accordion>
            </aside>

            {/* Course list */}
            <div style={pg.courseList}>
              <div style={pg.listHead}>
                <h2 style={pg.listTitle}>{categoryParam || keywordParam || "Tất cả"}</h2>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#9ca3af", fontSize: 13 }}>Sắp xếp theo</span>
                  <select style={pg.sortSel} value={sort}
                    onChange={(e) => { setSort(e.target.value as SortKey); setPage(1); }}>
                    <option value="popular">Phổ biến nhất</option>
                    <option value="newest">Mới nhất</option>
                    <option value="price_asc">Giá tăng dần</option>
                    <option value="price_desc">Giá giảm dần</option>
                    <option value="rating">Đánh giá cao nhất</option>
                  </select>
                </div>
              </div>

              {hasFilters && (
                <div style={pg.chips}>
                  {filterLevels.map((lv) => (
                    <span key={lv} style={pg.chip}>
                      {lv}
                      <button type="button" style={pg.chipX} onClick={() => toggleLevel(lv)}>×</button>
                    </span>
                  ))}
                  {filterRating && (
                    <span style={pg.chip}>
                      Từ {filterRating}★
                      <button type="button" style={pg.chipX} onClick={() => setFilterRating(null)}>×</button>
                    </span>
                  )}
                </div>
              )}

              <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 12px" }}>
                Hiển thị <strong style={{ color: "#e5e7eb" }}>{courses.length}</strong>{" "}/{" "}
                <strong style={{ color: "#e5e7eb" }}>{pagination.total.toLocaleString("vi-VN")}</strong>{" "}khóa học
                {pagination.totalPages > 1 && ` — Trang ${pagination.page}/${pagination.totalPages}`}
              </p>

              {loading
                ? [...Array(6)].map((_, i) => <SkeletonListItem key={i} />)
                : courses.length === 0
                  ? (
                    <div style={pg.empty}>
                      <span style={{ fontSize: 36 }}>🔍</span>
                      <p style={{ margin: 0, fontWeight: 600, color: "#e5e7eb" }}>Không tìm thấy khóa học</p>
                      <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Thử điều chỉnh bộ lọc hoặc từ khóa.</p>
                      <button type="button" style={pg.clearBtn2}
                        onClick={() => { clearFilters(); setKeyword(""); }}>Xóa bộ lọc</button>
                    </div>
                  )
                  : courses.map((c) => (
                    <ListItem key={c.id} course={c}
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave} />
                  ))
              }

              {!loading && pagination.totalPages > 1 && (
                <Paginator current={page} total={pagination.totalPages} onChange={goPage} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Popup portal */}
      {hoveredCourse && anchorRect && (
        <div
          onMouseEnter={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }}
          onMouseLeave={handleMouseLeave}
        >
          <CoursePopup course={hoveredCourse} anchorRect={anchorRect} onAddToCart={handleAddToCart} />
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Accordion({ title, open, onToggle, children }: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ borderTop: "1px solid #1e293b", paddingTop: 14, marginBottom: 14 }}>
      <button type="button" onClick={onToggle} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "none", border: "none", color: "#f1f5f9", cursor: "pointer",
        fontFamily: "inherit", fontSize: 13, fontWeight: 600, marginBottom: open ? 12 : 0, padding: 0,
      }}>
        {title}
        {open ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function Paginator({ current, total, onChange }: {
  current: number; total: number; onChange: (p: number) => void;
}) {
  const pages: (number | "...")[] = useMemo(() => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const arr: (number | "...")[] = [1];
    if (current > 3) arr.push("...");
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) arr.push(i);
    if (current < total - 2) arr.push("...");
    arr.push(total);
    return arr;
  }, [current, total]);

  return (
    <div style={pag.wrap}>
      <button style={{ ...pag.btn, ...(current === 1 ? pag.btnDisabled : {}) }}
        disabled={current === 1} onClick={() => onChange(current - 1)}>
        <FiChevronLeft size={14} />
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`d${i}`} style={pag.dots}>…</span>
        ) : (
          <button key={p} style={{ ...pag.btn, ...(p === current ? pag.btnActive : {}) }}
            onClick={() => onChange(p as number)}>{p}</button>
        )
      )}
      <button style={{ ...pag.btn, ...(current === total ? pag.btnDisabled : {}) }}
        disabled={current === total} onClick={() => onChange(current + 1)}>
        <FiChevronRight size={14} />
      </button>
    </div>
  );
}

function ListItem({ course, onMouseEnter, onMouseLeave }: {
  course: Course;
  onMouseEnter: (id: string, el: HTMLDivElement) => void;
  onMouseLeave: () => void;
}) {
  const { value, review, hours } = getMockRating(course.id);
  const hasDisc = course.currentPrice > 0 && course.currentPrice < course.price;
  const to      = `/course-detail/${course.cardId ?? course.id}`;
  const [hov, setHov] = useState(false);
  // ref gắn vào thumbnail — popup tính position từ đây → hiện sát bên phải ảnh
  const imgWrapRef = useRef<HTMLDivElement>(null);

  return (
    <div
      style={{
        position: "relative", display: "flex", gap: 16, alignItems: "flex-start",
        padding: "16px 0", borderBottom: "1px solid #1e293b",
        background: hov ? "rgba(255,255,255,0.025)" : "transparent",
        transition: "background .15s", cursor: "pointer",
      }}
      onMouseEnter={() => {
        setHov(true);
        if (imgWrapRef.current) onMouseEnter(course.id, imgWrapRef.current);
      }}
      onMouseLeave={() => { setHov(false); onMouseLeave(); }}
    >
      {/* Thumbnail — ref trỏ vào wrapper để popup hiện kế bên ảnh */}
      <div
        ref={imgWrapRef}
        style={{ flexShrink: 0, width: 200, aspectRatio: "16/9", borderRadius: 8, overflow: "hidden" }}
      >
        <Link to={to} onClick={(e) => e.stopPropagation()} style={{ display: "block", width: "100%", height: "100%" }}>
          <img src={getCourseImageUrl(course.path)} alt={course.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block",
              transform: hov ? "scale(1.04)" : "scale(1)", transition: "transform .3s" }}
            onError={(e) => { (e.target as HTMLImageElement).src = "https://s.udemycdn.com/course/750x422/placeholder.jpg"; }} />
        </Link>
      </div>

      {/* Info */}
      <Link to={to} onClick={(e) => e.stopPropagation()}
        style={{ flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: hov ? "#c7d2fe" : "#f1f5f9",
          margin: "0 0 4px", lineHeight: 1.4, transition: "color .15s" }}>
          {course.title}
        </h3>
        <p style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 4px", lineHeight: 1.5,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {course.courseSub}
        </p>
        <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 6px" }}>
          {course.instructorName ?? course.author}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>{value.toFixed(1)}</span>
          <StarRow value={value} />
          <span style={{ fontSize: 11, color: "#9ca3af" }}>({review.toLocaleString()})</span>
          <span style={{ color: "#334155" }}>·</span>
          <FiClock size={11} style={{ color: "#9ca3af" }} />
          <span style={{ fontSize: 11, color: "#9ca3af" }}>{hours} giờ</span>
          <span style={{ color: "#334155" }}>·</span>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>{course.level}</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
            background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.3)", color: "#fbbf24" }}>
            Bán chạy nhất
          </span>
        </div>
      </Link>

      {/* Price */}
      <div style={{ flexShrink: 0, textAlign: "right", minWidth: 110 }}>
        {hasDisc ? (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f97316" }}>{formatVnd(course.currentPrice)} ₫</div>
            <div style={{ fontSize: 12, color: "#9ca3af", textDecoration: "line-through" }}>{formatVnd(course.price)} ₫</div>
          </>
        ) : (
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f97316" }}>{formatVnd(course.price)} ₫</div>
        )}
      </div>
    </div>
  );
}


function SkeletonListItem() {
  return (
    <div style={{ display: "flex", gap: 16, padding: "16px 0", borderBottom: "1px solid #1e293b", opacity: 0.6 }}>
      <div style={{ width: 200, aspectRatio: "16/9", background: "#1e293b", borderRadius: 8, flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {(["70%", "90%", "40%", "55%"] as string[]).map((w, i) => (
          <div key={i} style={{ height: i === 0 ? 16 : 12, background: "#1e293b", borderRadius: 4, width: w }} />
        ))}
      </div>
      <div style={{ width: 110, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
        <div style={{ height: 18, background: "#1e293b", borderRadius: 4, width: "70%" }} />
        <div style={{ height: 12, background: "#1e293b", borderRadius: 4, width: "50%" }} />
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const pg: Record<string, React.CSSProperties> = {
  page:       { minHeight: "100vh", background: "#020617", color: "#e5e7eb", fontFamily: '"Inter", system-ui, sans-serif' },
  hero:       { background: "#0f172a", borderBottom: "1px solid #1e293b", padding: "28px 0 24px" },
  inner:      { maxWidth: 1200, margin: "0 auto", padding: "0 24px" },
  breadcrumb: { display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 13 },
  bcBtn:      { color: "#64748b", cursor: "pointer" },
  bcSep:      { color: "#334155" },
  bcCur:      { color: "#94a3b8" },
  heroTitle:  { fontSize: 28, fontWeight: 800, color: "#f1f5f9", margin: "0 0 6px", letterSpacing: "-0.4px" },
  heroSub:    { fontSize: 14, color: "#64748b", margin: "0 0 16px" },
  searchBar:  { position: "relative", maxWidth: 480 },
  searchInput: { width: "100%", boxSizing: "border-box", padding: "10px 36px 10px 14px", background: "#0f172a", border: "1px solid #374151", borderRadius: 10, color: "#e5e7eb", fontSize: 14, fontFamily: "inherit", outline: "none" },
  searchClear: { position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center" },
  main:       { padding: "32px 0 80px" },
  layout:     { display: "grid", gridTemplateColumns: "220px 1fr", gap: 32, alignItems: "start" },
  sidebar:    { position: "sticky" as const, top: 88 },
  sbHead:     { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  sbTitle:    { fontSize: 15, fontWeight: 700, color: "#f1f5f9" },
  clearBtn:   { display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: "#6366f1", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 500, padding: 0 },
  row:        { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 10 },
  rowLabel:   { fontSize: 13, color: "#d1d5db" },
  radio:      { accentColor: "#6366f1", width: 14, height: 14, cursor: "pointer" },
  checkbox:   { accentColor: "#6366f1", width: 14, height: 14, cursor: "pointer" },
  courseList: { minWidth: 0 },
  listHead:   { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  listTitle:  { fontSize: 18, fontWeight: 700, color: "#f1f5f9", margin: 0 },
  sortSel:    { background: "#0f172a", border: "1px solid #374151", color: "#e5e7eb", padding: "7px 12px", borderRadius: 8, fontSize: 13, fontFamily: "inherit", cursor: "pointer", outline: "none" },
  chips:      { display: "flex", flexWrap: "wrap" as const, gap: 8, marginBottom: 14 },
  chip:       { display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc", fontSize: 12, padding: "4px 10px", borderRadius: 999 },
  chipX:      { background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, fontSize: 15, lineHeight: 1 },
  empty:      { display: "flex", flexDirection: "column" as const, alignItems: "center", padding: "60px 0", gap: 12, color: "#64748b", fontSize: 14 },
  clearBtn2:  { background: "#6366f1", border: "none", color: "#fff", padding: "9px 22px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 600 },
};

const pag: Record<string, React.CSSProperties> = {
  wrap:        { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 32, flexWrap: "wrap" },
  btn:         { minWidth: 36, height: 36, padding: "0 10px", background: "#0f172a", border: "1px solid #1e293b", color: "#94a3b8", fontSize: 13, fontWeight: 500, borderRadius: 8, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s" },
  btnActive:   { background: "#6366f1", border: "1px solid #6366f1", color: "#fff" },
  btnDisabled: { opacity: 0.35, cursor: "not-allowed" },
  dots:        { color: "#334155", padding: "0 4px", fontSize: 14 },
};