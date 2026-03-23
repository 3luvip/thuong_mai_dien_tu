import { useEffect, useState } from "react";
import {
  FiPlus, FiToggleLeft, FiToggleRight, FiTrash2,
  FiTag, FiClock, FiUsers, FiPercent, FiDollarSign,
  FiCopy, FiCheck, FiAlertCircle, FiBookOpen, FiLoader,
} from "react-icons/fi";
import axiosInstance from "../../lib/axios";
import { formatVnd } from "../../utils/currency";
import { useToast } from "../../context/toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CourseOption { id: string; title: string; }

interface Coupon {
  id: string;
  code: string;
  scope: "platform" | "instructor";
  type: "percent" | "fixed";
  value: number;
  totalLimit: number;
  perUserLimit: number;
  minOrder: number;
  maxDiscount: number | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  usedCount: number;
  courses: { id: string; title: string }[];
}

interface FormState {
  code: string;
  type: "percent" | "fixed";
  value: string;
  totalLimit: string;
  perUserLimit: string;
  minOrder: string;
  maxDiscount: string;
  expiresAt: string;
  courseIds: string[];
}

const INITIAL_FORM: FormState = {
  code: "", type: "percent", value: "", totalLimit: "100",
  perUserLimit: "1", minOrder: "0", maxDiscount: "", expiresAt: "",
  courseIds: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: active ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.1)",
      border: `1px solid ${active ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.25)"}`,
      color: active ? "#4ade80" : "#f87171",
    }}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

// ─── Create Form ──────────────────────────────────────────────────────────────

