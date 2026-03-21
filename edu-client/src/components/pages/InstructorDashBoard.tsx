import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus, FiTrash2, FiEdit2, FiCheck, FiX,
  FiUpload, FiVideo, FiChevronDown, FiChevronRight,
  FiBookOpen, FiUsers, FiStar, FiClock, FiEye,
  FiEyeOff, FiLoader, FiTrendingUp, FiDollarSign,
  FiAward, FiBarChart2, FiArrowUp, FiArrowDown,
  FiGrid, FiList, FiCalendar,
  FiArrowDownLeft,
} from "react-icons/fi";
import { MdOutlineOndemandVideo } from "react-icons/md";
import axiosInstance from "../../lib/axios";
import { getCourseImageUrl } from "../../utils/courseImage";
import { formatVnd } from "../../utils/currency";
import "../../style/components/_instructor.scss";
import WithdrawalTab from "../Instructor/WithdrawalTab";
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

// ─── Revenue helpers ──────────────────────────────────────────────────────────

function buildRevenueData(courses: Course[]) {
  // Simulate monthly revenue from course stats (real app: dedicated API)
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  const last6: { month: string; revenue: number; students: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = months[d.getMonth()];
    // Deterministic mock based on course data
    const seed = courses.reduce((a, c) => a + c.stats.students, 0);
    const multiplier = 0.6 + ((i * 7 + seed) % 8) / 10;
    const revenue = courses.reduce((a, c) => a + c.price * c.stats.students * multiplier * 0.15, 0);
    const students = Math.round(courses.reduce((a, c) => a + c.stats.students, 0) * multiplier * 0.3);
    last6.push({ month: label, revenue: Math.round(revenue), students });
  }
  return last6;
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────

function RevenueBarChart({ data }: { data: { month: string; revenue: number; students: number }[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [mode, setMode] = useState<"revenue" | "students">("revenue");
  const values = data.map(d => mode === "revenue" ? d.revenue : d.students);
  const max = Math.max(...values, 1);

  return (
    <div className="id-chart">
      <div className="id-chart__toolbar">
        <button
          className={`id-chart__tab ${mode === "revenue" ? "id-chart__tab--active" : ""}`}
          onClick={() => setMode("revenue")}
        >Revenue</button>
        <button
          className={`id-chart__tab ${mode === "students" ? "id-chart__tab--active" : ""}`}
          onClick={() => setMode("students")}
        >Students</button>
      </div>
      <div className="id-chart__bars">
        {data.map((d, i) => {
          const val = mode === "revenue" ? d.revenue : d.students;
          const pct = (val / max) * 100;
          return (
            <div
              key={d.month}
              className={`id-chart__col ${hovered === i ? "id-chart__col--hovered" : ""}`}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {hovered === i && (
                <div className="id-chart__tooltip">
                  <span className="id-chart__tooltip-label">{d.month}</span>
                  <span className="id-chart__tooltip-val">
                    {mode === "revenue" ? `${formatVnd(val)} ₫` : `${val} students`}
                  </span>
                </div>
              )}
              <div className="id-chart__bar-wrap">
                <div
                  className="id-chart__bar"
                  style={{ height: `${Math.max(pct, 4)}%` }}
                />
              </div>
              <span className="id-chart__label">{d.month}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, color, trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="id-stat" style={{ "--stat-color": color } as React.CSSProperties}>
      <div className="id-stat__icon">{icon}</div>
      <div className="id-stat__body">
        <span className="id-stat__label">{label}</span>
        <span className="id-stat__value">{value}</span>
        {sub && (
          <span className={`id-stat__sub ${trend === "up" ? "id-stat__sub--up" : trend === "down" ? "id-stat__sub--down" : ""}`}>
            {trend === "up" && <FiArrowUp size={10} />}
            {trend === "down" && <FiArrowDown size={10} />}
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function fmtDur(sec: number) {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function StarBar({ value }: { value: number }) {
  return (
    <div className="id-starbar">
      <div className="id-starbar__track">
        <div className="id-starbar__fill" style={{ width: `${(value / 5) * 100}%` }} />
      </div>
      <span>{value.toFixed(1)}</span>
    </div>
  );
}

// ─── VideoUploadCell ──────────────────────────────────────────────────────────

function VideoUploadCell({
  lecture, onUploaded, onDeleted,
}: {
  lecture: Lecture;
  onUploaded: (id: string, url: string, dur: number) => void;
  onDeleted: (id: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(""); setUploading(true); setProgress(0);
    const formData = new FormData();
    formData.append("video", file);
    formData.append("durationSec", "0");
    try {
      const res = await axiosInstance.post(
        `/instructor/lectures/${lecture.id}/upload-video`, formData,
        { headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (e) => { if (e.total) setProgress(Math.round((e.loaded / e.total) * 100)); } }
      );
      onUploaded(lecture.id, res.data.videoUrl, res.data.durationSec);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Upload failed");
    } finally { setUploading(false); setProgress(0); }
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
        <button className="id-icon-btn id-icon-btn--danger" onClick={handleDelete} title="Delete video">
          <FiTrash2 />
        </button>
      </div>
    );
  }

  return (
    <div className="id-video-cell">
      <input ref={inputRef} type="file"
        accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
      {uploading ? (
        <div className="id-upload-progress">
          <div className="id-upload-progress__bar" style={{ width: `${progress}%` }} />
          <span>{progress}%</span>
        </div>
      ) : (
        <button className="id-upload-btn" onClick={() => inputRef.current?.click()}>
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
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState("");
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [addingSection, setAddingSection] = useState(false);
  const [addingLectureToSection, setAddingLectureToSection] = useState<string | null>(null);
  const [newLectureTitle, setNewLectureTitle] = useState("");
  const [editingLectureId, setEditingLectureId] = useState<string | null>(null);
  const [editingLectureTitle, setEditingLectureTitle] = useState("");

  useEffect(() => { fetchCurriculum(); }, [courseId]);

  async function fetchCurriculum() {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/instructor/course-curriculum/${courseId}`);
      setCurriculum(res.data.curriculum ?? []);
      setExpandedSections(new Set((res.data.curriculum ?? []).map((s: Section) => s.id)));
    } finally { setLoading(false); }
  }

  function toggleSection(id: string) {
    setExpandedSections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function handleAddSection() {
    if (!newSectionTitle.trim()) return;
    const res = await axiosInstance.post("/instructor/sections", { course_id: courseId, title: newSectionTitle.trim() });
    const sec = res.data.section;
    setCurriculum(prev => [...prev, { ...sec, lectures: [], totalDurationSec: 0, lectureCount: 0 }]);
    setExpandedSections(prev => new Set(prev).add(sec.id));
    setNewSectionTitle(""); setAddingSection(false);
  }

  async function handleUpdateSection(id: string) {
    await axiosInstance.put(`/instructor/sections/${id}`, { title: editingSectionTitle.trim() });
    setCurriculum(prev => prev.map(s => s.id === id ? { ...s, title: editingSectionTitle.trim() } : s));
    setEditingSectionId(null);
  }

  async function handleDeleteSection(id: string) {
    if (!confirm("Delete this section and all its lectures?")) return;
    await axiosInstance.delete(`/instructor/sections/${id}`);
    setCurriculum(prev => prev.filter(s => s.id !== id));
  }

  async function handleAddLecture(sectionId: string) {
    if (!newLectureTitle.trim()) return;
    const res = await axiosInstance.post("/instructor/lectures", { section_id: sectionId, title: newLectureTitle.trim(), is_preview: false });
    const lec = res.data.lecture;
    setCurriculum(prev => prev.map(s => s.id === sectionId
      ? { ...s, lectures: [...s.lectures, { ...lec, durationSec: 0, hasVideo: false, videoUrl: null }], lectureCount: s.lectureCount + 1 }
      : s));
    setNewLectureTitle(""); setAddingLectureToSection(null);
  }

  async function handleUpdateLecture(lectureId: string, sectionId: string) {
    await axiosInstance.put(`/instructor/lectures/${lectureId}`, { title: editingLectureTitle.trim() });
    setCurriculum(prev => prev.map(s => s.id === sectionId
      ? { ...s, lectures: s.lectures.map(l => l.id === lectureId ? { ...l, title: editingLectureTitle.trim() } : l) }
      : s));
    setEditingLectureId(null);
  }

  async function handleDeleteLecture(lectureId: string, sectionId: string) {
    if (!confirm("Delete this lecture?")) return;
    await axiosInstance.delete(`/instructor/lectures/${lectureId}`);
    setCurriculum(prev => prev.map(s => s.id === sectionId
      ? { ...s, lectures: s.lectures.filter(l => l.id !== lectureId), lectureCount: s.lectureCount - 1 }
      : s));
  }

  async function handleTogglePreview(lecture: Lecture, sectionId: string) {
    await axiosInstance.put(`/instructor/lectures/${lecture.id}`, { is_preview: !lecture.isPreview });
    setCurriculum(prev => prev.map(s => s.id === sectionId
      ? { ...s, lectures: s.lectures.map(l => l.id === lecture.id ? { ...l, isPreview: !l.isPreview } : l) }
      : s));
  }

  function handleVideoUploaded(id: string, url: string, dur: number) {
    setCurriculum(prev => prev.map(s => ({ ...s, lectures: s.lectures.map(l => l.id === id ? { ...l, hasVideo: true, videoUrl: url, durationSec: dur } : l) })));
  }

  function handleVideoDeleted(id: string) {
    setCurriculum(prev => prev.map(s => ({ ...s, lectures: s.lectures.map(l => l.id === id ? { ...l, hasVideo: false, videoUrl: null, durationSec: 0 } : l) })));
  }

  if (loading) return <div className="id-loading-spin"><FiLoader className="spin" /> Loading...</div>;

  const totalLectures = curriculum.reduce((a, s) => a + s.lectures.length, 0);
  const totalDuration = curriculum.reduce((a, s) => a + s.totalDurationSec, 0);

  return (
    <div className="id-curriculum">
      <div className="id-curriculum__header">
        <div>
          <h3>Course Curriculum</h3>
          <p className="id-curriculum__meta">
            {curriculum.length} sections · {totalLectures} lectures · {fmtDur(totalDuration)} total
          </p>
        </div>
        <button className="id-btn id-btn--sm id-btn--primary" onClick={() => setAddingSection(true)}>
          <FiPlus /> Add Section
        </button>
      </div>

      {addingSection && (
        <div className="id-inline-form">
          <input autoFocus className="id-input" placeholder="New section title..."
            value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddSection()} />
          <button className="id-btn id-btn--sm id-btn--primary" onClick={handleAddSection}><FiCheck /></button>
          <button className="id-btn id-btn--sm id-btn--ghost" onClick={() => { setAddingSection(false); setNewSectionTitle(""); }}><FiX /></button>
        </div>
      )}

      {curriculum.length === 0 && !addingSection && (
        <div className="id-empty">
          <FiBookOpen />
          <p>No sections yet. Click "Add Section" to start building your curriculum.</p>
        </div>
      )}

      {curriculum.map((sec, idx) => (
        <div key={sec.id} className="id-section">
          <div className="id-section__header">
            <button className="id-section__toggle" onClick={() => toggleSection(sec.id)}>
              {expandedSections.has(sec.id) ? <FiChevronDown /> : <FiChevronRight />}
            </button>
            <span className="id-section__num">Section {idx + 1}</span>

            {editingSectionId === sec.id ? (
              <div className="id-inline-form id-inline-form--grow">
                <input autoFocus className="id-input"
                  value={editingSectionTitle} onChange={(e) => setEditingSectionTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdateSection(sec.id)} />
                <button className="id-btn id-btn--sm id-btn--primary" onClick={() => handleUpdateSection(sec.id)}><FiCheck /></button>
                <button className="id-btn id-btn--sm id-btn--ghost" onClick={() => setEditingSectionId(null)}><FiX /></button>
              </div>
            ) : (
              <span className="id-section__title">{sec.title}</span>
            )}

            <span className="id-section__meta">{sec.lectureCount} lectures · {fmtDur(sec.totalDurationSec)}</span>

            <div className="id-section__actions">
              <button className="id-icon-btn" title="Edit"
                onClick={() => { setEditingSectionId(sec.id); setEditingSectionTitle(sec.title); }}>
                <FiEdit2 />
              </button>
              <button className="id-icon-btn id-icon-btn--danger" title="Delete" onClick={() => handleDeleteSection(sec.id)}>
                <FiTrash2 />
              </button>
            </div>
          </div>

          {expandedSections.has(sec.id) && (
            <div className="id-section__body">
              {sec.lectures.map((lec) => (
                <div key={lec.id} className="id-lecture">
                  <MdOutlineOndemandVideo className="id-lecture__icon" />

                  {editingLectureId === lec.id ? (
                    <div className="id-inline-form id-inline-form--grow">
                      <input autoFocus className="id-input id-input--sm" value={editingLectureTitle}
                        onChange={(e) => setEditingLectureTitle(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleUpdateLecture(lec.id, sec.id)} />
                      <button className="id-btn id-btn--sm id-btn--primary" onClick={() => handleUpdateLecture(lec.id, sec.id)}><FiCheck /></button>
                      <button className="id-btn id-btn--sm id-btn--ghost" onClick={() => setEditingLectureId(null)}><FiX /></button>
                    </div>
                  ) : (
                    <span className="id-lecture__title">{lec.title}</span>
                  )}

                  <button
                    className={`id-preview-badge ${lec.isPreview ? "id-preview-badge--on" : ""}`}
                    onClick={() => handleTogglePreview(lec, sec.id)}
                    title={lec.isPreview ? "Public preview — click to make private" : "Click to allow free preview"}
                  >
                    {lec.isPreview ? <FiEye /> : <FiEyeOff />}
                    {lec.isPreview ? "Preview" : "Private"}
                  </button>

                  <VideoUploadCell lecture={lec} onUploaded={handleVideoUploaded} onDeleted={handleVideoDeleted} />

                  <div className="id-lecture__actions">
                    <button className="id-icon-btn" title="Edit"
                      onClick={() => { setEditingLectureId(lec.id); setEditingLectureTitle(lec.title); }}>
                      <FiEdit2 />
                    </button>
                    <button className="id-icon-btn id-icon-btn--danger" title="Delete"
                      onClick={() => handleDeleteLecture(lec.id, sec.id)}>
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              ))}

              {addingLectureToSection === sec.id ? (
                <div className="id-inline-form id-add-lecture-form">
                  <input autoFocus className="id-input id-input--sm" placeholder="New lecture title..."
                    value={newLectureTitle} onChange={(e) => setNewLectureTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddLecture(sec.id)} />
                  <button className="id-btn id-btn--sm id-btn--primary" onClick={() => handleAddLecture(sec.id)}><FiCheck /></button>
                  <button className="id-btn id-btn--sm id-btn--ghost" onClick={() => { setAddingLectureToSection(null); setNewLectureTitle(""); }}><FiX /></button>
                </div>
              ) : (
                <button className="id-add-lecture-btn"
                  onClick={() => { setAddingLectureToSection(sec.id); setNewLectureTitle(""); }}>
                  <FiPlus /> Add Lecture
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Course Card (grid view) ─────────────────────────────────────────────────

function CourseCard({ course, onEdit, onView }: { course: Course; onEdit: () => void; onView: () => void }) {
  const revenueEst = course.price * course.stats.students * 0.7;

  return (
    <div className="id-course-card">
      <div className="id-course-card__img-wrap">
        <img
          src={getCourseImageUrl(course.filename)}
          alt={course.title}
          className="id-course-card__img"
          onError={(e) => { (e.target as HTMLImageElement).src = "https://s.udemycdn.com/course/750x422/placeholder.jpg"; }}
        />
        <span className="id-course-card__level">{course.level}</span>
        <div className="id-course-card__overlay">
          <button className="id-course-card__overlay-btn" onClick={onEdit}><FiEdit2 /> Edit Curriculum</button>
          <button className="id-course-card__overlay-btn id-course-card__overlay-btn--ghost" onClick={onView}><FiEye /> Preview</button>
        </div>
      </div>

      <div className="id-course-card__body">
        <div className="id-course-card__category">{course.category}</div>
        <h3 className="id-course-card__title">{course.title}</h3>
        <p className="id-course-card__sub">{course.courseSub}</p>

        <div className="id-course-card__metrics">
          <div className="id-course-card__metric">
            <FiUsers size={13} />
            <span>{course.stats.students.toLocaleString()}</span>
            <em>students</em>
          </div>
          <div className="id-course-card__metric">
            <MdOutlineOndemandVideo size={13} />
            <span>{course.stats.lectures}</span>
            <em>lectures</em>
          </div>
          <div className="id-course-card__metric">
            <FiStar size={13} />
            <span>{course.stats.avgRating.toFixed(1)}</span>
            <em>rating</em>
          </div>
        </div>

        <div className="id-course-card__footer">
          <div className="id-course-card__revenue">
            <span className="id-course-card__revenue-label">Est. Revenue</span>
            <span className="id-course-card__revenue-val">{formatVnd(revenueEst)} ₫</span>
          </div>
          <div className="id-course-card__price">{formatVnd(course.price)} ₫</div>
        </div>
      </div>
    </div>
  );
}

// ─── Course Row (list view) ──────────────────────────────────────────────────

function CourseRow({ course, onEdit, onView }: { course: Course; onEdit: () => void; onView: () => void }) {
  return (
    <div className="id-course-row">
      <img
        src={getCourseImageUrl(course.filename)}
        alt={course.title}
        className="id-course-row__img"
        onError={(e) => { (e.target as HTMLImageElement).src = "https://s.udemycdn.com/course/750x422/placeholder.jpg"; }}
      />
      <div className="id-course-row__info">
        <span className="id-course-row__cat">{course.category}</span>
        <h4 className="id-course-row__title">{course.title}</h4>
        <p className="id-course-row__sub">{course.courseSub}</p>
      </div>
      <div className="id-course-row__stats">
        <div><FiUsers size={12} /> {course.stats.students.toLocaleString()} students</div>
        <div><MdOutlineOndemandVideo size={12} /> {course.stats.lectures} lectures</div>
      </div>
      <StarBar value={course.stats.avgRating} />
      <div className="id-course-row__revenue">
        <span>{formatVnd(course.price * course.stats.students * 0.7)} ₫</span>
        <small>est. revenue</small>
      </div>
      <div className="id-course-row__actions">
        <button className="id-btn id-btn--sm id-btn--primary" onClick={onEdit}><FiEdit2 /> Edit</button>
        <button className="id-btn id-btn--sm id-btn--ghost" onClick={onView}><FiEye /></button>
      </div>
    </div>
  );
}

// ─── Top performer card ───────────────────────────────────────────────────────

function TopCourse({ course, rank }: { course: Course; rank: number }) {
  return (
    <div className="id-top-course">
      <span className="id-top-course__rank">#{rank}</span>
      <img src={getCourseImageUrl(course.filename)} alt={course.title} className="id-top-course__img"
        onError={(e) => { (e.target as HTMLImageElement).src = "https://s.udemycdn.com/course/750x422/placeholder.jpg"; }} />
      <div className="id-top-course__info">
        <span className="id-top-course__title">{course.title.length > 40 ? course.title.slice(0, 38) + "…" : course.title}</span>
        <span className="id-top-course__meta">{course.stats.students} students · ★ {course.stats.avgRating.toFixed(1)}</span>
      </div>
      <span className="id-top-course__rev">{formatVnd(course.price * course.stats.students * 0.7)} ₫</span>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function InstructorDashboard() {
  const navigate = useNavigate();
  const instructorId = localStorage.getItem("userId");
  const role = localStorage.getItem("role");

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  // HashRouter: location.search is always "" because the query string sits
  // inside the hash fragment — URLSearchParams cannot read it.
  // Plain useState is the correct solution here.
  const [activeTab, setActiveTab] = useState<"overview" | "courses" | "revenue" | "withdrawal">("overview");
  const [listMode,  setListMode]  = useState<"grid" | "list">("grid");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [view, setView] = useState<"dashboard" | "curriculum">("dashboard");

  useEffect(() => {
    if (!instructorId || role !== "instructor") { navigate("/login"); return; }
    fetchCourses();
  }, []);

  async function fetchCourses() {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/instructor/my-courses/${instructorId}`);
      setCourses(res.data.courses ?? []);
    } finally { setLoading(false); }
  }

  function openCurriculum(course: Course) {
    setSelectedCourse(course);
    setView("curriculum");
  }

  // ── Aggregate stats ──────────────────────────────────────────────────────
  const totalStudents   = courses.reduce((a, c) => a + c.stats.students, 0);
  const totalRevenue    = courses.reduce((a, c) => a + c.price * c.stats.students * 0.7, 0);
  const totalLectures   = courses.reduce((a, c) => a + c.stats.lectures, 0);
  const avgRating       = courses.length
    ? courses.reduce((a, c) => a + c.stats.avgRating, 0) / courses.length
    : 0;
  const revenueData     = buildRevenueData(courses);
  const topCourses      = [...courses].sort((a, b) => b.stats.students - a.stats.students).slice(0, 5);

  // ── Curriculum view ──────────────────────────────────────────────────────
  if (view === "curriculum" && selectedCourse) {
    return (
      <div className="id-page">
        <div className="id-topbar">
          <button className="id-back-btn" onClick={() => setView("dashboard")}>
            ← Back to Dashboard
          </button>
          <div className="id-topbar__info">
            <span className="id-topbar__label">Editing curriculum</span>
            <h2 className="id-topbar__title">{selectedCourse.title}</h2>
          </div>
          <button className="id-btn id-btn--ghost id-btn--sm" onClick={() => navigate(`/course-detail/${selectedCourse.id}`)}>
            <FiEye /> Preview Course
          </button>
        </div>
        <div className="id-content">
          <CurriculumEditor courseId={selectedCourse.id} />
        </div>
      </div>
    );
  }

  // ── Dashboard view ───────────────────────────────────────────────────────
  return (
    <div className="id-page">

      {/* ── Page header ── */}
      <div className="id-dashboard-header">
        <div className="id-dashboard-header__left">
          <div className="id-dashboard-header__avatar">
            {(localStorage.getItem("userId") ?? "I").charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="id-dashboard-header__title">Instructor Dashboard</h1>
            <p className="id-dashboard-header__sub">
              <FiCalendar size={12} />
              {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>
        <button className="id-btn id-btn--primary" onClick={() => navigate("/create-course")}>
          <FiPlus /> Create New Course
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="id-tabs">
        {(["overview", "courses", "revenue", "withdrawal"] as const).map(t => (
          <button key={t} className={`id-tab ${activeTab === t ? "id-tab--active" : ""}`}
            onClick={() => setActiveTab(t)}>
            {t === "overview" && <FiBarChart2 size={14} />}
            {t === "courses" && <FiBookOpen size={14} />}
            {t === "revenue" && <FiDollarSign size={14} />}
            {t === "withdrawal" && <FiArrowDownLeft size={14} />}
            {t === "withdrawal" ? "Withdraw" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="id-loading-spin" style={{ padding: "4rem", justifyContent: "center" }}>
          <FiLoader className="spin" size={24} />
          <span>Loading your courses...</span>
        </div>
      ) : courses.length === 0 ? (

        /* ── Empty state ── */
        <div className="id-empty-dashboard">
          <div className="id-empty-dashboard__icon">
            <FiBookOpen />
          </div>
          <h2>You don't have any courses yet</h2>
          <p>Get started by creating your first course and sharing your knowledge with learners worldwide.</p>
          <button className="id-btn id-btn--primary id-btn--lg" onClick={() => navigate("/create-course")}>
            <FiPlus /> Create a course
          </button>
        </div>

      ) : (
        <div className="id-dashboard-body">

          {/* ════════════════ OVERVIEW TAB ════════════════ */}
          {activeTab === "overview" && (
            <>
              {/* Stat cards */}
              <div className="id-stats-grid">
                <StatCard icon={<FiDollarSign />} label="Total Revenue (Est.)"
                  value={`${formatVnd(totalRevenue)} ₫`}
                  sub="+12% vs last month" trend="up" color="#22c55e" />
                <StatCard icon={<FiUsers />} label="Total Students"
                  value={totalStudents.toLocaleString()}
                  sub="+8% vs last month" trend="up" color="#6366f1" />
                <StatCard icon={<FiBookOpen />} label="Published Courses"
                  value={String(courses.length)}
                  sub={`${totalLectures} lectures total`} color="#f59e0b" />
                <StatCard icon={<FiStar />} label="Average Rating"
                  value={avgRating.toFixed(2)}
                  sub="Across all courses" trend="neutral" color="#f43f5e" />
              </div>

              {/* Chart + top courses */}
              <div className="id-overview-grid">
                <div className="id-card">
                  <div className="id-card__head">
                    <h3><FiTrendingUp /> Revenue & Enrollment</h3>
                    <span className="id-card__sub">Last 6 months</span>
                  </div>
                  <RevenueBarChart data={revenueData} />
                </div>

                <div className="id-card">
                  <div className="id-card__head">
                    <h3><FiAward /> Top Performing Courses</h3>
                    <span className="id-card__sub">By student count</span>
                  </div>
                  <div className="id-top-list">
                    {topCourses.length === 0 ? (
                      <p className="id-empty" style={{ padding: "1rem" }}>No data yet</p>
                    ) : (
                      topCourses.map((c, i) => (
                        <TopCourse key={c.id} course={c} rank={i + 1} />
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Per-course breakdown */}
              <div className="id-card">
                <div className="id-card__head">
                  <h3><FiBarChart2 /> Course Breakdown</h3>
                </div>
                <div className="id-breakdown">
                  {courses.map(c => {
                    const share = totalRevenue > 0 ? ((c.price * c.stats.students * 0.7) / totalRevenue) * 100 : 0;
                    return (
                      <div key={c.id} className="id-breakdown__row">
                        <span className="id-breakdown__name">{c.title.length > 36 ? c.title.slice(0, 34) + "…" : c.title}</span>
                        <div className="id-breakdown__bar-wrap">
                          <div className="id-breakdown__bar" style={{ width: `${share}%` }} />
                        </div>
                        <span className="id-breakdown__val">{share.toFixed(1)}%</span>
                        <span className="id-breakdown__rev">{formatVnd(c.price * c.stats.students * 0.7)} ₫</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ════════════════ COURSES TAB ════════════════ */}
          {activeTab === "courses" && (
            <>
              <div className="id-courses-toolbar">
                <span className="id-courses-toolbar__count">{courses.length} course{courses.length !== 1 ? "s" : ""}</span>
                <div className="id-courses-toolbar__right">
                  <button
                    className={`id-view-btn ${listMode === "grid" ? "id-view-btn--active" : ""}`}
                    onClick={() => setListMode("grid")} title="Grid view"><FiGrid />
                  </button>
                  <button
                    className={`id-view-btn ${listMode === "list" ? "id-view-btn--active" : ""}`}
                    onClick={() => setListMode("list")} title="List view"><FiList />
                  </button>
                </div>
              </div>

              {listMode === "grid" ? (
                <div className="id-courses-grid">
                  {courses.map(c => (
                    <CourseCard key={c.id} course={c}
                      onEdit={() => openCurriculum(c)}
                      onView={() => navigate(`/course-detail/${c.id}`)}
                    />
                  ))}
                </div>
              ) : (
                <div className="id-courses-list">
                  {courses.map(c => (
                    <CourseRow key={c.id} course={c}
                      onEdit={() => openCurriculum(c)}
                      onView={() => navigate(`/course-detail/${c.id}`)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ════════════════ REVENUE TAB ════════════════ */}
          {activeTab === "revenue" && (
            <>
              <div className="id-stats-grid">
                <StatCard icon={<FiDollarSign />} label="Total Est. Revenue"
                  value={`${formatVnd(totalRevenue)} ₫`} color="#22c55e" />
                <StatCard icon={<FiTrendingUp />} label="Avg Revenue / Course"
                  value={courses.length ? `${formatVnd(totalRevenue / courses.length)} ₫` : "—"} color="#6366f1" />
                <StatCard icon={<FiUsers />} label="Revenue / Student"
                  value={totalStudents ? `${formatVnd(totalRevenue / totalStudents)} ₫` : "—"} color="#f59e0b" />
                <StatCard icon={<FiBarChart2 />} label="Platform Fee (est. 30%)"
                  value={`${formatVnd(totalRevenue * 0.3 / 0.7)} ₫`} color="#f43f5e" />
              </div>

              <div className="id-card">
                <div className="id-card__head">
                  <h3><FiTrendingUp /> Monthly Revenue & Enrollments</h3>
                  <span className="id-card__sub">Estimated based on course pricing</span>
                </div>
                <RevenueBarChart data={revenueData} />
              </div>

              <div className="id-card">
                <div className="id-card__head">
                  <h3><FiBookOpen /> Revenue by Course</h3>
                </div>
                <div className="id-rev-table">
                  <div className="id-rev-table__head">
                    <span>Course</span>
                    <span>Price</span>
                    <span>Students</span>
                    <span>Est. Revenue</span>
                    <span>Share</span>
                  </div>
                  {courses.sort((a, b) => (b.price * b.stats.students) - (a.price * a.stats.students)).map(c => {
                    const rev = c.price * c.stats.students * 0.7;
                    const share = totalRevenue > 0 ? (rev / totalRevenue * 100).toFixed(1) : "0";
                    return (
                      <div key={c.id} className="id-rev-table__row">
                        <div className="id-rev-table__course">
                          <img src={getCourseImageUrl(c.filename)} alt=""
                            onError={(e) => { (e.target as HTMLImageElement).src = "https://s.udemycdn.com/course/750x422/placeholder.jpg"; }} />
                          <div>
                            <span>{c.title.length > 40 ? c.title.slice(0, 38) + "…" : c.title}</span>
                            <small>{c.level} · {c.language}</small>
                          </div>
                        </div>
                        <span className="id-rev-table__price">{formatVnd(c.price)} ₫</span>
                        <span className="id-rev-table__students">{c.stats.students.toLocaleString()}</span>
                        <span className="id-rev-table__rev">{formatVnd(rev)} ₫</span>
                        <div className="id-rev-table__share">
                          <div className="id-rev-table__share-bar" style={{ width: `${share}%` }} />
                          <span>{share}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {activeTab === "withdrawal" && instructorId && (
            <WithdrawalTab instructorId={instructorId} />
          )}
        </div>
      )}
    </div>
  );
}