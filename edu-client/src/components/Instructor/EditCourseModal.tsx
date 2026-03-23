// src/components/Instructor/EditCourseModal.tsx
import { useRef, useState } from "react";
import {
  FiX, FiUpload, FiCheck, FiBookOpen,
  FiAlignLeft, FiUser, FiDollarSign, FiGlobe, FiTag,
} from "react-icons/fi";
import axiosInstance from "../../lib/axios";
import { getCourseImageUrl } from "../../utils/courseImage";
import { useToast } from "../../context/toast";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EditableCourse {
  id:          string;
  title:       string;
  author:      string;
  courseSub:   string;
  description: string;
  price:       number;
  language:    string;
  level:       string;
  category:    string;
  filename:    string;
}

interface Props {
  course:    EditableCourse;
  onSuccess: (updated: Partial<EditableCourse>) => void;
  onClose:   () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LANGUAGES  = ["English", "Hindi", "French", "aymur"];
const LEVELS     = ["Beginner Level", "Intermediate Level", "Expert", "All Level"];
const CATEGORIES = [
  "Web Development", "Mobile Development", "Data Science", "Machine Learning",
  "Design", "Business", "Marketing", "Photography", "Music",
  "Health & Fitness", "Programing Language", "Other",
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function EditCourseModal({ course, onSuccess, onClose }: Props) {
  const toast   = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title:       course.title,
    author:      course.author,
    courseSub:   course.courseSub,
    description: course.description,
    price:       String(course.price),
    language:    course.language,
    level:       course.level,
    category:    course.category,
  });

