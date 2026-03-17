import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiUpload, FiX, FiCheck, FiArrowLeft,
  FiBookOpen, FiDollarSign, FiGlobe, FiTag,
  FiAlignLeft, FiUser,
} from "react-icons/fi";
import axiosInstance from "../../lib/axios";
import "../../style/components/_create_course.scss";

// ─── Constants (khớp đúng validation backend) ─────────────────────────────────

const LANGUAGES = ["English", "Hindi", "French", "aymur"];
const LEVELS    = ["Beginner Level", "Intermediate Level", "Expert", "All Level"];
const CATEGORIES = [
  "Web Development", "Mobile Development", "Data Science",
  "Machine Learning", "Design", "Business", "Marketing",
  "Photography", "Music", "Health & Fitness", "Other",
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateCoursePage() {
  const navigate  = useNavigate();
  const fileRef   = useRef<HTMLInputElement>(null);
  const instructorId = localStorage.getItem("userId") ?? "";

  const [form, setForm] = useState({
    title:       "",
    author:      "",
    courseSub:   "",
    description: "",
    price:       "",
    language:    "English",
    level:       "Beginner Level",
    category:    "Web Development",
  });

  const [image,    setImage]    = useState<File | null>(null);
  const [preview,  setPreview]  = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  // ── Helpers ──────────────────────────────────────────────────────────────

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    setError("");
  }

  function handleImageChange(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Chỉ chấp nhận file ảnh (jpg, png, webp...)");
      return;
    }
    setImage(file);
    setPreview(URL.createObjectURL(file));
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validate(): string {
    if (!form.title.trim())            return "Vui lòng nhập tiêu đề khóa học";
    if (form.title.length > 56)        return "Tiêu đề tối đa 56 ký tự";
    if (!form.author.trim())           return "Vui lòng nhập tên tác giả";
    if (form.author.length > 78)       return "Tên tác giả tối đa 78 ký tự";
    if (!form.courseSub.trim())        return "Vui lòng nhập mô tả ngắn";
    if (form.courseSub.length > 56)    return "Mô tả ngắn tối đa 56 ký tự";
    if (!form.description.trim())      return "Vui lòng nhập mô tả chi tiết";
    if (form.description.length > 200) return "Mô tả tối đa 200 ký tự";
    if (!form.price)                   return "Vui lòng nhập giá khóa học";
    if (isNaN(Number(form.price)) || Number(form.price) < 0) return "Giá không hợp lệ";
    if (!image)                        return "Vui lòng upload ảnh thumbnail";
    return "";
  }

  // ── Submit ────────────────────────────────────────────────────────────────

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
    fd.append("catogory",    form.category); // ← typo giữ đúng như backend
    fd.append("instructor",  instructorId);
    fd.append("image",       image!);

    try {
      const res = await axiosInstance.post(
        "/courseCreation/course-creation-form",
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setSuccess("Tạo khóa học thành công!");
      setTimeout(() => navigate("/instructor-dashboard"), 1200);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ??
        e?.response?.data?.error ??
        "Tạo khóa học thất bại. Vui lòng thử lại."
      );
    } finally {
      setLoading(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="cc-page">
      {/* Header */}
      <div className="cc-header">
        <button className="cc-back" onClick={() => navigate("/instructor-dashboard")}>
          <FiArrowLeft /> Quay lại
        </button>
        <div>
          <h1 className="cc-header__title">Tạo khóa học mới</h1>
          <p className="cc-header__sub">Điền đầy đủ thông tin để đăng tải khóa học</p>
        </div>
      </div>

      <div className="cc-body">
        {/* LEFT — Form */}
        <div className="cc-form">

          {/* Thumbnail upload */}
          <div className="cc-section">
            <label className="cc-label"><FiUpload /> Ảnh thumbnail <span className="cc-req">*</span></label>
            <div
              className={`cc-dropzone ${preview ? "cc-dropzone--has" : ""}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) handleImageChange(f);
              }}
            >
              {preview ? (
                <>
                  <img src={preview} alt="preview" className="cc-dropzone__img" />
                  <button
                    className="cc-dropzone__remove"
                    onClick={e => { e.stopPropagation(); setImage(null); setPreview(null); }}
                  ><FiX /></button>
                </>
              ) : (
                <div className="cc-dropzone__placeholder">
                  <FiUpload className="cc-dropzone__icon" />
                  <p>Kéo thả hoặc <span>chọn ảnh</span></p>
                  <small>JPG, PNG, WEBP — tỉ lệ 16:9 khuyến nghị</small>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageChange(f); e.target.value = ""; }}
            />
          </div>

          {/* Title */}
          <div className="cc-field">
            <label className="cc-label"><FiBookOpen /> Tiêu đề <span className="cc-req">*</span></label>
            <input
              className="cc-input"
              placeholder="VD: Lập trình React từ cơ bản đến nâng cao"
              value={form.title}
              maxLength={56}
              onChange={e => set("title", e.target.value)}
            />
            <span className="cc-counter">{form.title.length}/56</span>
          </div>

          {/* Sub title */}
          <div className="cc-field">
            <label className="cc-label"><FiAlignLeft /> Mô tả ngắn <span className="cc-req">*</span></label>
            <input
              className="cc-input"
              placeholder="VD: Xây dựng ứng dụng web hiện đại với React 18"
              value={form.courseSub}
              maxLength={56}
              onChange={e => set("courseSub", e.target.value)}
            />
            <span className="cc-counter">{form.courseSub.length}/56</span>
          </div>

          {/* Description */}
          <div className="cc-field">
            <label className="cc-label"><FiAlignLeft /> Mô tả chi tiết <span className="cc-req">*</span></label>
            <textarea
              className="cc-input cc-textarea"
              placeholder="Mô tả nội dung, đối tượng học viên, những gì học viên sẽ đạt được..."
              value={form.description}
              maxLength={200}
              rows={4}
              onChange={e => set("description", e.target.value)}
            />
            <span className="cc-counter">{form.description.length}/200</span>
          </div>

          {/* Author */}
          <div className="cc-field">
            <label className="cc-label"><FiUser /> Tên tác giả / giảng viên <span className="cc-req">*</span></label>
            <input
              className="cc-input"
              placeholder="VD: Nguyen Van A"
              value={form.author}
              maxLength={78}
              onChange={e => set("author", e.target.value)}
            />
          </div>

          {/* Price */}
          <div className="cc-field">
            <label className="cc-label"><FiDollarSign /> Giá (VNĐ) <span className="cc-req">*</span></label>
            <input
              className="cc-input"
              type="number"
              placeholder="VD: 599000"
              value={form.price}
              min={0}
              onChange={e => set("price", e.target.value)}
            />
            {form.price && !isNaN(Number(form.price)) && (
              <span className="cc-price-hint">
                Giá gốc: {Number(form.price).toLocaleString("vi-VN")} ₫ &nbsp;·&nbsp;
                Giá sale: {(Number(form.price) * 0.5).toLocaleString("vi-VN")} ₫
              </span>
            )}
          </div>

          {/* Row: Language + Level */}
          <div className="cc-row">
            <div className="cc-field">
              <label className="cc-label"><FiGlobe /> Ngôn ngữ</label>
              <select className="cc-input cc-select" value={form.language} onChange={e => set("language", e.target.value)}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div className="cc-field">
              <label className="cc-label">📊 Cấp độ</label>
              <select className="cc-input cc-select" value={form.level} onChange={e => set("level", e.target.value)}>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Category */}
          <div className="cc-field">
            <label className="cc-label"><FiTag /> Danh mục</label>
            <select className="cc-input cc-select" value={form.category} onChange={e => set("category", e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Error / Success */}
          {error   && <div className="cc-alert cc-alert--error"><FiX /> {error}</div>}
          {success && <div className="cc-alert cc-alert--success"><FiCheck /> {success}</div>}

          {/* Submit */}
          <button
            className={`cc-submit ${loading ? "cc-submit--loading" : ""}`}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <span className="cc-spinner" />
            ) : (
              <><FiCheck /> Tạo khóa học</>
            )}
          </button>
        </div>

        {/* RIGHT — Preview card */}
        <div className="cc-preview">
          <p className="cc-preview__label">Xem trước</p>
          <div className="cc-preview__card">
            <div className="cc-preview__img-wrap">
              {preview
                ? <img src={preview} alt="thumb" />
                : <div className="cc-preview__img-placeholder"><FiBookOpen /></div>
              }
              <span className="cc-preview__level">{form.level || "Level"}</span>
            </div>
            <div className="cc-preview__body">
              <p className="cc-preview__title">{form.title || "Tiêu đề khóa học"}</p>
              <p className="cc-preview__sub">{form.courseSub || "Mô tả ngắn"}</p>
              <p className="cc-preview__author">{form.author || "Tên giảng viên"}</p>
              <div className="cc-preview__price">
                {form.price && !isNaN(Number(form.price))
                  ? <>{(Number(form.price) * 0.5).toLocaleString("vi-VN")} ₫ <s>{Number(form.price).toLocaleString("vi-VN")} ₫</s></>
                  : "—"
                }
              </div>
              <div className="cc-preview__tags">
                <span>{form.language}</span>
                <span>{form.category}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}