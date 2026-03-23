import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiPlay, FiBook, FiClock, FiAward, FiSearch } from "react-icons/fi";
import axiosInstance from "../../lib/axios";
import { getCourseImageUrl } from "../../utils/courseImage";
import "../../style/components/_my_courses.scss";
import { session } from "../../lib/storage";

interface LastLecture { id: string; title: string; }

interface MyCourse {
  courseId: string;
  title: string;
  courseSub: string;
  path: string;
  level: string;
  category: string;
  instructorName: string;
  purchasedAt: string;
  totalLectures: number;
  completedLectures: number;
  progressPct: number;
  lastLecture: LastLecture | null;
}

export default function MyCoursesPage() {
  const navigate = useNavigate();
  const userId = session.getUserId();

  const [courses, setCourses] = useState<MyCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!userId) { navigate("/login"); return; }
    axiosInstance.get(`/learning/my-courses/${userId}`)
      .then(r => setCourses(r.data.courses ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = courses.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.instructorName?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="mc-page">
      <div className="mc-loading">
        <div className="mc-loading__spinner" />
        <p>Loading your courses...</p>
      </div>
    </div>
  );

  return (
    <div className="mc-page">
      {/* Header */}
      <div className="mc-header">
        <div className="mc-header__text">
          <h1>My courses</h1>
          <p>{courses.length} purchased courses</p>
        </div>
        {courses.length > 0 && (
          <div className="mc-search">
            <FiSearch />
            <input
              placeholder="Search courses..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Empty */}
      {courses.length === 0 ? (
        <div className="mc-empty">
          <FiBook />
          <h3>You haven't purchased any courses yet</h3>
          <p>Explore and buy courses to start learning</p>
          <button onClick={() => navigate("/")}>Explore courses</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mc-empty">
          <FiSearch />
          <h3>No courses found</h3>
          <p>Try searching with a different keyword</p>
        </div>
      ) : (
        <div className="mc-grid">
          {filtered.map(course => (
            <div key={course.courseId} className="mc-card">
              {/* Thumbnail */}
              <div className="mc-card__img-wrap">
                <img
                  src={getCourseImageUrl(course.path)}
                  alt={course.title}
                  onError={e => {
                    (e.target as HTMLImageElement).src =
                      "https://s.udemycdn.com/course/750x422/placeholder.jpg";
                  }}
                />
                {/* Progress overlay */}
                <div className="mc-card__progress-bar">
                  <div
                    className="mc-card__progress-fill"
                    style={{ width: `${course.progressPct}%` }}
                  />
                </div>
                {course.progressPct === 100 && (
                  <div className="mc-card__completed-badge">
                    <FiAward /> Completed
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="mc-card__body">
                <h3 className="mc-card__title">{course.title}</h3>
                <p className="mc-card__instructor">{course.instructorName}</p>

                {/* Progress */}
                <div className="mc-card__stats">
                  <span><FiBook /> {course.completedLectures}/{course.totalLectures} lectures</span>
                  <span className={`mc-card__pct ${course.progressPct === 100 ? "mc-card__pct--done" : ""}`}>
                    {course.progressPct}%
                  </span>
                </div>

                {/* Last lecture */}
                {course.lastLecture && course.progressPct < 100 && (
                  <p className="mc-card__last">
                    <FiClock /> Currently learning: <em>{course.lastLecture.title}</em>
                  </p>
                )}

                <button
                  className="mc-card__btn"
                  onClick={() => navigate(`/learn/${course.courseId}`)}
                >
                  <FiPlay />
                  {course.progressPct === 0
                    ? "Start learning"
                    : course.progressPct === 100
                    ? "Review"
                    : "Continue learning"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}