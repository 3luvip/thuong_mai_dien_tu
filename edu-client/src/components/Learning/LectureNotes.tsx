// src/components/Learning/LectureNotes.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiFileText, FiPlus, FiEdit2, FiTrash2,
  FiCheck, FiX, FiChevronDown, FiChevronUp,
  FiClock,
} from "react-icons/fi";
import axiosInstance from "../../lib/axios";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Note {
  id:        string;
  content:   string;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  userId:    string;
  lectureId: string;
  courseId:  string;
  lectureTitle?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LectureNotes({ userId, lectureId, courseId, lectureTitle }: Props) {
  const [notes,     setNotes]     = useState<Note[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  // New note
  const [newText,   setNewText]   = useState("");
  const [adding,    setAdding]    = useState(false);
  const [saving,    setSaving]    = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Edit
  const [editId,   setEditId]   = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [updating, setUpdating] = useState(false);

  // ── Fetch notes khi đổi bài giảng ────────────────────────────────────────
  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/notes/${userId}/${lectureId}`);
      setNotes(res.data.notes ?? []);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [userId, lectureId]);

  useEffect(() => {
    fetchNotes();
    setAdding(false);
    setNewText("");
    setEditId(null);
  }, [fetchNotes]);

  // Auto-resize textarea
  function autoResize(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }

  // ── Add note ──────────────────────────────────────────────────────────────
  async function handleAdd() {
    const content = newText.trim();
    if (!content) return;
    setSaving(true);
    try {
      const res = await axiosInstance.post("/notes", {
        user_id:    userId,
        lecture_id: lectureId,
        course_id:  courseId,
        content,
      });
      setNotes(prev => [...prev, {
        id:        res.data.note.id,
        content,
        createdAt: new Date().toLocaleString("vi-VN"),
        updatedAt: new Date().toLocaleString("vi-VN"),
      }]);
      setNewText("");
      setAdding(false);
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  // ── Edit note ─────────────────────────────────────────────────────────────
  async function handleUpdate() {
    if (!editId || !editText.trim()) return;
    setUpdating(true);
    try {
      await axiosInstance.patch(`/notes/${editId}`, { content: editText.trim() });
      setNotes(prev => prev.map(n =>
        n.id === editId ? { ...n, content: editText.trim() } : n
      ));
      setEditId(null);
    } catch { /* silent */ }
    finally { setUpdating(false); }
  }

  // ── Delete note ───────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    try {
      await axiosInstance.delete(`/notes/${id}`);
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch { /* silent */ }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.wrap}>
      {/* ── Header ── */}
      <div style={S.header} onClick={() => setCollapsed(v => !v)}>
        <div style={S.headerLeft}>
          <FiFileText size={15} style={{ color: "#818cf8" }} />
          <span style={S.headerTitle}>My Notes</span>
          {notes.length > 0 && (
            <span style={S.badge}>{notes.length}</span>
          )}
          {lectureTitle && (
            <span style={S.headerSub}>— {lectureTitle}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!collapsed && (
            <button
              type="button"
              style={S.addBtn}
              onClick={e => {
                e.stopPropagation();
                setCollapsed(false);
                setAdding(true);
                setTimeout(() => { textareaRef.current?.focus(); autoResize(textareaRef.current); }, 50);
              }}
            >
              <FiPlus size={13} /> Add note
            </button>
          )}
          <span style={{ color: "#475569", fontSize: 13 }}>
            {collapsed ? <FiChevronDown /> : <FiChevronUp />}
          </span>
        </div>
      </div>

      {/* ── Body ── */}
      {!collapsed && (
        <div style={S.body}>

          {/* ── New note form ── */}
          {adding && (
            <div style={S.newNoteForm}>
              <textarea
                ref={textareaRef}
                value={newText}
                onChange={e => { setNewText(e.target.value); autoResize(e.target); }}
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAdd();
                  if (e.key === "Escape") { setAdding(false); setNewText(""); }
                }}
                placeholder="Write your note here...  (Ctrl+Enter to save, Esc to cancel)"
                maxLength={10000}
                style={S.textarea}
                autoFocus
              />
              <div style={S.newNoteActions}>
                <span style={{ fontSize: 11, color: "#334155" }}>{newText.length}/10000</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    style={S.cancelBtn}
                    onClick={() => { setAdding(false); setNewText(""); }}
                  >
                    <FiX size={12} /> Cancel
                  </button>
                  <button
                    type="button"
                    style={{ ...S.saveBtn, opacity: (!newText.trim() || saving) ? 0.5 : 1 }}
                    onClick={handleAdd}
                    disabled={!newText.trim() || saving}
                  >
                    {saving
                      ? <span style={S.spinner} />
                      : <FiCheck size={12} />
                    }
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Notes list ── */}
          {loading ? (
            <div style={S.loading}>
              <span style={S.spinner} /> Loading notes...
            </div>
          ) : notes.length === 0 && !adding ? (
            <div style={S.empty}>
              <FiFileText size={28} style={{ opacity: 0.2, marginBottom: 8 }} />
              <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>No notes for this lecture yet.</p>
              <button
                type="button"
                style={{ ...S.addBtn, marginTop: 12, padding: "8px 16px" }}
                onClick={() => {
                  setAdding(true);
                  setTimeout(() => { textareaRef.current?.focus(); }, 50);
                }}
              >
                <FiPlus size={13} /> Write your first note
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {notes.map((note, i) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  index={i}
                  isEditing={editId === note.id}
                  editText={editText}
                  updating={updating}
                  onEditStart={() => { setEditId(note.id); setEditText(note.content); }}
                  onEditChange={setEditText}
                  onEditSave={handleUpdate}
                  onEditCancel={() => setEditId(null)}
                  onDelete={() => handleDelete(note.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes noteIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── NoteCard sub-component ───────────────────────────────────────────────────

function NoteCard({ note, index, isEditing, editText, updating,
  onEditStart, onEditChange, onEditSave, onEditCancel, onDelete,
}: {
  note: Note; index: number; isEditing: boolean;
  editText: string; updating: boolean;
  onEditStart: () => void; onEditChange: (v: string) => void;
  onEditSave: () => void; onEditCancel: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  function autoResize(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }

  return (
    <div
      style={{
        ...S.noteCard,
        animation: `noteIn 0.2s ease ${index * 0.04}s both`,
        borderColor: hovered ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.07)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isEditing ? (
        <div>
          <textarea
            value={editText}
            onChange={e => { onEditChange(e.target.value); autoResize(e.target); }}
            onKeyDown={e => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onEditSave();
              if (e.key === "Escape") onEditCancel();
            }}
            maxLength={10000}
            style={{ ...S.textarea, marginBottom: 10 }}
            autoFocus
            ref={el => { if (el) { autoResize(el); } }}
          />
          <div style={S.newNoteActions}>
            <span style={{ fontSize: 11, color: "#334155" }}>{editText.length}/10000</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" style={S.cancelBtn} onClick={onEditCancel}>
                <FiX size={12} /> Cancel
              </button>
              <button
                type="button"
                style={{ ...S.saveBtn, opacity: (!editText.trim() || updating) ? 0.5 : 1 }}
                onClick={onEditSave}
                disabled={!editText.trim() || updating}
              >
                {updating ? <span style={S.spinner} /> : <FiCheck size={12} />}
                Save
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div style={S.noteHeader}>
            <span style={S.noteNum}>#{index + 1}</span>
            <span style={S.noteTime}>
              <FiClock size={10} />
              {note.updatedAt !== note.createdAt ? `Edited ${note.updatedAt}` : note.createdAt}
            </span>
            <div style={{ ...S.noteActions, opacity: hovered ? 1 : 0 }}>
              <button type="button" style={S.iconBtn} onClick={onEditStart} title="Edit">
                <FiEdit2 size={13} />
              </button>
              <button type="button" style={{ ...S.iconBtn, color: "#f87171" }} onClick={onDelete} title="Delete">
                <FiTrash2 size={13} />
              </button>
            </div>
          </div>
          <p style={S.noteContent}>{note.content}</p>
        </>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  wrap: {
    marginTop: 0,
    background: "#080f1e",
    border: "1px solid rgba(99,102,241,0.2)",
    borderRadius: 14,
    overflow: "hidden",
    fontFamily: '"Inter", system-ui, sans-serif',
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 18px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    cursor: "pointer",
    userSelect: "none",
    background: "rgba(99,102,241,0.05)",
    transition: "background 0.15s",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#e2e8f0",
  },
  headerSub: {
    fontSize: 12,
    color: "#475569",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 300,
  },
  badge: {
    background: "rgba(99,102,241,0.2)",
    color: "#a5b4fc",
    fontSize: 11,
    fontWeight: 700,
    padding: "1px 7px",
    borderRadius: 999,
    border: "1px solid rgba(99,102,241,0.3)",
  },
  addBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "5px 12px",
    borderRadius: 7,
    border: "1px solid rgba(99,102,241,0.35)",
    background: "rgba(99,102,241,0.1)",
    color: "#a5b4fc",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.15s",
  },
  body: {
    padding: "16px 18px",
  },
  newNoteForm: {
    marginBottom: 16,
    background: "rgba(99,102,241,0.05)",
    border: "1px solid rgba(99,102,241,0.2)",
    borderRadius: 10,
    padding: "12px 14px",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box" as const,
    minHeight: 80,
    padding: "10px 12px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    color: "#e2e8f0",
    fontSize: 14,
    fontFamily: '"Inter", system-ui, sans-serif',
    lineHeight: 1.7,
    outline: "none",
    resize: "none",
    overflowY: "hidden",
    transition: "border-color 0.15s",
  },
  newNoteActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  cancelBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "6px 12px",
    borderRadius: 7,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "transparent",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  saveBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "6px 14px",
    borderRadius: 7,
    border: "none",
    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 2px 8px rgba(99,102,241,0.3)",
  },
  noteCard: {
    background: "#0d1527",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 10,
    padding: "12px 14px",
    transition: "border-color 0.15s",
  },
  noteHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  noteNum: {
    fontSize: 10,
    fontWeight: 800,
    color: "#6366f1",
    background: "rgba(99,102,241,0.12)",
    padding: "1px 7px",
    borderRadius: 4,
    letterSpacing: "0.04em",
  },
  noteTime: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    color: "#334155",
    flex: 1,
  },
  noteActions: {
    display: "flex",
    gap: 4,
    opacity: 0,
    transition: "opacity 0.15s",
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "transparent",
    color: "#64748b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  noteContent: {
    fontSize: 14,
    color: "#cbd5e1",
    lineHeight: 1.75,
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  empty: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    padding: "28px 0 16px",
    color: "#475569",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "20px 0",
    color: "#475569",
    fontSize: 13,
  },
  spinner: {
    width: 13,
    height: 13,
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.2)",
    borderTopColor: "#6366f1",
    animation: "spin 0.7s linear infinite",
    display: "inline-block",
    flexShrink: 0,
  },
};