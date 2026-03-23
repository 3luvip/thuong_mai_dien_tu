import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaStar,
  FaRegStar,
  FaStarHalfAlt,
  FaPlay,
  FaLock,
  FaChevronDown,
  FaChevronUp,
  FaGlobe,
  FaInfinity,
  FaMobileAlt,
  FaTrophy,
  FaCheck,
  FaShoppingCart,
  FaHeart,
  FaRegHeart,
  FaClock,
  FaLayerGroup,
  FaBookOpen,
  FaTimes,
} from "react-icons/fa";
import { MdOutlineOndemandVideo, MdOutlineArticle } from "react-icons/md";
import axiosInstance from "../../lib/axios";
import { getCourseImageUrl } from "../../utils/courseImage";
import { formatVnd } from "../../utils/currency";
import { useCart } from "../../context/useCart";
import { useWishlist } from "../../context/wishlistContext";
import { useToast } from "../../context/toast";
import "../../style/components/_course_detail.scss";
import { session } from "../../lib/storage";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lecture {
  id: string;
  title: string;
  position: number;
  durationSec: number;
  isPreview: boolean;
  videoUrl?: string | null;
}

interface Section {
  id: string;
  title: string;
  position: number;
  totalDurationSec: number;
  lectureCount: number;
  lectures: Lecture[];
}

