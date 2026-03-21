// src/components/pages/EditProfilePage.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdOutlineEmail,
  MdLockOutline,
  MdOutlinePerson,
  MdOutlineEdit,
  MdCheck,
  MdClose,
  MdVisibility,
  MdVisibilityOff,
} from "react-icons/md";
import { RiShieldKeyholeLine } from "react-icons/ri";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../context/toast";
import "../../style/components/_edit_profile.scss";

// ─── Types ────────────────────────────────────────────────────────────────────
interface UserInfo {
  name:   string;
  email:  string;
  role:   string;
  status: string;
}

// ─── Avatar initials ──────────────────────────────────────────────────────────
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

// ─── Avatar colour based on name ─────────────────────────────────────────────
const AVATAR_PALETTES = [
  ["#6366f1", "#4f46e5"],
  ["#8b5cf6", "#7c3aed"],
  ["#ec4899", "#db2777"],
  ["#14b8a6", "#0d9488"],
  ["#f59e0b", "#d97706"],
  ["#10b981", "#059669"],
];

function getAvatarGradient(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_PALETTES.length;
  const [a, b] = AVATAR_PALETTES[idx];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

// ─── Inline editable field ────────────────────────────────────────────────────
interface EditableFieldProps {
  label:       string;
  value:       string;
  onSave:      (val: string) => Promise<void>;
  icon:        React.ReactNode;
  placeholder: string;
  maxLength?:  number;
  multiline?:  boolean;
}

function EditableField({
  label, value, onSave, icon, placeholder, maxLength = 80, multiline = false,
}: EditableFieldProps) {
  // Guard: value có thể undefined khi user chưa load xong
  const safe = value ?? "";
  const [editing,  setEditing]  = useState(false);
  const [draft,    setDraft]    = useState(safe);
  const [saving,   setSaving]   = useState(false);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(safe); }, [safe]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const handleSave = async () => {
    if (draft.trim() === safe.trim()) { setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) handleSave();
    if (e.key === "Escape") { setDraft(safe); setEditing(false); }
  };

  return (
    <div className={`ep-field ${editing ? "ep-field--editing" : ""}`}>
      <div className="ep-field__label">
        <span className="ep-field__icon">{icon}</span>
        <span>{label}</span>
      </div>

      {editing ? (
        <div className="ep-field__edit-row">
          {multiline ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              className="ep-field__input ep-field__input--area"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={maxLength}
              rows={3}
              placeholder={placeholder}
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              className="ep-field__input"
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={maxLength}
              placeholder={placeholder}
            />
          )}
          <div className="ep-field__actions">
            <button
              className="ep-field__btn ep-field__btn--save"
              onClick={handleSave}
              disabled={saving}
              aria-label="Save"
            >
              {saving ? <span className="ep-spinner" /> : <MdCheck />}
            </button>
            <button
              className="ep-field__btn ep-field__btn--cancel"
              onClick={() => { setDraft(value); setEditing(false); }}
              aria-label="Cancel"
            >
              <MdClose />
            </button>
          </div>
          {maxLength && (
            <span className="ep-field__counter">{draft.length}/{maxLength}</span>
          )}
        </div>
      ) : (
        <div className="ep-field__display">
          <span className="ep-field__value">{safe || <em className="ep-field__empty">{placeholder}</em>}</span>
          <button
            className="ep-field__edit-btn"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${label}`}
          >
            <MdOutlineEdit />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Password section ─────────────────────────────────────────────────────────
function PasswordSection({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [open,     setOpen]     = useState(false);
  const [current,  setCurrent]  = useState("");
  const [next,     setNext]     = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showCur,  setShowCur]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [loading,  setLoading]  = useState(false);

  const strength = next.length === 0 ? 0
    : next.length < 6  ? 1
    : next.length < 10 ? 2
    : /[A-Z]/.test(next) && /[0-9]/.test(next) && /[^A-Za-z0-9]/.test(next) ? 4
    : 3;

  const strengthLabel = ["", "Weak", "Fair", "Strong", "Very strong"][strength];
  const strengthClass = ["", "weak", "fair", "strong", "great"][strength];

  const reset = () => { setCurrent(""); setNext(""); setConfirm(""); setOpen(false); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) { toast.error("No match", "The confirmation password does not match."); return; }
    if (next.length < 6)  { toast.warning("Too short", "Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      await axiosInstance.put("/auth/change-password", {
        current_password: current,
        new_password:     next,
      });
      toast.success("Password updated successfully!", "Use your new password on your next login.");
      reset();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error("Failed", msg ?? "Please check your current password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ep-password">
      <div className="ep-password__header" onClick={() => setOpen(v => !v)} role="button" tabIndex={0}
        onKeyDown={e => e.key === "Enter" && setOpen(v => !v)}>
        <div className="ep-password__label">
          <RiShieldKeyholeLine className="ep-password__icon" />
          <div>
            <span className="ep-password__title">Change password</span>
            <span className="ep-password__hint">Secure your account</span>
          </div>
        </div>
        <span className={`ep-password__chevron ${open ? "ep-password__chevron--open" : ""}`}>›</span>
      </div>

      {open && (
        <form className="ep-password__form" onSubmit={handleSubmit} noValidate>
          {/* Current password */}
          <div className="ep-pw-field">
            <label>Current password</label>
            <div className="ep-pw-field__wrap">
              <MdLockOutline className="ep-pw-field__icon" />
              <input
                type={showCur ? "text" : "password"}
                value={current}
                onChange={e => setCurrent(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button type="button" className="ep-pw-field__toggle"
                onClick={() => setShowCur(v => !v)} aria-label="Toggle visibility">
                {showCur ? <MdVisibilityOff /> : <MdVisibility />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="ep-pw-field">
            <label>New password</label>
            <div className="ep-pw-field__wrap">
              <MdLockOutline className="ep-pw-field__icon" />
              <input
                type={showNew ? "text" : "password"}
                value={next}
                onChange={e => setNext(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                required
              />
              <button type="button" className="ep-pw-field__toggle"
                onClick={() => setShowNew(v => !v)} aria-label="Toggle visibility">
                {showNew ? <MdVisibilityOff /> : <MdVisibility />}
              </button>
            </div>
            {next.length > 0 && (
              <div className="ep-strength">
                <div className="ep-strength__bars">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`ep-strength__bar ${strength >= i ? `ep-strength__bar--${strengthClass}` : ""}`} />
                  ))}
                </div>
                <span className={`ep-strength__label ep-strength__label--${strengthClass}`}>{strengthLabel}</span>
              </div>
            )}
          </div>

          {/* Confirm */}
          <div className="ep-pw-field">
            <label>Confirm new password</label>
            <div className={`ep-pw-field__wrap ${confirm && confirm !== next ? "ep-pw-field__wrap--error" : ""}`}>
              <MdLockOutline className="ep-pw-field__icon" />
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                required
              />
            </div>
            {confirm && confirm !== next && (
              <span className="ep-pw-field__error">Passwords do not match</span>
            )}
          </div>

          <div className="ep-password__footer">
            <button type="button" className="ep-btn ep-btn--ghost" onClick={reset}>Cancel</button>
            <button type="submit" className="ep-btn ep-btn--primary" disabled={loading}>
              {loading ? <span className="ep-spinner" /> : "Update password"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EditProfilePage() {
  const navigate = useNavigate();
  const toast    = useToast();

  const [user,    setUser]    = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user info
  useEffect(() => {
    axiosInstance.get<UserInfo>("/auth/user-Info")
      .then(res => setUser(res.data))
      .catch(() => toast.error("Error", "Unable to load user information."))
      .finally(() => setLoading(false));
  }, []);

  // Save name or status
  const handleSaveField = async (field: "name" | "status", value: string) => {
    try {
      const res = await axiosInstance.put<{ name: string; status: string }>("/auth/update-profile", {
        [field]: value,
      });
      setUser(prev => prev ? { ...prev, ...res.data } : prev);
      toast.success("Saved!", `${field === "name" ? "Name" : "About"} was updated.`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error("Update failed", msg ?? "Please try again.");
      throw err; // re-throw để EditableField biết lỗi
    }
  };

  if (loading) {
    return (
      <div className="ep-loading">
        <div className="ep-loading__ring" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!user) return null;

  const initials = getInitials(user.name || "U");
  const gradient = getAvatarGradient(user.name || "U");

  return (
    <div className="ep-page">
      {/* ── Background decoration ── */}
      <div className="ep-bg" aria-hidden="true">
        <div className="ep-bg__orb ep-bg__orb--1" />
        <div className="ep-bg__orb ep-bg__orb--2" />
        <div className="ep-bg__grid" />
      </div>

      <div className="ep-container">
        {/* ── Back button ── */}
        <button className="ep-back" onClick={() => navigate(-1)}>
          ← Back
        </button>

        <div className="ep-layout">

          {/* ── Left: Avatar card ── */}
          <aside className="ep-sidebar">
            <div className="ep-avatar-card">
              <div className="ep-avatar" style={{ background: gradient }}>
                <span>{initials}</span>
              </div>
              <h2 className="ep-avatar-card__name">{user.name}</h2>
              <span className={`ep-badge ep-badge--${user.role}`}>{user.role}</span>
              <p className="ep-avatar-card__status">
                {user.status || <em>No bio yet</em>}
              </p>
              <div className="ep-avatar-card__divider" />
              <div className="ep-avatar-card__meta">
                <MdOutlineEmail />
                <span>{user.email}</span>
              </div>
            </div>

            {/* Stats decorative */}
            <div className="ep-stats">
              <div className="ep-stats__item">
                <span className="ep-stats__num">∞</span>
                  <span className="ep-stats__lbl">Courses</span>
              </div>
              <div className="ep-stats__item">
                <span className="ep-stats__num">★</span>
                <span className="ep-stats__lbl">Premium</span>
              </div>
            </div>
          </aside>

          {/* ── Right: Edit form ── */}
          <main className="ep-main">
            <div className="ep-section">
              <div className="ep-section__head">
                <h1 className="ep-section__title">Personal information</h1>
                <p className="ep-section__sub">Click the ✏️ icon to edit each field</p>
              </div>

              <div className="ep-fields">
                {/* Name */}
                <EditableField
                  label="Full name"
                  value={user.name}
                  onSave={v => handleSaveField("name", v)}
                  icon={<MdOutlinePerson />}
                  placeholder="Enter your name"
                  maxLength={80}
                />

                {/* Email — read only */}
                <div className="ep-field ep-field--readonly">
                  <div className="ep-field__label">
                    <span className="ep-field__icon"><MdOutlineEmail /></span>
                    <span>Email</span>
                  </div>
                  <div className="ep-field__display">
                    <span className="ep-field__value">{user.email}</span>
                    <span className="ep-field__locked">🔒 Can't change</span>
                  </div>
                </div>

                {/* Status / bio */}
                <EditableField
                  label="About you"
                  value={user.status}
                  onSave={v => handleSaveField("status", v)}
                  icon={<MdOutlineEdit />}
                  placeholder="Write a few lines about yourself..."
                  maxLength={160}
                  multiline
                />
              </div>
            </div>

            {/* ── Password section ── */}
            <div className="ep-section ep-section--password">
              <PasswordSection toast={toast} />
            </div>

            {/* ── Danger zone ── */}
            <div className="ep-section ep-section--danger">
              <h3 className="ep-danger__title">Danger zone</h3>
              <p className="ep-danger__desc">
                Deleting your account will permanently erase all your data and cannot be undone.
              </p>
              <button
                className="ep-btn ep-btn--danger"
                onClick={() => toast.warning("This feature isn't supported yet", "Please contact the admin.")}
              >
                Delete account
              </button>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}