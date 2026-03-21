// src/components/Wishlist/WishlistPage.tsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  IoHeartDislike,
  IoCartOutline,
  IoSearchOutline,
  IoFilterOutline,
  IoGridOutline,
  IoListOutline,
} from "react-icons/io5";
import { MdOutlineVerified } from "react-icons/md";
import { useWishlist } from "../../context/wishlistContext";
import { useCart } from "../../context/useCart";
import { getCourseImageUrl } from "../../utils/courseImage";
import { formatVnd } from "../../utils/currency";
import HeartButton from "./HeartButton";

type SortKey = "newest" | "oldest" | "price_asc" | "price_desc" | "name";
type ViewMode = "grid" | "list";

interface WishlistCourse {
  id: string;
  title: string;
  author: string;
  price: number;
  currentPrice: number | null;
  level: string;
  category: string;
  path: string;
  addedAt: string;
}

export default function WishlistPage() {
  const navigate = useNavigate();
  const { items, total, loading, fetchWishlist, removeFromWishlist } =
    useWishlist();
  const { addToCart, cartItems } = useCart();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useState<ViewMode>("grid");
  const [category, setCategory] = useState("all");

  const userId = localStorage.getItem("userId");

  useEffect(() => {
    if (!userId) {
      navigate("/login");
      return;
    }
    fetchWishlist(userId);
  }, [userId]);

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const categories = [
    "all",
    ...Array.from(new Set(items.map((c) => c.category))),
  ];

  const filtered = items
    .filter((c) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.author.toLowerCase().includes(q);
      const matchCat = category === "all" || c.category === category;
      return matchSearch && matchCat;
    })
    .sort((a, b) => {
      const pa = effectivePrice(a),
        pb = effectivePrice(b);
      if (sort === "newest")
        return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
      if (sort === "oldest")
        return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
      if (sort === "price_asc") return pa - pb;
      if (sort === "price_desc") return pb - pa;
      if (sort === "name") return a.title.localeCompare(b.title, "vi");
      return 0;
    });

  function effectivePrice(c: WishlistCourse) {
    return c.currentPrice != null &&
      c.currentPrice > 0 &&
      c.currentPrice < c.price
      ? c.currentPrice
      : c.price;
  }

  const handleMoveToCart = async (course: WishlistCourse) => {
    if (!userId) return;
    await addToCart(userId, course.id);
  };

  const handleRemove = async (course: WishlistCourse) => {
    if (!userId) return;
    await removeFromWishlist(userId, course.id, course.title);
  };

  const inCart = (id: string) => cartItems.some((c) => c.id === id);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* ── Header ── */}
        <div style={S.header}>
          <div>
            <h1 style={S.title}>Wishlist</h1>
            <p style={S.subtitle}>
              {total > 0 ? (
                <>
                  <strong style={{ color: "#f43f5e" }}>{total}</strong> saved
                  courses
                </>
              ) : (
                "No saved courses yet"
              )}
            </p>
          </div>
        </div>

        {/* ── Toolbar ── */}
        {total > 0 && (
          <div style={S.toolbar}>
            {/* Search */}
            <div style={S.searchWrap}>
              <IoSearchOutline style={S.searchIcon} />
              <input
                style={S.searchInput}
                placeholder="Search courses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Category filter */}
            <select
              style={S.select}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "All categories" : c}
                </option>
              ))}
            </select>

            {/* Sort */}
            <select
              style={S.select}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="name">Name A–Z</option>
            </select>

            {/* View toggle */}
            <div style={S.viewToggle}>
              <button
                type="button"
                style={{
                  ...S.viewBtn,
                  ...(view === "grid" ? S.viewBtnActive : {}),
                }}
                onClick={() => setView("grid")}
                title="Grid"
              >
                <IoGridOutline />
              </button>
              <button
                type="button"
                style={{
                  ...S.viewBtn,
                  ...(view === "list" ? S.viewBtnActive : {}),
                }}
                onClick={() => setView("list")}
                title="List"
              >
                <IoListOutline />
              </button>
            </div>
          </div>
        )}

        {/* ── Content ── */}
        {loading ? (
          <SkeletonGrid />
        ) : total === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <div
            style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}
          >
            <IoSearchOutline style={{ fontSize: "3rem", marginBottom: 12 }} />
            <p>No matching courses found.</p>
          </div>
        ) : view === "grid" ? (
          <div style={S.grid}>
            {filtered.map((course) => (
              <CourseGridCard
                key={course.id}
                course={course}
                userId={userId!}
                inCart={inCart(course.id)}
                onMoveToCart={handleMoveToCart}
                onRemove={handleRemove}
              />
            ))}
          </div>
        ) : (
          <div style={S.list}>
            {filtered.map((course) => (
              <CourseListCard
                key={course.id}
                course={course}
                userId={userId!}
                inCart={inCart(course.id)}
                onMoveToCart={handleMoveToCart}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Grid Card ────────────────────────────────────────────────────────────────
function CourseGridCard({
  course,
  userId,
  inCart,
  onMoveToCart,
  onRemove,
}: {
  course: WishlistCourse;
  userId: string;
  inCart: boolean;
  onMoveToCart: (c: WishlistCourse) => void;
  onRemove: (c: WishlistCourse) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const price =
    course.currentPrice != null &&
    course.currentPrice > 0 &&
    course.currentPrice < course.price
      ? course.currentPrice
      : course.price;
  const hasDisc = price < course.price;
  const pct = hasDisc ? Math.round((1 - price / course.price) * 100) : 0;

  return (
    <div
      style={{ ...GS.card, ...(hovered ? GS.cardHover : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Heart remove button */}
      <div style={GS.heartWrap}>
        <HeartButton
          courseId={course.id}
          userId={userId}
          courseTitle={course.title}
          size={20}
        />
      </div>

      {/* Thumbnail */}
      <Link to={`/course-detail/${course.id}`} style={{ display: "block" }}>
        <div style={GS.imgWrap}>
          <img
            src={getCourseImageUrl(course.path)}
            alt={course.title}
            style={GS.img}
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://s.udemycdn.com/course/750x422/placeholder.jpg";
            }}
          />
          {hasDisc && <span style={GS.discBadge}>-{pct}%</span>}
        </div>
      </Link>

      {/* Body */}
      <div style={GS.body}>
        <Link
          to={`/course-detail/${course.id}`}
          style={{ textDecoration: "none" }}
        >
          <h3 style={{ ...GS.title, ...(hovered ? { color: "#818cf8" } : {}) }}>
            {course.title}
          </h3>
        </Link>
        <p style={GS.author}>{course.author}</p>

        <div style={GS.meta}>
          <span style={GS.level}>{course.level}</span>
          <span style={GS.category}>{course.category}</span>
        </div>

        <div style={GS.priceRow}>
          <span style={GS.priceNow}>{formatVnd(price)} ₫</span>
          {hasDisc && (
            <span style={GS.priceWas}>{formatVnd(course.price)} ₫</span>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div style={GS.footer}>
        <button
          type="button"
          style={{ ...GS.btn, ...(inCart ? GS.btnInCart : GS.btnCart) }}
          onClick={() => onMoveToCart(course)}
          disabled={inCart}
        >
          <IoCartOutline />
          {inCart ? "In cart" : "Add to cart"}
        </button>
        <button
          type="button"
          style={GS.btnRemove}
          onClick={() => onRemove(course)}
          title="Remove from wishlist"
        >
          <IoHeartDislike />
        </button>
      </div>
    </div>
  );
}

// ─── List Card ────────────────────────────────────────────────────────────────
function CourseListCard({
  course,
  userId,
  inCart,
  onMoveToCart,
  onRemove,
}: {
  course: WishlistCourse;
  userId: string;
  inCart: boolean;
  onMoveToCart: (c: WishlistCourse) => void;
  onRemove: (c: WishlistCourse) => void;
}) {
  const price =
    course.currentPrice != null &&
    course.currentPrice > 0 &&
    course.currentPrice < course.price
      ? course.currentPrice
      : course.price;
  const hasDisc = price < course.price;
  const pct = hasDisc ? Math.round((1 - price / course.price) * 100) : 0;

  return (
    <div style={LS.card}>
      <Link to={`/course-detail/${course.id}`}>
        <div style={LS.imgWrap}>
          <img
            src={getCourseImageUrl(course.path)}
            alt={course.title}
            style={LS.img}
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://s.udemycdn.com/course/750x422/placeholder.jpg";
            }}
          />
        </div>
      </Link>

      <div style={LS.body}>
        <Link
          to={`/course-detail/${course.id}`}
          style={{ textDecoration: "none" }}
        >
          <h3 style={LS.title}>{course.title}</h3>
        </Link>
        <p style={LS.author}>{course.author}</p>
        <div style={LS.tags}>
          <span style={LS.tag}>{course.level}</span>
          <span style={LS.tag}>{course.category}</span>
        </div>
      </div>

      <div style={LS.right}>
        <div style={LS.priceCol}>
          <span style={LS.priceNow}>{formatVnd(price)} ₫</span>
          {hasDisc && (
            <>
              <span style={LS.priceWas}>{formatVnd(course.price)} ₫</span>
              <span style={LS.discBadge}>-{pct}%</span>
            </>
          )}
        </div>
        <div style={LS.actions}>
          <button
            type="button"
            style={{ ...LS.btnCart, ...(inCart ? LS.btnInCart : {}) }}
            onClick={() => onMoveToCart(course)}
            disabled={inCart}
          >
            <IoCartOutline /> {inCart ? "In cart" : "Add to cart"}
          </button>
          <HeartButton
            courseId={course.id}
            userId={userId}
            courseTitle={course.title}
            size={18}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonGrid() {
  return (
    <div style={S.grid}>
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{ ...GS.card, cursor: "default" }}>
          <div
            style={{
              width: "100%",
              aspectRatio: "16/9",
              background: "#1e293b",
              borderRadius: 10,
              animation: `sk-pulse 1.4s ease ${i * 0.1}s infinite`,
            }}
          />
          <div style={GS.body}>
            {[
              [80, 0],
              [60, 0.1],
              [40, 0.2],
              [50, 0.15],
            ].map(([w, d], j) => (
              <div
                key={j}
                style={{
                  height: j === 0 ? 16 : 12,
                  width: `${w}%`,
                  borderRadius: 6,
                  background: "#1e293b",
                  marginBottom: 8,
                  animation: `sk-pulse 1.4s ease ${d}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      ))}
      <style>{`@keyframes sk-pulse{0%,100%{opacity:.3}50%{opacity:.7}}`}</style>
    </div>
  );
}

// ─── Empty ─────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "100px 20px",
        gap: 16,
      }}
    >
      <div style={{ fontSize: "4rem" }}>💔</div>
      <h2
        style={{
          fontSize: "20px",
          fontWeight: 700,
          color: "#e2e8f0",
          margin: 0,
        }}
      >
        No saved courses
      </h2>
      <p
        style={{
          fontSize: "14px",
          color: "#64748b",
          margin: 0,
          textAlign: "center",
        }}
      >
        Click the ❤️ icon on any course to save it here.
      </p>
      <Link
        to="/"
        style={{
          marginTop: 8,
          padding: "10px 24px",
          borderRadius: 10,
          background: "#6366f1",
          color: "#fff",
          fontSize: "14px",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Explore courses
      </Link>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#020617", paddingBottom: 60 },
  container: { maxWidth: "1200px", margin: "0 auto", padding: "36px 24px 0" },
  header: { marginBottom: 28 },
  title: {
    fontSize: 26,
    fontWeight: 800,
    color: "#f1f5f9",
    margin: "0 0 4px",
    letterSpacing: "-0.4px",
  },
  subtitle: { fontSize: 14, color: "#64748b", margin: 0 },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 28,
    flexWrap: "wrap",
  },
  searchWrap: {
    position: "relative",
    flex: "1 1 220px",
    minWidth: 180,
  },
  searchIcon: {
    position: "absolute",
    left: 12,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#475569",
    fontSize: 16,
    pointerEvents: "none",
  },
  searchInput: {
    width: "100%",
    boxSizing: "border-box",
    paddingLeft: 38,
    paddingRight: 12,
    paddingTop: 9,
    paddingBottom: 9,
    background: "#0f172a",
    border: "1px solid rgba(148,163,184,0.12)",
    borderRadius: 10,
    color: "#e2e8f0",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
  },
  select: {
    padding: "9px 12px",
    background: "#0f172a",
    border: "1px solid rgba(148,163,184,0.12)",
    borderRadius: 10,
    color: "#e2e8f0",
    fontSize: 13,
    fontFamily: "inherit",
    cursor: "pointer",
    outline: "none",
  },
  viewToggle: { display: "flex", gap: 4 },
  viewBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "1px solid rgba(148,163,184,0.12)",
    color: "#64748b",
    fontSize: 16,
    cursor: "pointer",
  },
  viewBtnActive: {
    background: "rgba(99,102,241,0.15)",
    border: "1px solid rgba(99,102,241,0.3)",
    color: "#818cf8",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: 20,
  },
  list: { display: "flex", flexDirection: "column", gap: 12 },
};

const GS: Record<string, React.CSSProperties> = {
  card: {
    position: "relative",
    background: "#0b1120",
    border: "1px solid rgba(148,163,184,0.08)",
    borderRadius: 14,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    transition: "all 0.18s ease",
    cursor: "pointer",
  },
  cardHover: {
    border: "1px solid rgba(99,102,241,0.3)",
    transform: "translateY(-2px)",
    boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
  },
  heartWrap: { position: "absolute", top: 10, right: 10, zIndex: 2 },
  imgWrap: { position: "relative", aspectRatio: "16/9", overflow: "hidden" },
  img: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    transition: "transform 0.3s ease",
  },
  discBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    background: "#ef4444",
    color: "#fff",
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 7px",
    borderRadius: 6,
  },
  body: { flex: 1, padding: "14px 14px 10px" },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: "#e2e8f0",
    margin: "0 0 5px",
    lineHeight: 1.4,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    transition: "color 0.15s ease",
  },
  author: { fontSize: 12, color: "#64748b", margin: "0 0 8px" },
  meta: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 },
  level: {
    fontSize: 11,
    background: "rgba(99,102,241,0.1)",
    color: "#818cf8",
    padding: "2px 8px",
    borderRadius: 20,
    fontWeight: 500,
  },
  category: {
    fontSize: 11,
    background: "rgba(148,163,184,0.08)",
    color: "#94a3b8",
    padding: "2px 8px",
    borderRadius: 20,
    fontWeight: 500,
  },
  priceRow: { display: "flex", alignItems: "baseline", gap: 6 },
  priceNow: { fontSize: 15, fontWeight: 700, color: "#f1f5f9" },
  priceWas: { fontSize: 12, color: "#475569", textDecoration: "line-through" },
  footer: { padding: "0 14px 14px", display: "flex", gap: 8 },
  btn: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "8px 0",
    borderRadius: 9,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    fontFamily: "inherit",
    transition: "all 0.18s ease",
  },
  btnCart: { background: "#6366f1", color: "#fff" },
  btnInCart: {
    background: "rgba(99,102,241,0.1)",
    color: "#818cf8",
    cursor: "not-allowed",
  },
  btnRemove: {
    width: 36,
    height: 36,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: 9,
    color: "#f87171",
    fontSize: 16,
    cursor: "pointer",
  },
};

const LS: Record<string, React.CSSProperties> = {
  card: {
    display: "flex",
    gap: 16,
    alignItems: "flex-start",
    background: "#0b1120",
    border: "1px solid rgba(148,163,184,0.08)",
    borderRadius: 14,
    padding: 16,
    transition: "border-color 0.18s ease",
  },
  imgWrap: {
    flexShrink: 0,
    width: 120,
    aspectRatio: "16/9",
    borderRadius: 10,
    overflow: "hidden",
  },
  img: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  body: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 14,
    fontWeight: 600,
    color: "#e2e8f0",
    margin: "0 0 5px",
    lineHeight: 1.4,
  },
  author: { fontSize: 12, color: "#64748b", margin: "0 0 8px" },
  tags: { display: "flex", gap: 6 },
  tag: {
    fontSize: 11,
    background: "rgba(148,163,184,0.08)",
    color: "#94a3b8",
    padding: "2px 8px",
    borderRadius: 20,
  },
  right: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 10,
    minWidth: 140,
  },
  priceCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 3,
  },
  priceNow: { fontSize: 16, fontWeight: 700, color: "#f1f5f9" },
  priceWas: { fontSize: 12, color: "#475569", textDecoration: "line-through" },
  discBadge: {
    fontSize: 11,
    background: "#ef4444",
    color: "#fff",
    padding: "1px 6px",
    borderRadius: 5,
  },
  actions: { display: "flex", gap: 8, alignItems: "center" },
  btnCart: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "7px 14px",
    background: "#6366f1",
    border: "none",
    borderRadius: 9,
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  btnInCart: {
    background: "rgba(99,102,241,0.15)",
    color: "#818cf8",
    cursor: "not-allowed",
  },
};