interface ReviewItem {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface RatingDist {
  star: number;
  count: number;
  percent: number;
}

interface CourseDetail {
  courseCardId: string;
  courseId: string;
  price: number;
  currentPrice: number;
  course: {
    id: string;
    title: string;
    courseSub: string;
    description: string;
    language: string;
    level: string;
    category: string;
    filename: string;
    totalStudents: number;
    totalDurationSec: number;
    totalLectures: number;
    totalSections: number;
  };
  instructor: {
    id: string;
    name: string;
    email: string;
    bio: string;
  };
  learnings: string[];
  tags: string[];
  curriculum: Section[];
  reviews: {
    avgRating: number;
    totalReviews: number;
    distribution: RatingDist[];
    recent: ReviewItem[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SERVER_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

function getVideoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${SERVER_BASE}${url}`;
}

function formatDuration(sec: number): string {
  if (!sec || sec <= 0) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDurationLabel(sec: number): string {
  if (!sec || sec <= 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0 && m > 0) return `${h} hour ${m} minute`;
  if (h > 0) return `${h} hour`;
  if (m > 0) return `${m} minute`;
  return `${sec} seconds`;
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="cd-stars" style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((s) => {
        if (rating >= s) return <FaStar key={s} className="star-full" />;
        if (rating >= s - 0.5)
          return <FaStarHalfAlt key={s} className="star-half" />;
        return <FaRegStar key={s} className="star-empty" />;
      })}
    </span>
  );
}

// ─── Course Description ───────────────────────────────────────────────────────
// Parse text thành paragraphs/bullets, hỗ trợ "Read more"

function CourseDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const COLLAPSE_LIMIT = 4; // số đoạn hiển thị khi thu gọn

  // Parse: tách theo dòng trống hoặc dấu xuống dòng
  // Mỗi dòng bắt đầu bằng - / • / * / số. được coi là bullet
  const rawLines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);

  interface Block {
    type: "paragraph" | "bullet" | "heading";
    content: string;
  }

  const blocks: Block[] = rawLines.map(line => {
    if (/^[-•*]\s+/.test(line))         return { type: "bullet",    content: line.replace(/^[-•*]\s+/, "") };
    if (/^\d+\.\s+/.test(line))          return { type: "bullet",    content: line.replace(/^\d+\.\s+/, "") };
    if (/^#{1,3}\s+/.test(line))         return { type: "heading",   content: line.replace(/^#{1,3}\s+/, "") };
    if (line.endsWith(":") && line.length < 80) return { type: "heading", content: line };
    return { type: "paragraph", content: line };
  });

  // Nhóm bullets liên tiếp thành list
  interface Group {
    kind: "paragraph" | "heading" | "list";
    items: string[];
  }

  const groups: Group[] = [];
  for (const b of blocks) {
    if (b.type === "bullet") {
      if (groups.length > 0 && groups[groups.length - 1].kind === "list") {
        groups[groups.length - 1].items.push(b.content);
      } else {
        groups.push({ kind: "list", items: [b.content] });
      }
    } else {
      groups.push({ kind: b.type === "heading" ? "heading" : "paragraph", items: [b.content] });
    }
  }

  const visible = expanded ? groups : groups.slice(0, COLLAPSE_LIMIT);
  const hasMore = groups.length > COLLAPSE_LIMIT;

  return (
    <div className="cd-description-rich">
      {visible.map((g, i) => {
        if (g.kind === "heading") return (
          <p key={i} style={{
            fontSize: "0.95rem", fontWeight: 700, color: "#e2e8f0",
            margin: "1.1em 0 0.3em", lineHeight: 1.4,
          }}>
            {g.items[0]}
          </p>
        );
        if (g.kind === "list") return (
          <ul key={i} style={{
            margin: "0.5em 0 0.8em", paddingLeft: "1.4em",
            display: "flex", flexDirection: "column", gap: "0.35em",
          }}>
            {g.items.map((item, j) => (
              <li key={j} style={{
                fontSize: "0.9rem", color: "#94a3b8", lineHeight: 1.6,
                listStyleType: "disc",
              }}>
                {item}
              </li>
            ))}
          </ul>
        );
        return (
          <p key={i} style={{
            fontSize: "0.9rem", color: "#94a3b8",
            lineHeight: 1.8, margin: "0 0 0.75em",
          }}>
            {g.items[0]}
          </p>
        );
      })}

      {hasMore && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            marginTop: 8,
            background: "transparent",
            border: "1px solid rgba(99,102,241,0.35)",
            color: "#818cf8", fontSize: "0.85rem", fontWeight: 600,
            padding: "6px 14px", borderRadius: 8,
            cursor: "pointer", fontFamily: "inherit",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(99,102,241,0.1)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          {expanded ? "▲ Show less" : `▼ Show more (${groups.length - COLLAPSE_LIMIT} more sections)`}
        </button>
      )}
    </div>
  );
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({
  lecture,
  onClose,
}: {
  lecture: Lecture;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoSrc = getVideoUrl(lecture.videoUrl);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        backdropFilter: "blur(6px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 860,
          background: "#0d1527",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
          animation: "previewIn 0.25s cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                fontWeight: 700,
                color: "#6366f1",
                background: "rgba(99,102,241,0.12)",
                border: "1px solid rgba(99,102,241,0.25)",
                padding: "2px 9px",
                borderRadius: 999,
                marginBottom: 6,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              <FaPlay style={{ fontSize: 8 }} /> Free preview
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#e2e8f0",
                lineHeight: 1.35,
              }}
            >
              {lecture.title}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#94a3b8",
              width: 34,
              height: 34,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: 14,
              flexShrink: 0,
              transition: "all 0.15s",
            }}
          >
            <FaTimes />
          </button>
        </div>

        {/* Video */}
        <div
          style={{
            background: "#000",
            aspectRatio: "16/9",
            position: "relative",
          }}
        >
          {videoSrc ? (
            <video
              ref={videoRef}
              src={videoSrc}
              controls
              autoPlay
              style={{ width: "100%", height: "100%", display: "block" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                color: "#475569",
                minHeight: 300,
              }}
            >
              <MdOutlineOndemandVideo style={{ fontSize: 48 }} />
              <p style={{ margin: 0, fontSize: 14 }}>
                This lecture has no video
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes previewIn {
          from { opacity: 0; transform: scale(0.94) translateY(16px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── CourseDetailPage ─────────────────────────────────────────────────────────

export default function CourseDetailPage() {
  const { courseCardId } = useParams<{ courseCardId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { addToCart, cartItems, fetchCart } = useCart();
  const { isWishlisted, addToWishlist, removeFromWishlist } = useWishlist();

  const [data, setData] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );
  const [showAllSections, setShowAllSections] = useState(false);
  const [addingCart, setAddingCart] = useState(false);
  const [previewLecture, setPreviewLecture] = useState<Lecture | null>(null);
  const [imgError, setImgError] = useState(false);

  // ── Purchase status ──────────────────────────────────────────────────────
  const [isPurchased, setIsPurchased] = useState(false);
  const [checkingPurchase, setCheckingPurchase] = useState(false);

  const userId = session.getUserId();

  useEffect(() => {
    if (userId) void fetchCart(userId);
  }, [userId, fetchCart]);
  const isInWishlist = isWishlisted(courseCardId ?? "");

  const [myRating, setMyRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [myComment, setMyComment] = useState("");
  const [submittingRev, setSubmittingRev] = useState(false);
  const [myReviewDone, setMyReviewDone] = useState(false);

  // ── Fetch course detail ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!courseCardId) return;
    axiosInstance
      .get(`/courseCreation/course-detail-full/${courseCardId}`)
      .then((res) => setData(res.data))
      .catch(() => toast.error("Unable to load course information"))
      .finally(() => setLoading(false));
  }, [courseCardId]);

  // ── Check if purchased ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !data?.course?.id) return;
    setCheckingPurchase(true);
    axiosInstance
      .get(`/learning/my-courses/${userId}`)
      .then((res) => {
        const courses: Array<{ courseId: string }> = res.data.courses ?? [];
        setIsPurchased(courses.some((c) => c.courseId === data.course.id));
      })
      .catch(() => setIsPurchased(false))
      .finally(() => setCheckingPurchase(false));
  }, [userId, data?.course?.id]);

  // ── Open first 2 sections by default ─────────────────────────────────────────────
  useEffect(() => {
    if (data?.curriculum?.length) {
      setExpandedSections(
        new Set(data.curriculum.slice(0, 2).map((s) => s.id)),
      );
    }
  }, [data]);

  function toggleSection(id: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleAddToCart() {
    if (!userId) {
      navigate("/login");
      return;
    }
    if (!data?.course?.id) return;
    const owner = data.instructor.id === userId;
    const bought = isPurchased;
    const hasAccess = bought || owner;
    if (hasAccess) {
      toast.info(
        bought
          ? "You already purchased this course"
          : "You cannot buy your own course",
        bought
          ? "Open My courses or Start learning to continue."
          : "Manage this course from your instructor dashboard.",
      );
      return;
    }
    const inCart = cartItems.some((c) => c.id === data.course.id);
    if (inCart) {
      navigate("/cart");
      return;
    }
    setAddingCart(true);
    try {
      await addToCart(userId, data.course.id);
      toast.success("Added to cart!");
    } catch {
      toast.error("Failed to add to cart");
    } finally {
      setAddingCart(false);
    }
  }
  
  const handleSubmitReview = async () => {
    if (!userId) {
      navigate("/login");
      return;
    }
    if (!isPurchased) {
      toast.error("You need to purchase the course before leaving a review");
      return;
    }
    if (myRating === 0) {
      toast.warning("Please select a star rating");
      return;
    }
    if (!data?.course?.id) return;

    setSubmittingRev(true);
    try {
      await axiosInstance.post("/reviews", {
        course_id: data.course.id,
        user_id: userId,
        rating: myRating,
        comment: myComment.trim() || null,
      });
      toast.success(
        "Thank you for your review! ⭐",
        "Your review has been received.",
      );
      setMyReviewDone(true);
      axiosInstance
        .get(`/courseCreation/course-detail-full/${courseCardId}`)
        .then((res) => setData(res.data))
        .catch(() => {});
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error("Unable to submit review", msg ?? "Please try again.");
    } finally {
      setSubmittingRev(false);
    }
  };

  function handleWishlist() {
    if (!userId) {
      navigate("/login");
      return;
    }
    if (isInWishlist) {
      removeFromWishlist(userId, courseCardId!, data?.course?.title);
    } else {
      addToWishlist(userId, courseCardId!, data?.course?.title);
    }
  }

  function handleLectureClick(lec: Lecture) {
    if (!data) return;
    const fullAccess =
      isPurchased || (!!userId && data.instructor.id === userId);
    if (fullAccess) {
      navigate(`/learn/${data.course.id}`);
      return;
    }
    if (lec.isPreview) {
      setPreviewLecture(lec);
    }
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="cd-loading">
        <div className="cd-skeleton cd-skeleton--hero" />
        <div className="cd-skeleton cd-skeleton--body" />
      </div>
    );
  }

  if (!data) return <div className="cd-error">Course not found</div>;

  const { course, instructor, learnings, tags, curriculum, reviews } = data;
  const isOwnerInstructor = Boolean(userId && instructor.id === userId);
  const hasCourseAccess = isPurchased || isOwnerInstructor;
  const isInCart = cartItems.some((c) => c.id === course.id);
  const displaySections = showAllSections ? curriculum : curriculum.slice(0, 5);

  // Count total preview lectures
  const totalPreviewLectures = curriculum
    .flatMap((s) => s.lectures)
    .filter((l) => l.isPreview).length;

  const thumbnailUrl = imgError
    ? "https://s.udemycdn.com/course/750x422/placeholder.jpg"
    : getCourseImageUrl(course.filename);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="cd-page">
      {/* ── Preview Modal ── */}
      {previewLecture && (
        <PreviewModal
          lecture={previewLecture}
          onClose={() => setPreviewLecture(null)}
        />
      )}

      {/* ── HERO BANNER ── */}
      <div className="cd-hero">
        <div className="cd-hero__inner">
          <div className="cd-hero__breadcrumb">
            <span>{course.category}</span>
            <span className="sep">›</span>
            <span>{course.level}</span>
          </div>

          <h1 className="cd-hero__title">{course.title}</h1>
          <p className="cd-hero__sub">{course.courseSub}</p>

          <div className="cd-hero__meta">
            <span className="cd-badge cd-badge--bestseller">Bestseller</span>
            <span className="cd-rating-num">
              {reviews.avgRating.toFixed(1)}
            </span>
            <StarRating rating={reviews.avgRating} size={13} />
            <span className="cd-meta-light">
              ({reviews.totalReviews.toLocaleString()} reviews)
            </span>
            <span className="cd-meta-light">
              {course.totalStudents.toLocaleString()} students
            </span>
          </div>

          <div className="cd-hero__instructor">
            Created by <span className="cd-link">{instructor.name}</span>
          </div>

          <div className="cd-hero__attrs">
            <span>
              <FaGlobe /> {course.language}
            </span>
            <span>
              <FaLayerGroup /> {course.level}
            </span>
            <span>
              <FaClock /> {formatDurationLabel(course.totalDurationSec)} total
              duration
            </span>
            <span>
              <MdOutlineOndemandVideo /> {course.totalLectures} lectures
            </span>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="cd-body">
        <div className="cd-body__left">
          {/* WHAT YOU'LL LEARN */}
          {learnings.length > 0 && (
            <section className="cd-section cd-learnings">
              <h2 className="cd-section__title">What you'll learn</h2>
              <div className="cd-learnings__grid">
                {learnings.map((item, i) => (
                  <div key={i} className="cd-learning-item">
                    <FaCheck className="cd-check" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* CURRICULUM */}
          <section className="cd-section cd-curriculum">
            <h2 className="cd-section__title">Course content</h2>
            <div className="cd-curriculum__stats">
              <span>{course.totalSections} sections</span>
              <span>•</span>
              <span>{course.totalLectures} lectures</span>
              <span>•</span>
              <span>
                {formatDurationLabel(course.totalDurationSec)} total duration
              </span>
              {totalPreviewLectures > 0 && (
                <>
                  <span>•</span>
                  <span style={{ color: "#6366f1", fontWeight: 600 }}>
                    {totalPreviewLectures} preview lectures
                  </span>
                </>
              )}
            </div>

            <div className="cd-sections">
              {displaySections.map((sec) => {
                const isOpen = expandedSections.has(sec.id);
                const previewCount = sec.lectures.filter(
                  (l) => l.isPreview,
                ).length;

                return (
                  <div key={sec.id} className="cd-sec">
                    <button
                      className="cd-sec__header"
                      onClick={() => toggleSection(sec.id)}
                    >
                      <span className="cd-sec__icon">
                        {isOpen ? <FaChevronUp /> : <FaChevronDown />}
                      </span>
                      <span className="cd-sec__title">{sec.title}</span>
                      <span className="cd-sec__info">
                        {sec.lectureCount} lectures
                        {sec.totalDurationSec > 0 && (
                          <> • {formatDurationLabel(sec.totalDurationSec)}</>
                        )}
                        {previewCount > 0 && (
                          <span
                            style={{
                              marginLeft: 6,
                              color: "#6366f1",
                              fontSize: "0.72rem",
                              fontWeight: 600,
                            }}
                          >
                            • {previewCount} preview
                          </span>
                        )}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="cd-sec__lectures">
                        {sec.lectures.map((lec) => {
                          const canWatch = hasCourseAccess || lec.isPreview;
                          return (
                            <div
                              key={lec.id}
                              className="cd-lecture"
                              onClick={() => handleLectureClick(lec)}
                              style={{
                                cursor: canWatch ? "pointer" : "default",
                                transition: "background 0.15s",
                              }}
                              onMouseEnter={(e) => {
                                if (canWatch) {
                                  (
                                    e.currentTarget as HTMLDivElement
                                  ).style.background = "rgba(99,102,241,0.06)";
                                }
                              }}
                              onMouseLeave={(e) => {
                                (
                                  e.currentTarget as HTMLDivElement
                                ).style.background = "";
                              }}
                            >
                              {/* Icon */}
                              <span className="cd-lecture__icon">
                                {hasCourseAccess ? (
                                  <FaPlay className="icon-play" />
                                ) : lec.isPreview ? (
                                  <FaPlay className="icon-play" />
                                ) : (
                                  <FaLock className="icon-lock" />
                                )}
                              </span>

                              {/* Title */}
                              <span
                                className="cd-lecture__title"
                                style={{
                                  color: canWatch ? "#e2e8f0" : "#94a3b8",
                                }}
                              >
                                {lec.title}
                              </span>

                              {/* Right side: preview badge + duration */}
                              <span
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  marginLeft: "auto",
                                  flexShrink: 0,
                                }}
                              >
                                {lec.isPreview && !hasCourseAccess && (
                                  <span
                                    style={{
                                      fontSize: "0.68rem",
                                      fontWeight: 700,
                                      color: "#6366f1",
                                      border: "1px solid rgba(99,102,241,0.4)",
                                      padding: "1px 7px",
                                      borderRadius: 4,
                                      background: "rgba(99,102,241,0.08)",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    Preview
                                  </span>
                                )}
                                {lec.durationSec > 0 && (
                                  <span className="cd-lecture__dur">
                                    {formatDuration(lec.durationSec)}
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {curriculum.length > 5 && (
              <button
                className="cd-show-more"
                onClick={() => setShowAllSections((v) => !v)}
              >
                {showAllSections
                  ? "Show less"
                  : `Show ${curriculum.length - 5} more sections`}
                {showAllSections ? <FaChevronUp /> : <FaChevronDown />}
              </button>
            )}
          </section>

          {/* DESCRIPTION */}
          <section className="cd-section">
            <h2 className="cd-section__title">Course description</h2>
            <CourseDescription text={course.description} />
          </section>

          {/* INSTRUCTOR */}
          <section className="cd-section cd-instructor-sec">
            <h2 className="cd-section__title">Instructor</h2>
            <div className="cd-instructor-card">
              <div className="cd-instructor-card__avatar">
                {instructor.name?.charAt(0).toUpperCase()}
              </div>
              <div className="cd-instructor-card__info">
                <h3 className="cd-instructor-card__name">{instructor.name}</h3>
                <p className="cd-instructor-card__bio">{instructor.bio}</p>
                <p className="cd-instructor-card__email">{instructor.email}</p>
              </div>
            </div>
          </section>

          {/* REVIEWS */}
          <section className="cd-section cd-reviews-sec">
            <h2 className="cd-section__title">Student reviews</h2>

            <div className="cd-rating-overview">
              <div className="cd-rating-big">
                <span className="cd-rating-big__num">
                  {reviews.avgRating.toFixed(1)}
                </span>
                <StarRating rating={reviews.avgRating} size={20} />
                <span className="cd-rating-big__label">Course rating</span>
              </div>

              <div className="cd-rating-bars">
                {reviews.distribution.map((d) => (
                  <div key={d.star} className="cd-rbar">
                    <div className="cd-rbar__track">
                      <div
                        className="cd-rbar__fill"
                        style={{ width: `${d.percent}%` }}
                      />
                    </div>
                    <span className="cd-rbar__pct">
                      {Math.round(d.percent)}%
                    </span>
                    <StarRating rating={d.star} size={11} />
                  </div>
                ))}
              </div>
            </div>

            <div className="cd-reviews-list">
              {reviews.recent.map((r) => (
                <div key={r.id} className="cd-review-item">
                  <div className="cd-review-item__avatar">
                    {r.userName?.charAt(0).toUpperCase()}
                  </div>
                  <div className="cd-review-item__body">
                    <div className="cd-review-item__top">
                      <strong>{r.userName}</strong>
                      <StarRating rating={r.rating} size={12} />
                      <span className="cd-review-item__date">
                        {r.createdAt}
                      </span>
                    </div>
                    <p className="cd-review-item__comment">{r.comment}</p>
                  </div>
                </div>
              ))}

              {reviews.totalReviews === 0 && (
                <p className="cd-no-reviews">No reviews yet.</p>
              )}
              {userId && isPurchased && (
                <div className="cd-review-form">
                  <h3 className="cd-review-form__title">
                    {myReviewDone
                      ? "✅ Thank you for your review!"
                      : "Write your review"}
                  </h3>

                  {myReviewDone ? (
                    <div className="cd-review-form__done">
                      <p>
                        Your review has been received and will be shown after
                        moderation.
                      </p>
                      <button
                        className="cd-review-form__edit-btn"
                        onClick={() => setMyReviewDone(false)}
                      >
                        Edit review
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Star picker */}
                      <div className="cd-review-form__stars">
                        <p className="cd-review-form__stars-label">
                          Your rating
                        </p>
                        <div className="cd-review-form__star-row">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <button
                              key={s}
                              type="button"
                              className={`cd-review-form__star ${(hoverRating || myRating) >= s ? "cd-review-form__star--on" : ""}`}
                              onMouseEnter={() => setHoverRating(s)}
                              onMouseLeave={() => setHoverRating(0)}
                              onClick={() => setMyRating(s)}
                              aria-label={`${s} stars`}
                            >
                              <FaStar />
                            </button>
                          ))}
                          {myRating > 0 && (
                            <span className="cd-review-form__rating-label">
                              {
                                [
                                  "",
                                  "Very bad",
                                  "Bad",
                                  "Okay",
                                  "Good",
                                  "Excellent",
                                ][myRating]
                              }
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Comment */}
                      <div className="cd-review-form__comment">
                        <label className="cd-review-form__label">
                          Comment{" "}
                          <span style={{ color: "#64748b", fontWeight: 400 }}>
                            (optional)
                          </span>
                        </label>
                        <textarea
                          className="cd-review-form__textarea"
                          placeholder="Share your experience with this course..."
                          value={myComment}
                          onChange={(e) => setMyComment(e.target.value)}
                          maxLength={500}
                          rows={4}
                        />
                        <span className="cd-review-form__counter">
                          {myComment.length}/500
                        </span>
                      </div>

                      <button
                        className="cd-review-form__submit"
                        onClick={handleSubmitReview}
                        disabled={submittingRev || myRating === 0}
                      >
                        {submittingRev ? (
                          <>
                            <span className="cd-review-form__spinner" />{" "}
                            Sending...
                          </>
                        ) : (
                          "Submit review"
                        )}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* TAGS */}
          {tags.length > 0 && (
            <section className="cd-section">
              <h2 className="cd-section__title">Tags</h2>
              <div className="cd-tags">
                {tags.map((t) => (
                  <span key={t} className="cd-tag">
                    {t}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ── STICKY CARD ── */}
        <aside className="cd-card">
          <div className="cd-card__img-wrap">
            <img
              src={thumbnailUrl}
              alt={course.title}
              className="cd-card__img"
              onError={() => setImgError(true)}
            />
            {/* Show a preview-play button if there are preview lectures */}
            {totalPreviewLectures > 0 && !hasCourseAccess && (
              <button
                className="cd-card__play-btn"
                onClick={() => {
                  const firstPreview = curriculum
                    .flatMap((s) => s.lectures)
                    .find((l) => l.isPreview);
                  if (firstPreview) setPreviewLecture(firstPreview);
                }}
                title="Preview first lesson"
              >
                <FaPlay />
              </button>
            )}
            {hasCourseAccess && (
              <button
                className="cd-card__play-btn"
                onClick={() => navigate(`/learn/${course.id}`)}
                title="Continue learning"
              >
                <FaPlay />
              </button>
            )}
          </div>

          <div className="cd-card__body">
            {/* ── Purchased ── */}
            {hasCourseAccess ? (
              <>
                <div className="cd-card__purchased-badge">
                  <FaCheck />{" "}
                  {isPurchased
                    ? "You already purchased this course"
                    : "You are the instructor of this course"}
                </div>
                <button
                  className="cd-btn cd-btn--primary cd-btn--go-learn"
                  onClick={() => navigate(`/learn/${course.id}`)}
                >
                  <FaBookOpen /> Start learning now
                </button>
              </>
            ) : (
              /* ── Not purchased ── */
              <>
                <div className="cd-card__prices">
                  <span className="cd-card__price">
                    {formatVnd(data.currentPrice)} ₫
                  </span>
                  {data.price > data.currentPrice && (
                    <span className="cd-card__old-price">
                      {formatVnd(data.price)} ₫
                    </span>
                  )}
                </div>

                <button
                  className={`cd-btn cd-btn--primary ${addingCart ? "cd-btn--loading" : ""}`}
                  onClick={handleAddToCart}
                  disabled={addingCart || checkingPurchase}
                >
                  <FaShoppingCart />
                  {addingCart
                    ? "Adding..."
                    : isInCart
                      ? "View cart"
                      : "Add to cart"}
                </button>

                {/* Preview CTA if there are preview lectures */}
                {totalPreviewLectures > 0 && (
                  <button
                    className="cd-btn cd-btn--outline"
                    style={{
                      marginTop: 4,
                      color: "#6366f1",
                      borderColor: "rgba(99,102,241,0.4)",
                    }}
                    onClick={() => {
                      const firstPreview = curriculum
                        .flatMap((s) => s.lectures)
                        .find((l) => l.isPreview);
                      if (firstPreview) setPreviewLecture(firstPreview);
                    }}
                  >
                    <FaPlay style={{ fontSize: 11 }} />
                    Preview {totalPreviewLectures} lectures for free
                  </button>
                )}
              </>
            )}

            {/* Wishlist */}
            <button className="cd-btn cd-btn--outline" onClick={handleWishlist}>
              {isInWishlist ? (
                <>
                  <FaHeart className="icon-heart" /> Saved
                </>
              ) : (
                <>
                  <FaRegHeart /> Add to wishlist
                </>
              )}
            </button>

            {!hasCourseAccess && (
              <p className="cd-card__guarantee">
                30-day money-back guarantee
              </p>
            )}

            <ul className="cd-card__includes">
              <li>
                <MdOutlineOndemandVideo />
                <span>
                  {formatDurationLabel(course.totalDurationSec)} on-demand video
                </span>
              </li>
              <li>
                <MdOutlineArticle />
                <span>{course.totalLectures} lectures</span>
              </li>
              <li>
                <FaMobileAlt />
                <span>Access on mobile and TV</span>
              </li>
              <li>
                <FaInfinity />
                <span>Full lifetime access</span>
              </li>
              <li>
                <FaTrophy />
                <span>Certificate of completion</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}