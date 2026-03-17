import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiCheck, FiChevronDown, FiChevronRight,
  FiArrowLeft, FiLock, FiPlay, FiAward,
} from "react-icons/fi";
import { MdOutlineOndemandVideo } from "react-icons/md";
import axiosInstance from "../../lib/axios";
import { getCourseImageUrl } from "../../utils/courseImage";
import "../../style/components/_learn.scss";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lecture {
  id: string;
  title: string;
  position: number;
  durationSec: number;
  isPreview: boolean;
  videoUrl: string | null;
  isCompleted: boolean;
  watchedSec: number;
}

interface Section {
  id: string;
  title: string;
  position: number;
  lectures: Lecture[];
}

interface CourseInfo {
  id: string;
  title: string;
  courseSub: string;
  path: string;
  instructorName: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function fmtDur(sec: number) {
  if (!sec) return "0:00";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const SERVER = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

function getVideoUrl(videoUrl: string | null): string | null {
  if (!videoUrl) return null;
  if (videoUrl.startsWith("http")) return videoUrl;
  // "/images/..." hoặc "/uploads/..." → full URL
  return `${SERVER}${videoUrl}`;
}

// ─── LearnPage ────────────────────────────────────────────────────────────────

export default function LearnPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const userId = localStorage.getItem("userId");

  const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null);
  const [curriculum, setCurriculum] = useState<Section[]>([]);
  const [totalLectures, setTotalLectures] = useState(0);
  const [completedLectures, setCompletedLectures] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeLecture, setActiveLecture] = useState<Lecture | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const videoRef = useRef<HTMLVideoElement>(null);
  const progressSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSec = useRef(0);

  // ── Fetch data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId || !courseId) { navigate("/login"); return; }

    axiosInstance.get(`/learning/learn/${userId}/${courseId}`)
      .then(res => {
        const d = res.data;
        setCourseInfo(d.course);
        setCurriculum(d.curriculum ?? []);
        setTotalLectures(d.totalLectures);
        setCompletedLectures(d.completedLectures);
        setProgressPct(d.progressPct);

        // Mở tất cả sections
        setExpandedSections(new Set((d.curriculum ?? []).map((s: Section) => s.id)));

        // Chọn bài chưa hoàn thành đầu tiên, hoặc bài đầu tiên
        const allLectures = (d.curriculum ?? []).flatMap((s: Section) => s.lectures);
        const resume = allLectures.find((l: Lecture) => !l.isCompleted) ?? allLectures[0];
        if (resume) setActiveLecture(resume);
      })
      .catch(() => setError("Bạn chưa mua khóa học này hoặc có lỗi xảy ra."))
      .finally(() => setLoading(false));
  }, [courseId]);

  // ── Lưu tiến độ ────────────────────────────────────────────────────────────

  const saveProgress = useCallback(async (
    lecture: Lecture,
    watchedSec: number,
    isCompleted: boolean,
  ) => {
    if (!userId || !courseId) return;
    try {
      await axiosInstance.post("/learning/progress", {
        user_id:      userId,
        lecture_id:   lecture.id,
        course_id:    courseId,
        watched_sec:  watchedSec,
        is_completed: isCompleted,
      });

      // Cập nhật local state
      setCurriculum(prev => prev.map(sec => ({
        ...sec,
        lectures: sec.lectures.map(l =>
          l.id === lecture.id
            ? { ...l, isCompleted, watchedSec }
            : l
        ),
      })));

      if (isCompleted && !lecture.isCompleted) {
        setCompletedLectures(prev => {
          const next = prev + 1;
          setProgressPct(totalLectures > 0 ? Math.round(next / totalLectures * 100) : 0);
          return next;
        });
        setActiveLecture(prev => prev ? { ...prev, isCompleted: true } : prev);
      }
    } catch (e) {
      console.error("Save progress error:", e);
    }
  }, [userId, courseId, totalLectures]);

  // ── Video event handlers ────────────────────────────────────────────────────

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video || !activeLecture) return;

    const sec = Math.floor(video.currentTime);

    // Lưu mỗi 10 giây
    if (sec - lastSavedSec.current >= 10) {
      lastSavedSec.current = sec;
      saveProgress(activeLecture, sec, false);
    }
  }

  function handleVideoEnded() {
    if (!activeLecture) return;
    const duration = videoRef.current?.duration ?? 0;
    saveProgress(activeLecture, Math.floor(duration), true);
  }

  function handleMarkComplete(lecture: Lecture) {
    const sec = videoRef.current ? Math.floor(videoRef.current.currentTime) : lecture.watchedSec;
    saveProgress(lecture, sec, !lecture.isCompleted);
  }

  // ── Chọn bài giảng ─────────────────────────────────────────────────────────

  function selectLecture(lecture: Lecture) {
    // Lưu progress bài hiện tại trước khi chuyển
    if (activeLecture && videoRef.current) {
      saveProgress(activeLecture, Math.floor(videoRef.current.currentTime), activeLecture.isCompleted);
    }
    lastSavedSec.current = 0;
    setActiveLecture(lecture);
  }

  function toggleSection(id: string) {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Auto-play từ vị trí đã xem ─────────────────────────────────────────────

  useEffect(() => {
    if (!activeLecture || !videoRef.current) return;
    const video = videoRef.current;

    const onLoaded = () => {
      if (activeLecture.watchedSec > 0 && !activeLecture.isCompleted) {
        video.currentTime = activeLecture.watchedSec;
      }
    };

    video.addEventListener("loadedmetadata", onLoaded);
    return () => video.removeEventListener("loadedmetadata", onLoaded);
  }, [activeLecture?.id]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="lp-page">
      <div className="lp-loading"><div className="lp-spinner" /><p>Đang tải...</p></div>
    </div>
  );

  if (error) return (
    <div className="lp-page">
      <div className="lp-error">
        <FiLock />
        <h3>{error}</h3>
        <button onClick={() => navigate("/")}>Về trang chủ</button>
      </div>
    </div>
  );

  const videoSrc = activeLecture ? getVideoUrl(activeLecture.videoUrl) : null;

  return (
    <div className="lp-page">
      {/* ── Top bar ── */}
      <div className="lp-topbar">
        <button className="lp-back" onClick={() => navigate("/my-courses")}>
          <FiArrowLeft />
        </button>
        <div className="lp-topbar__info">
          <span className="lp-topbar__title">{courseInfo?.title}</span>
        </div>
        {/* Progress */}
        <div className="lp-topbar__progress">
          <div className="lp-topbar__progress-track">
            <div className="lp-topbar__progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="lp-topbar__pct">{progressPct}% hoàn thành</span>
        </div>
        {progressPct === 100 && (
          <div className="lp-topbar__badge"><FiAward /> Hoàn thành!</div>
        )}
      </div>

      <div className="lp-body">
        {/* ── Video panel ── */}
        <div className="lp-main">
          {/* Video player */}
          <div className="lp-video-wrap">
            {videoSrc ? (
              <video
                ref={videoRef}
                key={activeLecture?.id}
                className="lp-video"
                controls
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleVideoEnded}
              >
                <source src={videoSrc} />
                Trình duyệt không hỗ trợ video.
              </video>
            ) : (
              <div className="lp-video-placeholder">
                <MdOutlineOndemandVideo />
                <p>
                  {activeLecture
                    ? "Bài giảng này chưa có video"
                    : "Chọn một bài giảng để bắt đầu"}
                </p>
              </div>
            )}
          </div>

          {/* Lecture info */}
          {activeLecture && (
            <div className="lp-lecture-info">
              <h2 className="lp-lecture-info__title">{activeLecture.title}</h2>
              <div className="lp-lecture-info__actions">
                <button
                  className={`lp-complete-btn ${activeLecture.isCompleted ? "lp-complete-btn--done" : ""}`}
                  onClick={() => handleMarkComplete(activeLecture)}
                >
                  <FiCheck />
                  {activeLecture.isCompleted ? "Đã hoàn thành" : "Đánh dấu hoàn thành"}
                </button>
                {activeLecture.durationSec > 0 && (
                  <span className="lp-duration">
                    {fmtDur(activeLecture.durationSec)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Curriculum sidebar ── */}
        <aside className="lp-sidebar">
          <div className="lp-sidebar__header">
            <span>Nội dung khóa học</span>
            <span className="lp-sidebar__count">
              {completedLectures}/{totalLectures} bài
            </span>
          </div>

          <div className="lp-sidebar__list">
            {curriculum.map(sec => {
              const secCompleted = sec.lectures.filter(l => l.isCompleted).length;
              const expanded = expandedSections.has(sec.id);

              return (
                <div key={sec.id} className="lp-section">
                  {/* Section header */}
                  <button
                    className="lp-section__header"
                    onClick={() => toggleSection(sec.id)}
                  >
                    {expanded ? <FiChevronDown /> : <FiChevronRight />}
                    <span className="lp-section__title">{sec.title}</span>
                    <span className="lp-section__prog">
                      {secCompleted}/{sec.lectures.length}
                    </span>
                  </button>

                  {/* Lectures */}
                  {expanded && sec.lectures.map(lec => {
                    const isActive = activeLecture?.id === lec.id;
                    return (
                      <button
                        key={lec.id}
                        className={`lp-lecture ${isActive ? "lp-lecture--active" : ""} ${lec.isCompleted ? "lp-lecture--done" : ""}`}
                        onClick={() => selectLecture(lec)}
                      >
                        <span className={`lp-lecture__check ${lec.isCompleted ? "lp-lecture__check--done" : ""}`}>
                          {lec.isCompleted ? <FiCheck /> : <FiPlay />}
                        </span>
                        <div className="lp-lecture__info">
                          <span className="lp-lecture__name">{lec.title}</span>
                          {lec.durationSec > 0 && (
                            <span className="lp-lecture__dur">{fmtDur(lec.durationSec)}</span>
                          )}
                        </div>
                        {!lec.videoUrl && (
                          <FiLock className="lp-lecture__no-video" title="Chưa có video" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}