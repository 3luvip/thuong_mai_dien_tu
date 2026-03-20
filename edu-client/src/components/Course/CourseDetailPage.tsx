import { useEffect, useState } from "react";
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
} from "react-icons/fa";
import { MdOutlineOndemandVideo, MdOutlineArticle } from "react-icons/md";
import axiosInstance from "../../lib/axios";
import { getCourseImageUrl } from "../../utils/courseImage";
import { formatVnd } from "../../utils/currency";
import { useCart } from "../../context/useCart";
import { useWishlist } from "../../context/wishlistContext";
import { useToast } from "../../context/toast";
import "../../style/components/_course_detail.scss";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lecture {
  id: string;
  title: string;
  position: number;
  durationSec: number;
  isPreview: boolean;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}g ${m}p`;
  return `${m} phút`;
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="cd-stars" style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((s) => {
        if (rating >= s) return <FaStar key={s} className="star-full" />;
        if (rating >= s - 0.5) return <FaStarHalfAlt key={s} className="star-half" />;
        return <FaRegStar key={s} className="star-empty" />;
      })}
    </span>
  );
}

// ─── CourseDetailPage ─────────────────────────────────────────────────────────

export default function CourseDetailPage() {
  const { courseCardId } = useParams<{ courseCardId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { addToCart, cartItems } = useCart();
  const { isWishlisted, addToWishlist, removeFromWishlist } = useWishlist();

  const [data, setData] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showAllSections, setShowAllSections] = useState(false);
  const [addingCart, setAddingCart] = useState(false);

  // ── Trạng thái đã mua ───────────────────────────────────────────────────────
  const [isPurchased,      setIsPurchased]      = useState(false);
  const [checkingPurchase, setCheckingPurchase] = useState(false);

  // ── Review form state ────────────────────────────────────────────────────────
  const [myRating,       setMyRating]       = useState(0);
  const [hoverRating,    setHoverRating]    = useState(0);
  const [myComment,      setMyComment]      = useState("");
  const [submittingRev,  setSubmittingRev]  = useState(false);
  const [myReviewDone,   setMyReviewDone]   = useState(false);

  const userId = localStorage.getItem("userId");
  const isInCart = cartItems.some((c) => c.id === courseCardId);
  const isInWishlist = isWishlisted(courseCardId ?? "");

  // ── Fetch course detail ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!courseCardId) return;
    axiosInstance
      .get(`/courseCreation/course-detail-full/${courseCardId}`)
      .then((res) => setData(res.data))
      .catch(() => toast.error("Không thể tải thông tin khóa học"))
      .finally(() => setLoading(false));
  }, [courseCardId]);

  // ── Check user đã mua khóa học này chưa ─────────────────────────────────────
  // Chạy sau khi data đã load (cần course.id)
  useEffect(() => {
    if (!userId || !data?.course?.id) return;

    setCheckingPurchase(true);
    axiosInstance
      .get(`/learning/my-courses/${userId}`)
      .then((res) => {
        const courses: Array<{ courseId: string }> = res.data.courses ?? [];
        // So sánh cả course.id lẫn courseCardId để chắc chắn
        const bought = courses.some(
          (c) => c.courseId === data.course.id || c.courseId === courseCardId
        );
        setIsPurchased(bought);
      })
      .catch(() => {
        setIsPurchased(false);
      })
      .finally(() => setCheckingPurchase(false));
  }, [userId, data?.course?.id]);

  // ── Mở rộng 2 section đầu mặc định ────────────────────────────────────────
  useEffect(() => {
    if (data?.curriculum?.length) {
      setExpandedSections(
        new Set(data.curriculum.slice(0, 2).map((s) => s.id))
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
    if (!userId) { navigate("/login"); return; }
    if (isInCart) { navigate("/cart"); return; }
    setAddingCart(true);
    try {
      await addToCart(userId, courseCardId!);
      toast.success("Đã thêm vào giỏ hàng!");
    } catch {
      toast.error("Thêm vào giỏ hàng thất bại");
    } finally {
      setAddingCart(false);
    }
  }

  function handleWishlist() {
    if (!userId) { navigate("/login"); return; }
    if (isInWishlist) {
      removeFromWishlist(userId, courseCardId!, course?.title);
    } else {
      addToWishlist(userId, courseCardId!, course?.title);
    }
  }

  // ── Submit review ────────────────────────────────────────────────────────────
  const handleSubmitReview = async () => {
    if (!userId)       { navigate("/login"); return; }
    if (!isPurchased)  { toast.error("Bạn cần mua khóa học trước khi đánh giá"); return; }
    if (myRating === 0){ toast.warning("Vui lòng chọn số sao"); return; }
    if (!data?.course?.id) return;

    setSubmittingRev(true);
    try {
      await axiosInstance.post("/reviews", {
        course_id: data.course.id,
        user_id:   userId,
        rating:    myRating,
        comment:   myComment.trim() || null,
      });
      toast.success("Cảm ơn bạn đã đánh giá! ⭐", "Đánh giá của bạn đã được ghi nhận.");
      setMyReviewDone(true);
      // Refetch để cập nhật rating mới
      axiosInstance.get(`/courseCreation/course-detail-full/${courseCardId}`)
        .then((res) => setData(res.data))
        .catch(() => {});
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error("Không thể gửi đánh giá", msg ?? "Vui lòng thử lại.");
    } finally {
      setSubmittingRev(false);
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="cd-loading">
        <div className="cd-skeleton cd-skeleton--hero" />
        <div className="cd-skeleton cd-skeleton--body" />
      </div>
    );
  }

  if (!data) return <div className="cd-error">Không tìm thấy khóa học</div>;

  const { course, instructor, learnings, tags, curriculum, reviews } = data;

  const displaySections = showAllSections
    ? curriculum
    : curriculum.slice(0, 5);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="cd-page">
      {/* ── HERO BANNER ─────────────────────────────────── */}
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
              ({reviews.totalReviews.toLocaleString()} đánh giá)
            </span>
            <span className="cd-meta-light">
              {course.totalStudents.toLocaleString()} học viên
            </span>
          </div>

          <div className="cd-hero__instructor">
            Tạo bởi{" "}
            <span className="cd-link">{instructor.name}</span>
          </div>

          <div className="cd-hero__attrs">
            <span><FaGlobe /> {course.language}</span>
            <span><FaLayerGroup /> {course.level}</span>
            <span>
              <FaClock />{" "}
              {formatDuration(course.totalDurationSec)} tổng thời lượng
            </span>
            <span>
              <MdOutlineOndemandVideo /> {course.totalLectures} bài giảng
            </span>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ────────────────────────────────── */}
      <div className="cd-body">
        <div className="cd-body__left">

          {/* WHAT YOU'LL LEARN */}
          {learnings.length > 0 && (
            <section className="cd-section cd-learnings">
              <h2 className="cd-section__title">Bạn sẽ học được gì</h2>
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
            <h2 className="cd-section__title">Nội dung khóa học</h2>
            <div className="cd-curriculum__stats">
              <span>{course.totalSections} chương</span>
              <span>•</span>
              <span>{course.totalLectures} bài giảng</span>
              <span>•</span>
              <span>{formatDuration(course.totalDurationSec)} tổng thời lượng</span>
            </div>

            <div className="cd-sections">
              {displaySections.map((sec) => {
                const isOpen = expandedSections.has(sec.id);
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
                        {sec.lectureCount} bài •{" "}
                        {formatDuration(sec.totalDurationSec)}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="cd-sec__lectures">
                        {sec.lectures.map((lec) => (
                          <div key={lec.id} className="cd-lecture">
                            <span className="cd-lecture__icon">
                              {lec.isPreview ? (
                                <FaPlay className="icon-play" />
                              ) : (
                                <FaLock className="icon-lock" />
                              )}
                            </span>
                            <span className="cd-lecture__title">
                              {lec.title}
                            </span>
                            {lec.durationSec > 0 && (
                              <span className="cd-lecture__dur">
                                {formatDuration(lec.durationSec)}
                              </span>
                            )}
                          </div>
                        ))}
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
                  ? "Thu gọn"
                  : `Xem thêm ${curriculum.length - 5} chương`}
                {showAllSections ? <FaChevronUp /> : <FaChevronDown />}
              </button>
            )}
          </section>

          {/* DESCRIPTION */}
          <section className="cd-section">
            <h2 className="cd-section__title">Mô tả khóa học</h2>
            <p className="cd-description">{course.description}</p>
          </section>

          {/* INSTRUCTOR */}
          <section className="cd-section cd-instructor-sec">
            <h2 className="cd-section__title">Giảng viên</h2>
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
            <h2 className="cd-section__title">Đánh giá học viên</h2>

            <div className="cd-rating-overview">
              <div className="cd-rating-big">
                <span className="cd-rating-big__num">
                  {reviews.avgRating.toFixed(1)}
                </span>
                <StarRating rating={reviews.avgRating} size={20} />
                <span className="cd-rating-big__label">
                  Đánh giá khóa học
                </span>
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
                      <span className="cd-review-item__date">{r.createdAt}</span>
                    </div>
                    <p className="cd-review-item__comment">{r.comment}</p>
                  </div>
                </div>
              ))}

              {reviews.totalReviews === 0 && (
                <p className="cd-no-reviews">Chưa có đánh giá nào.</p>
              )}
            </div>

            {/* ── Form viết đánh giá ── */}
            {userId && isPurchased && (
              <div className="cd-review-form">
                <h3 className="cd-review-form__title">
                  {myReviewDone ? "✅ Cảm ơn bạn đã đánh giá!" : "Viết đánh giá của bạn"}
                </h3>

                {myReviewDone ? (
                  <div className="cd-review-form__done">
                    <p>Đánh giá của bạn đã được ghi nhận và sẽ hiển thị sau khi được duyệt.</p>
                    <button
                      className="cd-review-form__edit-btn"
                      onClick={() => setMyReviewDone(false)}
                    >
                      Chỉnh sửa đánh giá
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Star picker */}
                    <div className="cd-review-form__stars">
                      <p className="cd-review-form__stars-label">Đánh giá của bạn</p>
                      <div className="cd-review-form__star-row">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            type="button"
                            className={`cd-review-form__star ${(hoverRating || myRating) >= s ? "cd-review-form__star--on" : ""}`}
                            onMouseEnter={() => setHoverRating(s)}
                            onMouseLeave={() => setHoverRating(0)}
                            onClick={() => setMyRating(s)}
                            aria-label={`${s} sao`}
                          >
                            <FaStar />
                          </button>
                        ))}
                        {myRating > 0 && (
                          <span className="cd-review-form__rating-label">
                            {["", "Rất tệ", "Tệ", "Bình thường", "Tốt", "Xuất sắc"][myRating]}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Comment */}
                    <div className="cd-review-form__comment">
                      <label className="cd-review-form__label">
                        Nhận xét <span style={{ color: "#64748b", fontWeight: 400 }}>(tuỳ chọn)</span>
                      </label>
                      <textarea
                        className="cd-review-form__textarea"
                        placeholder="Chia sẻ trải nghiệm của bạn về khóa học này..."
                        value={myComment}
                        onChange={(e) => setMyComment(e.target.value)}
                        maxLength={500}
                        rows={4}
                      />
                      <span className="cd-review-form__counter">{myComment.length}/500</span>
                    </div>

                    <button
                      className="cd-review-form__submit"
                      onClick={handleSubmitReview}
                      disabled={submittingRev || myRating === 0}
                    >
                      {submittingRev ? (
                        <><span className="cd-review-form__spinner" /> Đang gửi...</>
                      ) : (
                        "Gửi đánh giá"
                      )}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Gợi ý mua nếu chưa có */}
            {userId && !isPurchased && (
              <div className="cd-review-form cd-review-form--locked">
                <span className="cd-review-form__lock-icon">🔒</span>
                <p>Mua khóa học để có thể đánh giá và chia sẻ trải nghiệm của bạn.</p>
              </div>
            )}
          </section>

          {/* TAGS */}
          {tags.length > 0 && (
            <section className="cd-section">
              <h2 className="cd-section__title">Tags</h2>
              <div className="cd-tags">
                {tags.map((t) => (
                  <span key={t} className="cd-tag">{t}</span>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ── STICKY CARD ─────────────────────────────────── */}
        <aside className="cd-card">
          <div className="cd-card__img-wrap">
            <img
              src={getCourseImageUrl(course.filename)}
              alt={course.title}
              className="cd-card__img"
            />
            <button className="cd-card__play-btn">
              <FaPlay />
            </button>
          </div>

          <div className="cd-card__body">

            {/* ── Đã mua: hiện badge + nút vào học ── */}
            {isPurchased ? (
              <>
                <div className="cd-card__purchased-badge">
                  <FaCheck /> Bạn đã sở hữu khóa học này
                </div>

                <button
                  className="cd-btn cd-btn--primary cd-btn--go-learn"
                  onClick={() => navigate(`/learn/${course.id}`)}
                >
                  <FaBookOpen />
                  Vào học ngay
                </button>
              </>
            ) : (
              /* ── Chưa mua: hiện giá + nút giỏ hàng ── */
              <>
                <div className="cd-card__prices">
                  <span className="cd-card__price">
                    {formatVnd(data.currentPrice)}
                  </span>
                  {data.price > data.currentPrice && (
                    <span className="cd-card__old-price">
                      {formatVnd(data.price)}
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
                    ? "Đang thêm..."
                    : isInCart
                    ? "Xem giỏ hàng"
                    : "Thêm vào giỏ hàng"}
                </button>
              </>
            )}

            {/* ── Nút wishlist (luôn hiện) ── */}
            <button
              className="cd-btn cd-btn--outline"
              onClick={handleWishlist}
            >
              {isInWishlist ? (
                <><FaHeart className="icon-heart" /> Đã lưu</>
              ) : (
                <><FaRegHeart /> Lưu vào yêu thích</>
              )}
            </button>

            {!isPurchased && (
              <p className="cd-card__guarantee">
                Đảm bảo hoàn tiền trong 30 ngày
              </p>
            )}

            <ul className="cd-card__includes">
              <li>
                <MdOutlineOndemandVideo />
                <span>
                  {formatDuration(course.totalDurationSec)} video theo yêu cầu
                </span>
              </li>
              <li>
                <MdOutlineArticle />
                <span>{course.totalLectures} bài giảng</span>
              </li>
              <li>
                <FaMobileAlt />
                <span>Truy cập trên thiết bị di động & TV</span>
              </li>
              <li>
                <FaInfinity />
                <span>Truy cập trọn đời</span>
              </li>
              <li>
                <FaTrophy />
                <span>Chứng chỉ hoàn thành</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}