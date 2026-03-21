import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus, FiTrash2, FiEdit2, FiCheck, FiX,
  FiUpload, FiVideo, FiChevronDown, FiChevronRight,
  FiBookOpen, FiUsers, FiStar, FiClock, FiEye,
  FiEyeOff, FiLoader, FiAlertCircle,
} from "react-icons/fi";
import { MdOutlineOndemandVideo } from "react-icons/md";
import axiosInstance from "../../lib/axios";
import { getCourseImageUrl } from "../../utils/courseImage";
import { formatVnd } from "../../utils/currency";
import "../../style/components/_instructor.scss";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CourseStats {
  students: number;
  sections: number;
  lectures: number;
  avgRating: number;
}

interface Course {
  id: string;
  title: string;
  courseSub: string;
  description: string;
  price: number;
  language: string;
  level: string;
  category: string;
  filename: string;
  createdAt: string;
  stats: CourseStats;
}

interface Lecture {
  id: string;
  title: string;
  position: number;
  durationSec: number;
  isPreview: boolean;
  videoUrl: string | null;
  hasVideo: boolean;
}

interface Section {
  id: string;
  title: string;
  position: number;
  totalDurationSec: number;
  lectureCount: number;
  lectures: Lecture[];
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function fmtDur(sec: number) {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

// ─── VideoUploadCell ──────────────────────────────────────────────────────────

function VideoUploadCell({
  lecture,
  onUploaded,
  onDeleted,
}: {
  lecture: Lecture;
  onUploaded: (lectureId: string, url: string, dur: number) => void;
  onDeleted: (lectureId: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError("");
    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("video", file);
    formData.append("durationSec", "0"); // có thể đọc từ metadata nếu muốn

    try {
      const res = await axiosInstance.post(
        `/instructor/lectures/${lecture.id}/upload-video`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (e) => {
            if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
          },
        }
      );
      onUploaded(lecture.id, res.data.videoUrl, res.data.durationSec);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this video?")) return;
    await axiosInstance.delete(`/instructor/lectures/${lecture.id}/video`);
    onDeleted(lecture.id);
  }

  if (lecture.hasVideo) {
    return (
      <div className="id-video-cell id-video-cell--has">
        <FiVideo className="id-video-icon id-video-icon--ok" />
        <span className="id-video-label">{fmtDur(lecture.durationSec)}</span>
        <button
          className="id-icon-btn id-icon-btn--danger"
          onClick={handleDelete}
          title="Delete video"
        >
          <FiTrash2 />
        </button>
      </div>
    );
  }

  return (
    <div className="id-video-cell">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {uploading ? (
        <div className="id-upload-progress">
          <div
            className="id-upload-progress__bar"
            style={{ width: `${progress}%` }}
          />
          <span>{progress}%</span>
        </div>
      ) : (
        <button
          className="id-upload-btn"
          onClick={() => inputRef.current?.click()}
        >
          <FiUpload /> Upload video
        </button>
      )}
      {error && <span className="id-error-inline">{error}</span>}
    </div>
  );
}

// ─── CurriculumEditor ─────────────────────────────────────────────────────────

function CurriculumEditor({ courseId }: { courseId: string }) {
  const [curriculum, setCurriculum] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Inline editing states
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState("");
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [addingSection, setAddingSection] = useState(false);

  const [addingLectureToSection, setAddingLectureToSection] = useState<string | null>(null);
  const [newLectureTitle, setNewLectureTitle] = useState("");
  const [editingLectureId, setEditingLectureId] = useState<string | null>(null);
  const [editingLectureTitle, setEditingLectureTitle] = useState("");

  useEffect(() => {
    fetchCurriculum();
  }, [courseId]);

  async function fetchCurriculum() {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/instructor/course-curriculum/${courseId}`);
      setCurriculum(res.data.curriculum ?? []);
      // Mở rộng tất cả sections mặc định
      setExpandedSections(new Set((res.data.curriculum ?? []).map((s: Section) => s.id)));
    } finally {
      setLoading(false);
    }
  }

  function toggleSection(id: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Section actions ──────────────────────────────────────────────────────

  async function handleAddSection() {
    if (!newSectionTitle.trim()) return;
    const res = await axiosInstance.post("/instructor/sections", {
      course_id: courseId,
      title: newSectionTitle.trim(),
    });
    const sec = res.data.section;
    setCurriculum((prev) => [...prev, { ...sec, lectures: [], totalDurationSec: 0, lectureCount: 0 }]);
    setExpandedSections((prev) => new Set(prev).add(sec.id));
    setNewSectionTitle("");
    setAddingSection(false);
  }

  async function handleUpdateSection(sectionId: string) {
    await axiosInstance.put(`/instructor/sections/${sectionId}`, {
      title: editingSectionTitle.trim(),
    });
    setCurriculum((prev) =>
      prev.map((s) => s.id === sectionId ? { ...s, title: editingSectionTitle.trim() } : s)
    );
    setEditingSectionId(null);
  }

  async function handleDeleteSection(sectionId: string) {
    if (!confirm("Delete this section and all lectures inside?")) return;
    await axiosInstance.delete(`/instructor/sections/${sectionId}`);
    setCurriculum((prev) => prev.filter((s) => s.id !== sectionId));
  }

  // ── Lecture actions ──────────────────────────────────────────────────────

  async function handleAddLecture(sectionId: string) {
    if (!newLectureTitle.trim()) return;
    const res = await axiosInstance.post("/instructor/lectures", {
      section_id: sectionId,
      title: newLectureTitle.trim(),
      is_preview: false,
    });
    const lec = res.data.lecture;
    setCurriculum((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              lectures: [...s.lectures, { ...lec, durationSec: 0, hasVideo: false, videoUrl: null }],
              lectureCount: s.lectureCount + 1,
            }
          : s
      )
    );
    setNewLectureTitle("");
    setAddingLectureToSection(null);
  }

  async function handleUpdateLecture(lectureId: string, sectionId: string) {
    await axiosInstance.put(`/instructor/lectures/${lectureId}`, {
      title: editingLectureTitle.trim(),
    });
    setCurriculum((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              lectures: s.lectures.map((l) =>
                l.id === lectureId ? { ...l, title: editingLectureTitle.trim() } : l
              ),
            }
          : s
      )
    );
    setEditingLectureId(null);
  }

  async function handleDeleteLecture(lectureId: string, sectionId: string) {
    if (!confirm("Delete this lecture?")) return;
    await axiosInstance.delete(`/instructor/lectures/${lectureId}`);
    setCurriculum((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              lectures: s.lectures.filter((l) => l.id !== lectureId),
              lectureCount: s.lectureCount - 1,
            }
          : s
      )
    );
  }

  async function handleTogglePreview(lecture: Lecture, sectionId: string) {
    await axiosInstance.put(`/instructor/lectures/${lecture.id}`, {
      is_preview: !lecture.isPreview,
    });
    setCurriculum((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              lectures: s.lectures.map((l) =>
                l.id === lecture.id ? { ...l, isPreview: !l.isPreview } : l
              ),
            }
          : s
      )
    );
  }

  function handleVideoUploaded(lectureId: string, url: string, dur: number) {
    setCurriculum((prev) =>
      prev.map((s) => ({
        ...s,
        lectures: s.lectures.map((l) =>
          l.id === lectureId
            ? { ...l, hasVideo: true, videoUrl: url, durationSec: dur }
            : l
        ),
      }))
    );
  }

  function handleVideoDeleted(lectureId: string) {
    setCurriculum((prev) =>
      prev.map((s) => ({
        ...s,
        lectures: s.lectures.map((l) =>
          l.id === lectureId ? { ...l, hasVideo: false, videoUrl: null, durationSec: 0 } : l
        ),
      }))
    );
  }

  if (loading) return <div className="id-loading-spin"><FiLoader className="spin" /> Loading...</div>;

  return (
    <div className="id-curriculum">
      <div className="id-curriculum__header">
        <h3>Course content</h3>
        <button className="id-btn id-btn--sm id-btn--primary" onClick={() => setAddingSection(true)}>
          <FiPlus /> Add section
        </button>
      </div>

      {/* Add section form */}
      {addingSection && (
        <div className="id-inline-form">
          <input
            autoFocus
            className="id-input"
            placeholder="New section title..."
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddSection()}
          />
          <button className="id-btn id-btn--sm id-btn--primary" onClick={handleAddSection}><FiCheck /></button>
          <button className="id-btn id-btn--sm id-btn--ghost" onClick={() => { setAddingSection(false); setNewSectionTitle(""); }}><FiX /></button>
        </div>
      )}

      {curriculum.length === 0 && !addingSection && (
        <div className="id-empty">
          <FiBookOpen />
          <p>No sections yet. Click "Add section" to get started.</p>
        </div>
      )}

      {curriculum.map((sec) => (
        <div key={sec.id} className="id-section">
          {/* Section header */}
          <div className="id-section__header">
            <button className="id-section__toggle" onClick={() => toggleSection(sec.id)}>
              {expandedSections.has(sec.id) ? <FiChevronDown /> : <FiChevronRight />}
            </button>

            {editingSectionId === sec.id ? (
              <div className="id-inline-form id-inline-form--grow">
                <input
                  autoFocus
                  className="id-input"
                  value={editingSectionTitle}
                  onChange={(e) => setEditingSectionTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdateSection(sec.id)}
                />
                <button className="id-btn id-btn--sm id-btn--primary" onClick={() => handleUpdateSection(sec.id)}><FiCheck /></button>
                <button className="id-btn id-btn--sm id-btn--ghost" onClick={() => setEditingSectionId(null)}><FiX /></button>
              </div>
            ) : (
              <span className="id-section__title">{sec.title}</span>
            )}

            <span className="id-section__meta">
              {sec.lectureCount} lectures · {fmtDur(sec.totalDurationSec)}
            </span>

            <div className="id-section__actions">
              <button className="id-icon-btn" onClick={() => { setEditingSectionId(sec.id); setEditingSectionTitle(sec.title); }} title="Edit">
                <FiEdit2 />
              </button>
              <button className="id-icon-btn id-icon-btn--danger" onClick={() => handleDeleteSection(sec.id)} title="Delete">
                <FiTrash2 />
              </button>
            </div>
          </div>

          {/* Lectures */}
          {expandedSections.has(sec.id) && (
            <div className="id-section__body">
              {sec.lectures.map((lec) => (
                <div key={lec.id} className="id-lecture">
                  <MdOutlineOndemandVideo className="id-lecture__icon" />

                  {editingLectureId === lec.id ? (
                    <div className="id-inline-form id-inline-form--grow">
                      <input
                        autoFocus
                        className="id-input id-input--sm"
                        value={editingLectureTitle}
                        onChange={(e) => setEditingLectureTitle(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleUpdateLecture(lec.id, sec.id)}
                      />
                      <button className="id-btn id-btn--sm id-btn--primary" onClick={() => handleUpdateLecture(lec.id, sec.id)}><FiCheck /></button>
                      <button className="id-btn id-btn--sm id-btn--ghost" onClick={() => setEditingLectureId(null)}><FiX /></button>
                    </div>
                  ) : (
                    <span className="id-lecture__title">{lec.title}</span>
                  )}

                  {/* Preview toggle */}
                  <button
                    className={`id-preview-badge ${lec.isPreview ? "id-preview-badge--on" : ""}`}
                    onClick={() => handleTogglePreview(lec, sec.id)}
                    title={lec.isPreview ? "Currently previewing - click to turn off" : "Click to enable preview"}
                  >
                    {lec.isPreview ? <FiEye /> : <FiEyeOff />}
                    {lec.isPreview ? "Preview" : "Private"}
                  </button>

                  {/* Video upload */}
                  <VideoUploadCell
                    lecture={lec}
                    onUploaded={handleVideoUploaded}
                    onDeleted={handleVideoDeleted}
                  />

                  <div className="id-lecture__actions">
                    <button className="id-icon-btn" onClick={() => { setEditingLectureId(lec.id); setEditingLectureTitle(lec.title); }} title="Edit">
                      <FiEdit2 />
                    </button>
                    <button className="id-icon-btn id-icon-btn--danger" onClick={() => handleDeleteLecture(lec.id, sec.id)} title="Delete">
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              ))}

              {/* Add lecture */}
              {addingLectureToSection === sec.id ? (
                <div className="id-inline-form id-add-lecture-form">
                  <input
                    autoFocus
                    className="id-input id-input--sm"
                    placeholder="New lecture title..."
                    value={newLectureTitle}
                    onChange={(e) => setNewLectureTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddLecture(sec.id)}
                  />
                  <button className="id-btn id-btn--sm id-btn--primary" onClick={() => handleAddLecture(sec.id)}><FiCheck /></button>
                  <button className="id-btn id-btn--sm id-btn--ghost" onClick={() => { setAddingLectureToSection(null); setNewLectureTitle(""); }}><FiX /></button>
                </div>
              ) : (
                <button
                  className="id-add-lecture-btn"
                  onClick={() => { setAddingLectureToSection(sec.id); setNewLectureTitle(""); }}
                >
                  <FiPlus /> Add lecture
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── InstructorDashboard (main) ───────────────────────────────────────────────

export default function InstructorDashboard() {
  const navigate = useNavigate();
  const instructorId = localStorage.getItem("userId");
  const role = localStorage.getItem("role");

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [view, setView] = useState<"list" | "curriculum">("list");

  useEffect(() => {
    if (!instructorId || role !== "instructor") {
      navigate("/login");
      return;
    }
    fetchCourses();
  }, []);

  async function fetchCourses() {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/instructor/my-courses/${instructorId}`);
      setCourses(res.data.courses ?? []);
    } finally {
      setLoading(false);
    }
  }

  function openCurriculum(course: Course) {
    setSelectedCourse(course);
    setView("curriculum");
  }

  // ─── Render: Course List ───────────────────────────────────────────────────

  if (view === "curriculum" && selectedCourse) {
    return (
      <div className="id-page">
        <div className="id-topbar">
          <button className="id-back-btn" onClick={() => setView("list")}>
            ← Back
          </button>
          <div className="id-topbar__info">
            <span className="id-topbar__label">Edit course</span>
            <h2 className="id-topbar__title">{selectedCourse.title}</h2>
          </div>
        </div>
        <div className="id-content">
          <CurriculumEditor courseId={selectedCourse.id} />
        </div>
      </div>
    );
  }

  return (
    <div className="id-page">
      {/* Header */}
      <div className="id-header">
        <div className="id-header__left">
          <h1 className="id-header__title">Instructor Dashboard</h1>
          <p className="id-header__sub">Manage your courses</p>
        </div>
        <button
          className="id-btn id-btn--primary"
          onClick={() => navigate("/create-course")}
        >
          <FiPlus /> Create a new course
        </button>
      </div>

      {/* Stats overview */}
      {courses.length > 0 && (
        <div className="id-stats-row">
          <div className="id-stat-card">
            <FiBookOpen className="id-stat-card__icon" />
            <div>
              <span className="id-stat-card__num">{courses.length}</span>
              <span className="id-stat-card__label">Courses</span>
            </div>
          </div>
          <div className="id-stat-card">
            <FiUsers className="id-stat-card__icon" />
            <div>
              <span className="id-stat-card__num">
                {courses.reduce((a, c) => a + c.stats.students, 0)}
              </span>
              <span className="id-stat-card__label">Students</span>
            </div>
          </div>
          <div className="id-stat-card">
            <FiStar className="id-stat-card__icon" />
            <div>
              <span className="id-stat-card__num">
                {courses.length > 0
                  ? (courses.reduce((a, c) => a + c.stats.avgRating, 0) / courses.length).toFixed(1)
                  : "—"}
              </span>
              <span className="id-stat-card__label">Average rating</span>
            </div>
          </div>
          <div className="id-stat-card">
            <FiClock className="id-stat-card__icon" />
            <div>
              <span className="id-stat-card__num">
                {courses.reduce((a, c) => a + c.stats.lectures, 0)}
              </span>
              <span className="id-stat-card__label">Lectures</span>
            </div>
          </div>
        </div>
      )}

      {/* Course list */}
      <div className="id-content">
        {loading ? (
          <div className="id-loading-spin"><FiLoader className="spin" /> Loading...</div>
        ) : courses.length === 0 ? (
          <div className="id-empty id-empty--page">
            <FiBookOpen />
            <h3>You don't have any courses yet</h3>
            <p>Get started by creating your first course.</p>
            <button
              className="id-btn id-btn--primary"
              onClick={() => navigate("/create-course")}
            >
              <FiPlus /> Create a course
            </button>
          </div>
        ) : (
          <div className="id-courses-grid">
            {courses.map((course) => (
              <div key={course.id} className="id-course-card">
                <div className="id-course-card__img-wrap">
                  <img
                    src={getCourseImageUrl(course.filename)}
                    alt={course.title}
                    className="id-course-card__img"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://s.udemycdn.com/course/750x422/placeholder.jpg";
                    }}
                  />
                  <span className="id-course-card__level">{course.level}</span>
                </div>

                <div className="id-course-card__body">
                  <h3 className="id-course-card__title">{course.title}</h3>
                  <p className="id-course-card__sub">{course.courseSub}</p>

                  <div className="id-course-card__stats">
                    <span><FiUsers /> {course.stats.students} students</span>
                    <span><FiStar /> {course.stats.avgRating.toFixed(1)}</span>
                    <span><MdOutlineOndemandVideo /> {course.stats.lectures} lectures</span>
                  </div>

                  <div className="id-course-card__price">
                    {formatVnd(course.price)} ₫
                  </div>

                  <div className="id-course-card__actions">
                    <button
                      className="id-btn id-btn--primary id-btn--sm"
                      onClick={() => openCurriculum(course)}
                    >
                      <FiEdit2 /> Edit content
                    </button>
                    <button
                      className="id-btn id-btn--ghost id-btn--sm"
                      onClick={() => navigate(`/course-detail/${course.id}`)}
                    >
                      <FiEye /> View page
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}