  const [image,   setImage]   = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    setError("");
  }

  function handleImageChange(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Only image files accepted (jpg, png, webp, ...)");
      return;
    }
    setImage(file);
    setPreview(URL.createObjectURL(file));
  }

  function validate(): string {
    if (!form.title.trim())            return "Title is required";
    if (form.title.length > 56)        return "Title max 56 characters";
    if (!form.author.trim())           return "Author is required";
    if (form.author.length > 78)       return "Author max 78 characters";
    if (!form.courseSub.trim())        return "Short description is required";
    if (form.courseSub.length > 56)    return "Short description max 56 characters";
    if (!form.description.trim())      return "Description is required";
    if (form.description.length > 5000) return "Description max 5000 characters";
    if (!form.price)                   return "Price is required";
    if (isNaN(Number(form.price)) || Number(form.price) < 0) return "Invalid price";
    return "";
  }

  async function handleSubmit() {
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    setError("");

    const fd = new FormData();
    fd.append("title",       form.title.trim());
    fd.append("author",      form.author.trim());
    fd.append("courseSub",   form.courseSub.trim());
    fd.append("description", form.description.trim());
    fd.append("price",       form.price);
    fd.append("language",    form.language);
    fd.append("level",       form.level);
    fd.append("catogory",    form.category);
    if (image) fd.append("image", image);

    try {
      await axiosInstance.patch(
        `/instructor/courses/${course.id}`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      toast.success("Course updated!", `"${form.title}" saved successfully.`);
      onSuccess({
        title:       form.title.trim(),
        author:      form.author.trim(),
        courseSub:   form.courseSub.trim(),
        description: form.description.trim(),
        price:       Number(form.price),
        language:    form.language,
        level:       form.level,
        category:    form.category,
        ...(image ? { filename: preview ?? course.filename } : {}),
      });
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ?? "Update failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const currentImg = preview ?? getCourseImageUrl(course.filename);
  const priceNum   = Number(form.price);

  return (
    <>
      {/* Overlay */}
      <div
        onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(2,6,23,0.85)",
          backdropFilter: "blur(5px)",
          zIndex: 9990,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px",
        }}
      >
        {/* Modal */}
        <div style={{
          width: "100%", maxWidth: 860,
          maxHeight: "90vh", overflowY: "auto",
          background: "#0d1527",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 18,
          boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
          fontFamily: '"Inter", system-ui, sans-serif',
        }}>

          {/* ── Header ── */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "20px 24px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            position: "sticky", top: 0, background: "#0d1527", zIndex: 2,
          }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: "#f1f5f9", margin: 0 }}>
                Edit Course
              </h2>
              <p style={{ fontSize: 12, color: "#475569", margin: "3px 0 0" }}>
                {course.title}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              style={{
                width: 32, height: 32, borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent", color: "#475569",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <FiX size={15} />
            </button>
          </div>

          {/* ── Body: two-column layout ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, padding: "24px" }}>

            {/* LEFT: Form fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Title */}
              <Field label="Title" req icon={<FiBookOpen size={13} />}>
                <input
                  style={IS.input}
                  value={form.title}
                  maxLength={56}
                  onChange={e => set("title", e.target.value)}
                  placeholder="e.g. React from basics to advanced"
                />
                <Counter cur={form.title.length} max={56} />
              </Field>

              {/* Short description */}
              <Field label="Short description" req icon={<FiAlignLeft size={13} />}>
                <input
                  style={IS.input}
                  value={form.courseSub}
                  maxLength={56}
                  onChange={e => set("courseSub", e.target.value)}
                  placeholder="e.g. Build modern web apps with React 18"
                />
                <Counter cur={form.courseSub.length} max={56} />
              </Field>

              {/* Description */}
              <Field label="Detailed description" req icon={<FiAlignLeft size={13} />}>
                <textarea
                  style={{ ...IS.input, height: 160, resize: "vertical", lineHeight: 1.5 }}
                  value={form.description}
                  maxLength={5000}
                  rows={7}
                  onChange={e => set("description", e.target.value)}
                  placeholder={"Mô tả khóa học của bạn...\n\nTip: Dùng dòng trống để tách đoạn.\nDùng - hoặc • ở đầu dòng để tạo danh sách.\nDòng ngắn kết thúc bằng dấu : sẽ thành tiêu đề.\n\nVí dụ:\nKhóa học này dành cho ai:\n- Người mới bắt đầu\n- Lập trình viên muốn nâng cao"}
                />
                <Counter cur={form.description.length} max={5000} />
              </Field>

              {/* Author */}
              <Field label="Author / Instructor" req icon={<FiUser size={13} />}>
                <input
                  style={IS.input}
                  value={form.author}
                  maxLength={78}
                  onChange={e => set("author", e.target.value)}
                  placeholder="e.g. Nguyen Van A"
                />
              </Field>

              {/* Price */}
              <Field label="Price (VND)" req icon={<FiDollarSign size={13} />}>
                <input
                  style={IS.input}
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={e => set("price", e.target.value)}
                  placeholder="e.g. 599000"
                />
                {form.price && !isNaN(priceNum) && priceNum > 0 && (
                  <p style={IS.hint}>
                    Original: {priceNum.toLocaleString("vi-VN")} ₫ &nbsp;·&nbsp;
                    Sale (50%): {(priceNum * 0.5).toLocaleString("vi-VN")} ₫
                  </p>
                )}
              </Field>

              {/* Language + Level row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Language" icon={<FiGlobe size={13} />}>
                  <select style={IS.select} value={form.language} onChange={e => set("language", e.target.value)}>
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </Field>
                <Field label="Level" icon={<FiTag size={13} />}>
                  <select style={IS.select} value={form.level} onChange={e => set("level", e.target.value)}>
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </Field>
              </div>

              {/* Category */}
              <Field label="Category" icon={<FiTag size={13} />}>
                <select style={IS.select} value={form.category} onChange={e => set("category", e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>

            {/* RIGHT: Thumbnail */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={IS.fieldLabel}>
                <FiUpload size={12} /> Thumbnail image
              </label>

              {/* Current / preview image */}
              <div
                style={{
                  position: "relative",
                  borderRadius: 12, overflow: "hidden",
                  border: "2px dashed rgba(99,102,241,0.3)",
                  background: "#080f1e",
                  cursor: "pointer",
                  aspectRatio: "16/9",
                }}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) handleImageChange(f);
                }}
              >
                <img
                  src={currentImg}
                  alt="thumbnail"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  onError={e => {
                    (e.target as HTMLImageElement).src =
                      "https://s.udemycdn.com/course/750x422/placeholder.jpg";
                  }}
                />
                {/* Overlay on hover */}
                <div style={{
                  position: "absolute", inset: 0,
                  background: "rgba(2,6,23,0.6)",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: 8, opacity: 0, transition: "opacity 0.2s",
                }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "0")}
                >
                  <FiUpload size={24} style={{ color: "#fff" }} />
                  <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>
                    Click or drag to replace
                  </span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>JPG · PNG · WEBP</span>
                </div>

                {/* "Changed" badge */}
                {image && (
                  <span style={{
                    position: "absolute", top: 8, right: 8,
                    background: "#6366f1", color: "#fff",
                    fontSize: 10, fontWeight: 700, padding: "2px 8px",
                    borderRadius: 999,
                  }}>
                    New image
                  </span>
                )}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleImageChange(f);
                  e.target.value = "";
                }}
              />

              {image && (
                <button
                  type="button"
                  onClick={() => { setImage(null); setPreview(null); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                    color: "#64748b", fontSize: 12, padding: "6px 12px",
                    borderRadius: 7, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <FiX size={11} /> Remove new image
                </button>
              )}

              {/* Preview card */}
              <div style={{
                marginTop: 8,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 10, padding: "12px 14px",
              }}>
                <p style={{ fontSize: 10, color: "#334155", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
                  Preview card
                </p>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", margin: "0 0 3px", lineHeight: 1.35 }}>
                  {form.title || "Course title"}
                </p>
                <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 8px" }}>
                  {form.author || "Instructor name"}
                </p>
                <p style={{ fontSize: 12, color: "#475569", margin: "0 0 8px", lineHeight: 1.4 }}>
                  {form.courseSub || "Short description"}
                </p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={IS.previewTag}>{form.level}</span>
                  <span style={IS.previewTag}>{form.language}</span>
                  <span style={IS.previewTag}>{form.category}</span>
                </div>
                {form.price && !isNaN(priceNum) && (
                  <p style={{ fontSize: 15, fontWeight: 800, color: "#f97316", margin: "10px 0 0" }}>
                    {priceNum.toLocaleString("vi-VN")} ₫
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 24px 20px",
            borderTop: "1px solid rgba(255,255,255,0.07)",
          }}>
            {error
              ? <p style={{ fontSize: 13, color: "#f87171", margin: 0 }}>⚠ {error}</p>
              : <span />
            }
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={onClose}
                disabled={loading}
                style={{
                  padding: "9px 18px", borderRadius: 9,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "transparent", color: "#64748b",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "9px 22px", borderRadius: 9, border: "none",
                  background: loading ? "#4f46e5" : "linear-gradient(135deg,#6366f1,#4f46e5)",
                  color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  opacity: loading ? 0.75 : 1,
                  boxShadow: "0 4px 14px rgba(99,102,241,0.35)",
                }}
              >
                {loading
                  ? <><span style={IS.spinner} /> Saving...</>
                  : <><FiCheck size={13} /> Save changes</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, req, icon, children }: {
  label: string; req?: boolean; icon?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={IS.fieldLabel}>
        {icon} {label} {req && <span style={{ color: "#f43f5e" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function Counter({ cur, max }: { cur: number; max: number }) {
  const pct = cur / max;
  return (
    <span style={{
      fontSize: 11,
      color: pct > 0.9 ? "#f87171" : pct > 0.75 ? "#fbbf24" : "#334155",
      alignSelf: "flex-end",
    }}>
      {cur}/{max}
    </span>
  );
}

// ─── Inline styles ────────────────────────────────────────────────────────────

const IS: Record<string, React.CSSProperties> = {
  fieldLabel: {
    fontSize: 11, fontWeight: 600, color: "#64748b",
    letterSpacing: "0.02em",
    display: "flex", alignItems: "center", gap: 5,
  },
  input: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 9, color: "#e2e8f0",
    padding: "9px 13px", fontSize: 13,
    fontFamily: "inherit", outline: "none",
    width: "100%", boxSizing: "border-box" as const,
    transition: "border-color 0.15s, box-shadow 0.15s",
  },
  select: {
    background: "#080f1e",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 9, color: "#e2e8f0",
    padding: "9px 13px", fontSize: 13,
    fontFamily: "inherit", outline: "none",
    width: "100%", cursor: "pointer",
  },
  hint: {
    fontSize: 11, color: "#475569", margin: "4px 0 0",
  },
  previewTag: {
    fontSize: 10, fontWeight: 600,
    padding: "2px 8px", borderRadius: 999,
    background: "rgba(99,102,241,0.1)",
    color: "#818cf8",
    border: "1px solid rgba(99,102,241,0.2)",
  },
  spinner: {
    width: 14, height: 14, borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "#fff",
    animation: "spin 0.7s linear infinite",
    display: "inline-block",
  },
};