function CreateForm({
  courses, onSuccess, onCancel,
}: {
  courses: CourseOption[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [copiedGen, setCopiedGen] = useState(false);

  function set(field: keyof FormState, value: string | string[]) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function toggleCourse(id: string) {
    set("courseIds",
      form.courseIds.includes(id)
        ? form.courseIds.filter(c => c !== id)
        : [...form.courseIds, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim())         { toast.error("Code is required"); return; }
    if (!form.value)               { toast.error("Value is required"); return; }
    if (form.courseIds.length === 0) { toast.error("Select at least 1 course"); return; }

    setLoading(true);
    try {
      await axiosInstance.post("/coupons", {
        code:          form.code.trim().toUpperCase(),
        type:          form.type,
        value:         parseFloat(form.value),
        totalLimit:    parseInt(form.totalLimit) || 100,
        perUserLimit:  parseInt(form.perUserLimit) || 1,
        minOrder:      parseFloat(form.minOrder) || 0,
        maxDiscount:   form.maxDiscount ? parseFloat(form.maxDiscount) : null,
        expiresAt:     form.expiresAt || null,
        courseIds:     form.courseIds,
      });
      toast.success("Coupon created!", `Code: ${form.code.toUpperCase()}`);
      setForm(INITIAL_FORM);
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ?? "Failed to create coupon";
      toast.error("Error", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={FS.form}>
      <div style={FS.formHead}>
        <span style={FS.formTitle}><FiTag size={14}/> New Coupon</span>
        <button type="button" style={FS.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>

      {/* Code */}
      <div style={FS.row}>
        <div style={FS.field}>
          <label style={FS.label}>Code <span style={FS.req}>*</span></label>
          <div style={{ display:"flex", gap:6 }}>
            <input
              style={{ ...FS.input, textTransform:"uppercase", flex:1 }}
              placeholder="SUMMER30"
              maxLength={50}
              value={form.code}
              onChange={e => set("code", e.target.value.toUpperCase())}
            />
            <button
              type="button"
              style={FS.genBtn}
              title="Generate random code"
              onClick={() => {
                const c = genCode();
                set("code", c);
                navigator.clipboard.writeText(c).then(() => {
                  setCopiedGen(true);
                  setTimeout(() => setCopiedGen(false), 1500);
                });
              }}
            >
              {copiedGen ? <FiCheck size={13}/> : <FiCopy size={13}/>}
            </button>
          </div>
        </div>
      </div>

      {/* Type + Value */}
      <div style={FS.row}>
        <div style={FS.field}>
          <label style={FS.label}>Type <span style={FS.req}>*</span></label>
          <div style={{ display:"flex", gap:8, marginTop:6 }}>
            {(["percent","fixed"] as const).map(t => (
              <button
                key={t} type="button"
                style={{ ...FS.typeBtn, ...(form.type===t ? FS.typeBtnActive:{}) }}
                onClick={() => set("type", t)}
              >
                {t === "percent" ? <FiPercent size={12}/> : <FiDollarSign size={12}/>}
                {t === "percent" ? "Percent" : "Fixed (₫)"}
              </button>
            ))}
          </div>
        </div>
        <div style={FS.field}>
          <label style={FS.label}>
            Value <span style={FS.req}>*</span>
            <span style={FS.hint}>{form.type==="percent" ? "(1–100)" : "(₫)"}</span>
          </label>
          <input
            style={FS.input}
            type="number"
            min={0}
            max={form.type==="percent" ? 100 : undefined}
            placeholder={form.type==="percent" ? "30" : "50000"}
            value={form.value}
            onChange={e => set("value", e.target.value)}
          />
        </div>
      </div>

      {/* Limits */}
      <div style={FS.row}>
        <div style={FS.field}>
          <label style={FS.label}><FiUsers size={11}/> Total uses</label>
          <input style={FS.input} type="number" min={1} value={form.totalLimit}
            onChange={e => set("totalLimit", e.target.value)}/>
        </div>
        <div style={FS.field}>
          <label style={FS.label}>Per-user limit</label>
          <input style={FS.input} type="number" min={1} value={form.perUserLimit}
            onChange={e => set("perUserLimit", e.target.value)}/>
        </div>
      </div>

      {/* Min order + Max discount */}
      <div style={FS.row}>
        <div style={FS.field}>
          <label style={FS.label}>Min order (₫)</label>
          <input style={FS.input} type="number" min={0} value={form.minOrder}
            onChange={e => set("minOrder", e.target.value)} placeholder="0"/>
        </div>
        {form.type === "percent" && (
          <div style={FS.field}>
            <label style={FS.label}>Max discount (₫)</label>
            <input style={FS.input} type="number" min={0} value={form.maxDiscount}
              onChange={e => set("maxDiscount", e.target.value)} placeholder="optional"/>
          </div>
        )}
      </div>

      {/* Expires */}
      <div style={FS.field}>
        <label style={FS.label}><FiClock size={11}/> Expires at (optional)</label>
        <input style={FS.input} type="datetime-local" value={form.expiresAt}
          onChange={e => set("expiresAt", e.target.value)}/>
      </div>

      {/* Course selector */}
      <div style={FS.field}>
        <label style={FS.label}>
          <FiBookOpen size={11}/> Apply to courses <span style={FS.req}>*</span>
          <span style={FS.hint}>({form.courseIds.length} selected)</span>
        </label>
        {courses.length === 0 ? (
          <div style={FS.noCourse}>
            <FiAlertCircle size={13}/> You don't have any courses yet.
          </div>
        ) : (
          <div style={FS.courseList}>
            {courses.map(c => {
              const sel = form.courseIds.includes(c.id);
              return (
                <button
                  key={c.id} type="button"
                  style={{ ...FS.courseChip, ...(sel ? FS.courseChipSel:{}) }}
                  onClick={() => toggleCourse(c.id)}
                >
                  {sel && <FiCheck size={11}/>}
                  <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {c.title}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button type="submit" style={FS.submitBtn} disabled={loading}>
        {loading ? <><span style={FS.spinner}/> Creating...</> : <><FiPlus size={13}/> Create coupon</>}
      </button>
    </form>
  );
}

// ─── Coupon Card ──────────────────────────────────────────────────────────────

function CouponCard({
  coupon, onToggle, onDelete,
}: {
  coupon: Coupon;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(coupon.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
  const fillPct   = coupon.totalLimit > 0 ? (coupon.usedCount / coupon.totalLimit) * 100 : 0;

  return (
    <div style={{
      ...CC.card,
      ...((!coupon.isActive || isExpired) ? CC.cardDim : {}),
    }}>
      {/* Top bar */}
      <div style={CC.topBar}>
        <div style={CC.codeRow}>
          <span style={CC.code}>{coupon.code}</span>
          <button style={CC.copyBtn} onClick={copyCode} title="Copy">
            {copied ? <FiCheck size={12}/> : <FiCopy size={12}/>}
          </button>
        </div>
        <StatusBadge active={coupon.isActive && !isExpired} />
      </div>

      {/* Meta */}
      <div style={CC.meta}>
        <span style={CC.chip}>
          {coupon.type === "percent"
            ? <><FiPercent size={10}/> {coupon.value}%</>
            : <><FiDollarSign size={10}/> {formatVnd(coupon.value)} ₫</>}
        </span>
        {coupon.minOrder > 0 && (
          <span style={CC.chip}>min {formatVnd(coupon.minOrder)} ₫</span>
        )}
        {coupon.maxDiscount && (
          <span style={CC.chip}>cap {formatVnd(coupon.maxDiscount)} ₫</span>
        )}
        <span style={CC.chip}>
          <FiUsers size={10}/> {coupon.perUserLimit}/user
        </span>
      </div>

      {/* Usage bar */}
      <div style={CC.usageRow}>
        <div style={CC.usageBar}>
          <div style={{ ...CC.usageFill, width: `${Math.min(fillPct, 100)}%`,
            background: fillPct >= 90 ? "#ef4444" : fillPct >= 60 ? "#f59e0b" : "#6366f1" }}/>
        </div>
        <span style={CC.usageTxt}>{coupon.usedCount} / {coupon.totalLimit}</span>
      </div>

      {/* Courses */}
      {coupon.courses?.length > 0 && (
        <div style={CC.courseSection}>
          <span style={CC.courseSectionLabel}><FiBookOpen size={10}/> Applied to:</span>
          <div style={CC.courseTags}>
            {coupon.courses.slice(0, 3).map(c => (
              <span key={c.id} style={CC.courseTag}>{c.title}</span>
            ))}
            {coupon.courses.length > 3 && (
              <span style={CC.courseTag}>+{coupon.courses.length - 3} more</span>
            )}
          </div>
        </div>
      )}

      {/* Expiry */}
      {coupon.expiresAt && (
        <div style={{ ...CC.expiry, ...(isExpired ? CC.expiryExpired:{}) }}>
          <FiClock size={10}/>
          {isExpired ? "Expired" : "Expires"} {new Date(coupon.expiresAt).toLocaleDateString("vi-VN")}
        </div>
      )}

      {/* Actions */}
      <div style={CC.actions}>
        <button
          style={{ ...CC.actionBtn, ...(coupon.isActive ? CC.actionDeactivate : CC.actionActivate) }}
          onClick={() => onToggle(coupon.id)}
          title={coupon.isActive ? "Deactivate" : "Activate"}
        >
          {coupon.isActive ? <FiToggleRight size={15}/> : <FiToggleLeft size={15}/>}
          {coupon.isActive ? "Deactivate" : "Activate"}
        </button>
        {coupon.usedCount === 0 && (
          <button
            style={CC.deleteBtn}
            onClick={() => { if (confirm(`Delete coupon ${coupon.code}?`)) onDelete(coupon.id); }}
            title="Delete"
          >
            <FiTrash2 size={13}/>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export default function CouponTab({ instructorId }: { instructorId: string }) {
  const toast = useToast();
  const [coupons, setCoupons]   = useState<Coupon[]>([]);
  const [courses, setCourses]   = useState<CourseOption[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter]     = useState<"all" | "active" | "inactive">("all");

  async function fetchData() {
    setLoading(true);
    try {
      const [cRes, crsRes] = await Promise.all([
        axiosInstance.get("/coupons/my"),
        axiosInstance.get(`/instructor/my-courses/${instructorId}`),
      ]);
      setCoupons(cRes.data.coupons ?? []);
      setCourses((crsRes.data.courses ?? []).map((c: { id: string; title: string }) =>
        ({ id: c.id, title: c.title })
      ));
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [instructorId]);

  async function handleToggle(id: string) {
    try {
      const res = await axiosInstance.patch(`/coupons/${id}/toggle`);
      toast.success(res.data.isActive ? "Coupon activated" : "Coupon deactivated");
      setCoupons(prev => prev.map(c => c.id === id ? { ...c, isActive: res.data.isActive } : c));
    } catch (err: unknown) {
      toast.error("Failed", (err as { response?: { data?: { message?: string } } })?.response?.data?.message);
    }
  }

  async function handleDelete(id: string) {
    try {
      await axiosInstance.delete(`/coupons/${id}`);
      toast.success("Coupon deleted");
      setCoupons(prev => prev.filter(c => c.id !== id));
    } catch (err: unknown) {
      toast.error("Failed", (err as { response?: { data?: { message?: string } } })?.response?.data?.message);
    }
  }

  const filtered = coupons.filter(c => {
    if (filter === "active")   return c.isActive;
    if (filter === "inactive") return !c.isActive;
    return true;
  });

  return (
    <div style={T.page}>
      {/* Header */}
      <div style={T.header}>
        <div>
          <h2 style={T.title}><FiTag size={18}/> My Coupons</h2>
          <p style={T.sub}>Create discount codes for your courses. Customers enter these codes at checkout.</p>
        </div>
        {!showForm && (
          <button style={T.createBtn} onClick={() => setShowForm(true)}>
            <FiPlus size={14}/> New coupon
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <CreateForm
          courses={courses}
          onSuccess={() => { setShowForm(false); fetchData(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Filter tabs */}
      <div style={T.filterRow}>
        {(["all","active","inactive"] as const).map(f => (
          <button
            key={f}
            style={{ ...T.filterBtn, ...(filter===f ? T.filterBtnActive:{}) }}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase()+f.slice(1)}
            {f === "all" && ` (${coupons.length})`}
            {f === "active" && ` (${coupons.filter(c=>c.isActive).length})`}
            {f === "inactive" && ` (${coupons.filter(c=>!c.isActive).length})`}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={T.loading}>
          <FiLoader className="spin" size={22}/>
          <span>Loading coupons...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={T.empty}>
          <FiTag size={36} style={{ opacity: 0.2, marginBottom: 12 }}/>
          <p style={{ margin:0, fontWeight:600 }}>
            {filter === "all" ? "No coupons yet" : `No ${filter} coupons`}
          </p>
          {filter === "all" && (
            <p style={{ margin:"6px 0 0", fontSize:13, color:"#64748b" }}>
              Create your first coupon to offer discounts on your courses.
            </p>
          )}
        </div>
      ) : (
        <div style={T.grid}>
          {filtered.map(c => (
            <CouponCard key={c.id} coupon={c} onToggle={handleToggle} onDelete={handleDelete}/>
          ))}
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const T: Record<string, React.CSSProperties> = {
  page:   { paddingTop: 4 },
  header: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, gap:12 },
  title:  { fontSize:18, fontWeight:800, color:"#e2e8f0", margin:"0 0 5px", display:"flex", alignItems:"center", gap:8 },
  sub:    { fontSize:12, color:"#475569", margin:0, lineHeight:1.5 },
  createBtn: {
    display:"flex", alignItems:"center", gap:6, flexShrink:0,
    padding:"9px 16px", borderRadius:9, border:"none",
    background:"linear-gradient(135deg,#6366f1,#4f46e5)", color:"#fff",
    fontSize:13, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap",
    boxShadow:"0 4px 14px rgba(99,102,241,0.35)",
  },
  filterRow: { display:"flex", gap:6, marginBottom:18 },
  filterBtn: {
    padding:"6px 14px", borderRadius:7, border:"1px solid rgba(255,255,255,0.07)",
    background:"transparent", color:"#475569", fontFamily:"inherit",
    fontSize:11, fontWeight:500, cursor:"pointer", transition:"all 0.15s",
  },
  filterBtnActive: {
    background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.3)",
    color:"#a5b4fc", fontWeight:700,
  },
  grid:    { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:14 },
  loading: { display:"flex", alignItems:"center", gap:10, padding:"3rem", color:"#475569", fontSize:13 },
  empty:   { padding:"3rem", textAlign:"center", color:"#475569", fontSize:14 },
};

const CC: Record<string, React.CSSProperties> = {
  card: {
    background:"#0d1527", border:"1px solid rgba(255,255,255,0.07)",
    borderRadius:12, padding:16, display:"flex", flexDirection:"column", gap:10,
    transition:"all 0.15s",
  },
  cardDim: { opacity: 0.65 },
  topBar:  { display:"flex", justifyContent:"space-between", alignItems:"center" },
  codeRow: { display:"flex", alignItems:"center", gap:6 },
  code:    { fontSize:16, fontWeight:800, color:"#e2e8f0", letterSpacing:"0.08em" },
  copyBtn: {
    background:"transparent", border:"1px solid rgba(255,255,255,0.08)",
    color:"#475569", width:24, height:24, borderRadius:5,
    display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
  },
  meta:    { display:"flex", flexWrap:"wrap", gap:6 },
  chip: {
    display:"inline-flex", alignItems:"center", gap:3,
    padding:"2px 8px", borderRadius:5, fontSize:11, fontWeight:600,
    background:"rgba(99,102,241,0.08)", color:"#94a3b8",
    border:"1px solid rgba(99,102,241,0.15)",
  },
  usageRow: { display:"flex", alignItems:"center", gap:8 },
  usageBar: { flex:1, height:5, background:"#1a2540", borderRadius:99, overflow:"hidden" },
  usageFill: { height:"100%", borderRadius:99, transition:"width 0.4s" },
  usageTxt: { fontSize:11, color:"#475569", whiteSpace:"nowrap" },
  courseSection: { display:"flex", flexDirection:"column", gap:5 },
  courseSectionLabel: { fontSize:10, color:"#334155", display:"flex", alignItems:"center", gap:4 },
  courseTags: { display:"flex", flexWrap:"wrap", gap:5 },
  courseTag: {
    fontSize:10, padding:"2px 7px", borderRadius:4,
    background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.06)",
    color:"#64748b", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
  },
  expiry: { fontSize:11, color:"#64748b", display:"flex", alignItems:"center", gap:4 },
  expiryExpired: { color:"#f87171" },
  actions: { display:"flex", gap:8, marginTop:4 },
  actionBtn: {
    flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5,
    padding:"7px 0", borderRadius:8, border:"none", fontFamily:"inherit",
    fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.15s",
  },
  actionActivate:   { background:"rgba(34,197,94,0.1)",   color:"#4ade80", border:"1px solid rgba(34,197,94,0.25)" },
  actionDeactivate: { background:"rgba(239,68,68,0.08)",  color:"#f87171", border:"1px solid rgba(239,68,68,0.2)" },
  deleteBtn: {
    width:34, height:34, borderRadius:8,
    background:"rgba(239,68,68,0.07)", border:"1px solid rgba(239,68,68,0.18)",
    color:"#f87171", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
  },
};

const FS: Record<string, React.CSSProperties> = {
  form: {
    background:"#0d1527", border:"1px solid rgba(99,102,241,0.22)", borderRadius:14,
    padding:20, marginBottom:20, display:"flex", flexDirection:"column", gap:14,
  },
  formHead: { display:"flex", justifyContent:"space-between", alignItems:"center" },
  formTitle: { fontSize:14, fontWeight:700, color:"#e2e8f0", display:"flex", alignItems:"center", gap:6 },
  cancelBtn: {
    background:"transparent", border:"1px solid rgba(255,255,255,0.08)",
    color:"#475569", padding:"5px 12px", borderRadius:7, fontSize:12, cursor:"pointer", fontFamily:"inherit",
  },
  row:   { display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 },
  field: { display:"flex", flexDirection:"column", gap:5 },
  label: { fontSize:11, fontWeight:600, color:"#475569", letterSpacing:"0.02em", display:"flex", alignItems:"center", gap:5 },
  req:   { color:"#f43f5e" },
  hint:  { color:"#334155", fontWeight:400 },
  input: {
    background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)",
    borderRadius:8, color:"#e2e8f0", padding:"9px 12px",
    fontSize:13, fontFamily:"inherit", outline:"none",
  },
  genBtn: {
    width:36, height:36, borderRadius:8, flexShrink:0,
    background:"rgba(99,102,241,0.1)", border:"1px solid rgba(99,102,241,0.3)",
    color:"#a5b4fc", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
  },
  typeBtn: {
    flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5,
    padding:"8px 0", borderRadius:7, border:"1px solid rgba(255,255,255,0.07)",
    background:"transparent", color:"#475569", fontFamily:"inherit",
    fontSize:12, fontWeight:500, cursor:"pointer", transition:"all 0.15s",
  },
  typeBtnActive: {
    background:"rgba(99,102,241,0.14)", border:"1px solid rgba(99,102,241,0.35)",
    color:"#a5b4fc", fontWeight:700,
  },
  courseList: {
    display:"flex", flexWrap:"wrap", gap:6, maxHeight:160,
    overflowY:"auto", padding:6, background:"rgba(0,0,0,0.2)",
    borderRadius:8, border:"1px solid rgba(255,255,255,0.05)",
  },
  courseChip: {
    display:"inline-flex", alignItems:"center", gap:5,
    padding:"5px 10px", borderRadius:6, fontSize:12,
    border:"1px solid rgba(255,255,255,0.07)", background:"transparent",
    color:"#475569", cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s",
    maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
  },
  courseChipSel: {
    background:"rgba(99,102,241,0.14)", border:"1px solid rgba(99,102,241,0.35)",
    color:"#a5b4fc",
  },
  noCourse: {
    display:"flex", alignItems:"center", gap:6, padding:"10px 12px",
    background:"rgba(245,158,11,0.07)", border:"1px solid rgba(245,158,11,0.18)",
    borderRadius:8, fontSize:12, color:"#fbbf24",
  },
  submitBtn: {
    display:"flex", alignItems:"center", justifyContent:"center", gap:6,
    padding:"11px", borderRadius:9, border:"none",
    background:"linear-gradient(135deg,#6366f1,#4f46e5)", color:"#fff",
    fontFamily:"inherit", fontSize:13, fontWeight:700, cursor:"pointer",
    marginTop:4,
  },
  spinner: {
    width:14, height:14, borderRadius:"50%",
    border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"#fff",
    animation:"spin 0.7s linear infinite", display:"inline-block",
  },
};