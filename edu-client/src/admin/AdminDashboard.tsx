// src/admin/AdminDashboard.tsx
// Self-contained admin dashboard — uses adminToken from localStorage

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiUsers, FiBookOpen, FiDollarSign, FiTrendingUp,
  FiBell, FiCheck, FiX, FiTrash2, FiSearch,
  FiChevronLeft, FiChevronRight, FiShield,
  FiBarChart2, FiRefreshCw, FiArrowUp, FiLogOut,
  FiAlertTriangle, FiSend,
} from "react-icons/fi";
import { RiBankLine } from "react-icons/ri";
import { MdOutlineOndemandVideo } from "react-icons/md";
import { formatVnd } from "../utils/currency";

// ─── Axios instance with admin token ─────────────────────────────────────────

async function adminFetch<T = unknown>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const token = localStorage.getItem("adminToken");
  const res = await fetch(`http://localhost:8080${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  users:       { total: number; instructors: number; students: number; banned: number; new30d: number };
  courses:     number;
  orders:      { total: number; new30d: number };
  revenue:     { gross: number; platform: number; last30d: number; monthly: { month: string; revenue: number; orders: number }[] };
  withdrawals: { pending: number; pendingAmount: number };
}

interface User {
  id: string; email: string; name: string; role: string;
  isBanned: boolean; banReason: string | null; createdAt: string;
}

interface Course {
  id: string; title: string; category: string; level: string;
  price: number; instructorName: string | null;
  studentCount: number; revenue: number; createdAt: string;
}

interface Withdrawal {
  id: string; instructorName: string | null; instructorEmail: string | null;
  amount: number; platformFee: number; netAmount: number; status: string;
  note: string | null;
  bankSnapshot: { bankName?: string; accountNumber?: string; accountHolder?: string };
  createdAt: string;
}

interface Broadcast {
  title: string; body: string; link: string | null;
  recipientCount: number; sentAt: string;
}

type Tab = "overview" | "users" | "courses" | "withdrawals" | "broadcast";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_TAG: Record<string, { bg: string; color: string }> = {
  admin:      { bg: "rgba(239,68,68,.12)",  color: "#f87171" },
  instructor: { bg: "rgba(99,102,241,.12)", color: "#a5b4fc" },
  user:       { bg: "rgba(34,197,94,.10)",  color: "#4ade80" },
};

const W_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: "rgba(245,158,11,.12)", color: "#fbbf24", label: "Pending"   },
  approved:  { bg: "rgba(34,197,94,.12)",  color: "#4ade80", label: "Approved"  },
  rejected:  { bg: "rgba(239,68,68,.12)",  color: "#f87171", label: "Rejected"  },
  cancelled: { bg: "rgba(100,116,139,.1)", color: "#94a3b8", label: "Cancelled" },
};

function Tag({ text, bg, color }: { text: string; bg: string; color: string }) {
  return <span style={{ display:"inline-block", padding:"2px 10px", borderRadius:999, fontSize:11, fontWeight:700, background:bg, color, border:`1px solid ${color}33` }}>{text}</span>;
}

function Pager({ page, total, onChange }: { page: number; total: number; onChange: (p:number)=>void }) {
  if (total <= 1) return null;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"flex-end", padding:"12px 18px" }}>
      <button style={S.pagerBtn} disabled={page<=1} onClick={()=>onChange(page-1)}><FiChevronLeft size={13}/></button>
      <span style={{ fontSize:12, color:"#475569" }}>Page {page} of {total}</span>
      <button style={S.pagerBtn} disabled={page>=total} onClick={()=>onChange(page+1)}><FiChevronRight size={13}/></button>
    </div>
  );
}

function MiniChart({ data }: { data: { month: string; revenue: number }[] }) {
  const max = Math.max(...data.map(d => d.revenue), 1);
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:5, height:72, padding:"0 2px" }}>
      {data.map(d => (
        <div key={d.month} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4, height:"100%" }}>
          <div style={{ flex:1, width:"100%", display:"flex", alignItems:"flex-end" }}>
            <div style={{ width:"100%", borderRadius:"3px 3px 0 0", background:"linear-gradient(to top,#6366f1,#818cf8)", height:`${Math.max((d.revenue/max)*100, 6)}%`, transition:"height 0.4s" }} />
          </div>
          <span style={{ fontSize:9, color:"#334155" }}>{d.month.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ icon, label, value, sub, accent, trend }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent: string; trend?: "up" | "down" }) {
  return (
    <div style={{ ...S.statCard, borderTopColor: accent } as React.CSSProperties}>
      <div style={{ ...S.statIcon, background:`${accent}1a`, color:accent }}>{icon}</div>
      <div>
        <div style={S.statLabel}>{label}</div>
        <div style={S.statValue}>{value}</div>
        {sub && <div style={{ ...S.statSub, color: trend==="up"?"#22c55e":trend==="down"?"#ef4444":"#475569" }}>
          {trend==="up" && <FiArrowUp size={9}/>} {sub}
        </div>}
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: ()=>void }) {
  return (
    <div style={S.overlay} onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div style={S.modal}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
          <h3 style={{ fontSize:16, fontWeight:800, color:"#f1f5f9", margin:0 }}>{title}</h3>
          <button style={S.modalClose} onClick={onClose}><FiX size={15}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

export default function AdminDashboard() {
  const navigate = useNavigate();

  // Auth guard
  useEffect(() => {
    if (localStorage.getItem("adminRole") !== "admin") navigate("/admin/login");
  }, []);

  const [tab, setTab] = useState<Tab>("overview");
  const [toast, setToast] = useState<{ type:"ok"|"err"; msg:string }|null>(null);

  function ok(msg: string)  { setToast({ type:"ok",  msg }); setTimeout(()=>setToast(null), 4000); }
  function err(msg: string) { setToast({ type:"err", msg }); setTimeout(()=>setToast(null), 5000); }

  function logout() {
    ["adminToken","adminUserId","adminRole"].forEach(k => localStorage.removeItem(k));
    navigate("/admin/login");
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const [stats, setStats]             = useState<Stats|null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  async function loadStats() {
    setStatsLoading(true);
    try { setStats(await adminFetch<Stats>("GET", "/admin/stats")); }
    catch(e) { err((e as Error).message); }
    finally { setStatsLoading(false); }
  }
  useEffect(() => { loadStats(); }, []);

  // ── Users ─────────────────────────────────────────────────────────────────
  const [users, setUsers]           = useState<User[]>([]);
  const [userTotal, setUserTotal]   = useState(0);
  const [userPage, setUserPage]     = useState(1);
  const [userPages, setUserPages]   = useState(1);
  const [uSearch, setUSearch]       = useState("");
  const [uRole, setURole]           = useState("all");
  const [uLoading, setULoading]     = useState(false);
  const [banModal, setBanModal]     = useState<User|null>(null);
  const [banReason, setBanReason]   = useState("");

  const loadUsers = useCallback(async () => {
    setULoading(true);
    try {
      const params = new URLSearchParams({ page: String(userPage), limit:"15", ...(uSearch ? { q:uSearch }:{}), ...(uRole!=="all" ? { role:uRole }:{}) });
      const d = await adminFetch<{ users:User[]; total:number; totalPages:number }>("GET", `/admin/users?${params}`);
      setUsers(d.users); setUserTotal(d.total); setUserPages(d.totalPages);
    } catch(e) { err((e as Error).message); }
    finally { setULoading(false); }
  }, [userPage, uSearch, uRole]);

  useEffect(() => { if (tab==="users") loadUsers(); }, [tab, userPage, uRole]);

  async function doChangeRole(uid: string, role: string) {
    try { await adminFetch("PATCH", `/admin/users/${uid}/role`, { role }); ok("Role updated"); loadUsers(); }
    catch(e) { err((e as Error).message); }
  }
  async function doBan(uid: string) {
    try { await adminFetch("PATCH", `/admin/users/${uid}/ban`, { reason: banReason||null }); ok("User banned"); setBanModal(null); setBanReason(""); loadUsers(); loadStats(); }
    catch(e) { err((e as Error).message); }
  }
  async function doUnban(uid: string) {
    try { await adminFetch("PATCH", `/admin/users/${uid}/unban`); ok("User unbanned"); loadUsers(); loadStats(); }
    catch(e) { err((e as Error).message); }
  }
  async function doDeleteUser(uid: string) {
    if (!confirm("Permanently delete this user?")) return;
    try { await adminFetch("DELETE", `/admin/users/${uid}`); ok("User deleted"); loadUsers(); loadStats(); }
    catch(e) { err((e as Error).message); }
  }

  // ── Courses ───────────────────────────────────────────────────────────────
  const [courses, setCourses]         = useState<Course[]>([]);
  const [cTotal, setCTotal]           = useState(0);
  const [cPage, setCPage]             = useState(1);
  const [cPages, setCPages]           = useState(1);
  const [cSearch, setCSearch]         = useState("");
  const [cLoading, setCLoading]       = useState(false);

  const loadCourses = useCallback(async () => {
    setCLoading(true);
    try {
      const params = new URLSearchParams({ page: String(cPage), limit:"15", ...(cSearch ? { q:cSearch }:{}) });
      const d = await adminFetch<{ courses:Course[]; total:number; totalPages:number }>("GET", `/admin/courses?${params}`);
      setCourses(d.courses); setCTotal(d.total); setCPages(d.totalPages);
    } catch(e) { err((e as Error).message); }
    finally { setCLoading(false); }
  }, [cPage, cSearch]);

  useEffect(() => { if (tab==="courses") loadCourses(); }, [tab, cPage]);

  async function doDeleteCourse(cid: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try { await adminFetch("DELETE", `/admin/courses/${cid}`); ok("Course deleted"); loadCourses(); loadStats(); }
    catch(e) { err((e as Error).message); }
  }

  // ── Withdrawals ───────────────────────────────────────────────────────────
  const [withdrawals, setWithdrawals]   = useState<Withdrawal[]>([]);
  const [wTotal, setWTotal]             = useState(0);
  const [wPage, setWPage]               = useState(1);
  const [wPages, setWPages]             = useState(1);
  const [wStatus, setWStatus]           = useState("pending");
  const [wLoading, setWLoading]         = useState(false);
  const [reviewModal, setReviewModal]   = useState<{ w: Withdrawal; action: "approve"|"reject" }|null>(null);
  const [reviewNote, setReviewNote]     = useState("");

  const loadWithdrawals = useCallback(async () => {
    setWLoading(true);
    try {
      const params = new URLSearchParams({ page: String(wPage), limit:"15", ...(wStatus!=="all" ? { status:wStatus }:{}) });
      const d = await adminFetch<{ requests:Withdrawal[]; total:number; totalPages:number }>("GET", `/admin/withdrawals?${params}`);
      setWithdrawals(d.requests); setWTotal(d.total); setWPages(d.totalPages);
    } catch(e) { err((e as Error).message); }
    finally { setWLoading(false); }
  }, [wPage, wStatus]);

  useEffect(() => { if (tab==="withdrawals") loadWithdrawals(); }, [tab, wPage, wStatus]);

  async function doReview() {
    if (!reviewModal) return;
    const { w, action } = reviewModal;
    try {
      await adminFetch("PATCH", `/admin/withdrawals/${w.id}/${action}`, { note: reviewNote||null });
      ok(action==="approve" ? "Approved — instructor notified ✅" : "Rejected — instructor notified");
      setReviewModal(null); setReviewNote(""); loadWithdrawals(); loadStats();
    } catch(e) { err((e as Error).message); }
  }

  // ── Broadcast ─────────────────────────────────────────────────────────────
  const [bTitle,     setBTitle]     = useState("");
  const [bBody,      setBBody]      = useState("");
  const [bLink,      setBLink]      = useState("");
  const [bTarget,    setBTarget]    = useState("all");
  const [bSending,   setBSending]   = useState(false);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [bHistory,   setBHistory]   = useState(false);

  async function loadBroadcasts() {
    try { const d = await adminFetch<{ broadcasts:Broadcast[] }>("GET", "/admin/broadcasts"); setBroadcasts(d.broadcasts); }
    catch {}
  }
  useEffect(() => { if (tab==="broadcast") loadBroadcasts(); }, [tab]);

  async function doSendBroadcast() {
    if (!bTitle.trim() || !bBody.trim()) { err("Title and body are required"); return; }
    if (!confirm(`Send to all "${bTarget}" users?`)) return;
    setBSending(true);
    try {
      const d = await adminFetch<{ message:string; sent:number }>("POST", "/admin/broadcast", { title:bTitle.trim(), body:bBody.trim(), link:bLink||null, target:bTarget });
      ok(d.message);
      setBTitle(""); setBBody(""); setBLink("");
      loadBroadcasts();
    } catch(e) { err((e as Error).message); }
    finally { setBSending(false); }
  }

  // ── NAV ITEMS ─────────────────────────────────────────────────────────────
  const navItems: { key: Tab; icon: React.ReactNode; label: string; badge?: number }[] = [
    { key:"overview",    icon:<FiBarChart2 size={16}/>,          label:"Overview"     },
    { key:"users",       icon:<FiUsers size={16}/>,              label:"Users",        badge: stats?.users.banned },
    { key:"courses",     icon:<MdOutlineOndemandVideo size={16}/>, label:"Courses"    },
    { key:"withdrawals", icon:<RiBankLine size={16}/>,            label:"Withdrawals", badge: stats?.withdrawals.pending },
    { key:"broadcast",   icon:<FiBell size={16}/>,               label:"Broadcast"    },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.root}>

      {/* Toast */}
      {toast && (
        <div style={{ ...S.toast, ...(toast.type==="err" ? S.toastErr : S.toastOk) }}>
          {toast.type==="ok" ? <FiCheck size={13}/> : <FiAlertTriangle size={13}/>}
          {toast.msg}
        </div>
      )}

      {/* Ban modal */}
      {banModal && (
        <Modal title={`Ban "${banModal.name}"`} onClose={()=>setBanModal(null)}>
          <p style={{ fontSize:13, color:"#94a3b8", margin:"0 0 14px" }}>
            The user will be prevented from logging in. You can unban them at any time.
          </p>
          <label style={S.label}>Reason (optional)</label>
          <input style={{ ...S.input, marginTop:6, marginBottom:18, width:"100%", boxSizing:"border-box" as const }}
            placeholder="e.g. Violated terms of service"
            value={banReason} onChange={e=>setBanReason(e.target.value)} />
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button style={S.ghostBtn} onClick={()=>setBanModal(null)}>Cancel</button>
            <button style={{ ...S.primaryBtn, background:"#ef4444" }} onClick={()=>doBan(banModal.id)}>
              <FiAlertTriangle size={13}/> Ban User
            </button>
          </div>
        </Modal>
      )}

      {/* Withdrawal review modal */}
      {reviewModal && (
        <Modal
          title={reviewModal.action==="approve" ? "Approve Withdrawal" : "Reject Withdrawal"}
          onClose={()=>setReviewModal(null)}
        >
          <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:10, padding:"12px 14px", marginBottom:16 }}>
            <div style={{ fontSize:13, color:"#94a3b8", marginBottom:4 }}>{reviewModal.w.instructorName} · {reviewModal.w.instructorEmail}</div>
            <div style={{ fontSize:20, fontWeight:800, color: reviewModal.action==="approve" ? "#22c55e" : "#f87171" }}>
              {formatVnd(reviewModal.w.netAmount)} ₫ net
            </div>
            <div style={{ fontSize:12, color:"#475569" }}>
              {reviewModal.w.bankSnapshot?.bankName} · {reviewModal.w.bankSnapshot?.accountNumber} · {reviewModal.w.bankSnapshot?.accountHolder}
            </div>
          </div>
          <label style={S.label}>Note for instructor {reviewModal.action==="reject" ? "(required)" : "(optional)"}</label>
          <textarea style={{ ...S.input, marginTop:6, marginBottom:18, width:"100%", boxSizing:"border-box" as const, height:72, resize:"none" }}
            placeholder={reviewModal.action==="approve" ? "e.g. Payment processed via VCB" : "e.g. Insufficient documentation"}
            value={reviewNote} onChange={e=>setReviewNote(e.target.value)}
          />
          {reviewModal.action==="reject" && !reviewNote.trim() && (
            <p style={{ fontSize:12, color:"#f87171", margin:"-12px 0 12px" }}>Please provide a reason for rejection.</p>
          )}
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <button style={S.ghostBtn} onClick={()=>setReviewModal(null)}>Cancel</button>
            <button
              style={{ ...S.primaryBtn, background: reviewModal.action==="approve"?"#22c55e":"#ef4444",
                opacity:(reviewModal.action==="reject"&&!reviewNote.trim()) ? 0.5:1 }}
              disabled={reviewModal.action==="reject"&&!reviewNote.trim()}
              onClick={doReview}
            >
              {reviewModal.action==="approve" ? <><FiCheck size={13}/> Approve & Notify</> : <><FiX size={13}/> Reject & Notify</>}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Sidebar ── */}
      <aside style={S.sidebar}>
        <div style={S.sideTop}>
          <div style={S.sideLogo}>
            <div style={S.sideLogoIcon}><FiShield size={16}/></div>
            <div>
              <div style={S.sideLogoTitle}>Admin Portal</div>
              <div style={S.sideLogoSub}>CTUET Platform</div>
            </div>
          </div>
          <nav style={S.nav}>
            {navItems.map(item => (
              <button key={item.key} style={{ ...S.navBtn, ...(tab===item.key ? S.navBtnActive:{}) }}
                onClick={()=>setTab(item.key)}>
                <span>{item.icon}</span>
                <span style={{ flex:1 }}>{item.label}</span>
                {!!item.badge && item.badge > 0 && (
                  <span style={S.navBadge}>{item.badge}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
        <div style={S.sideBottom}>
          <button style={S.logoutBtn} onClick={logout}>
            <FiLogOut size={14}/> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Content ── */}
      <main style={S.main}>

        {/* ══ OVERVIEW ══ */}
        {tab==="overview" && (
          <div style={S.content}>
            <div style={S.pageHead}>
              <div>
                <h1 style={S.pageTitle}>Platform Overview</h1>
                <p style={S.pageSub}>Live statistics across all platform activity</p>
              </div>
              <button style={S.refreshBtn} onClick={loadStats}>
                <FiRefreshCw size={13} style={statsLoading ? {animation:"spin 0.8s linear infinite"}:{}} /> Refresh
              </button>
            </div>

            {statsLoading || !stats ? (
              <div style={S.skeletonGrid}>{[...Array(4)].map((_,i)=><div key={i} style={S.skeleton}/>)}</div>
            ) : (
              <>
                <div style={S.statsRow}>
                  <StatCard icon={<FiUsers size={17}/>}     label="Total Users"      value={stats.users.total.toLocaleString()}   sub={`+${stats.users.new30d} this month`} trend="up" accent="#6366f1"/>
                  <StatCard icon={<FiBookOpen size={17}/>}  label="Total Courses"    value={stats.courses.toLocaleString()}       sub={`${stats.users.instructors} instructors`} accent="#f59e0b"/>
                  <StatCard icon={<FiDollarSign size={17}/>} label="Platform Revenue" value={`${formatVnd(stats.revenue.platform)} ₫`} sub={`${formatVnd(stats.revenue.last30d)} ₫ last 30d`} trend="up" accent="#22c55e"/>
                  <StatCard icon={<FiTrendingUp size={17}/>} label="Total Orders"    value={stats.orders.total.toLocaleString()}  sub={`+${stats.orders.new30d} this month`} trend="up" accent="#f43f5e"/>
                </div>

                <div style={S.overviewGrid}>
                  {/* Revenue chart */}
                  <div style={S.card}>
                    <div style={S.cardHead}><span style={S.cardTitle}><FiTrendingUp size={13}/> Monthly Revenue</span><span style={S.cardSub}>Last 6 months</span></div>
                    <div style={{ padding:"16px 16px 8px" }}>
                      <MiniChart data={stats.revenue.monthly}/>
                    </div>
                    {stats.revenue.monthly.slice(-1).map(m=>(
                      <div key={m.month} style={{ padding:"0 18px 14px", display:"flex", gap:20 }}>
                        <div><div style={{ fontSize:10, color:"#334155" }}>{m.month}</div><div style={{ fontSize:16, fontWeight:800, color:"#e2e8f0" }}>{formatVnd(m.revenue)} ₫</div><div style={{ fontSize:11, color:"#475569" }}>{m.orders} orders</div></div>
                      </div>
                    ))}
                  </div>

                  {/* User breakdown */}
                  <div style={S.card}>
                    <div style={S.cardHead}><span style={S.cardTitle}><FiUsers size={13}/> User Breakdown</span></div>
                    <div style={{ padding:"16px 18px", display:"flex", flexDirection:"column", gap:12 }}>
                      {[
                        { label:"Students",    val:stats.users.students,    color:"#22c55e" },
                        { label:"Instructors", val:stats.users.instructors, color:"#6366f1" },
                        { label:"Banned",      val:stats.users.banned,      color:"#ef4444" },
                      ].map(item=>(
                        <div key={item.label}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                            <span style={{ fontSize:12, color:"#64748b" }}>{item.label}</span>
                            <span style={{ fontSize:12, fontWeight:700, color:item.color }}>{item.val.toLocaleString()}</span>
                          </div>
                          <div style={{ height:5, background:"#1a2540", borderRadius:99, overflow:"hidden" }}>
                            <div style={{ height:"100%", borderRadius:99, background:item.color, width:`${stats.users.total ? (item.val/stats.users.total)*100 : 0}%`, transition:"width 0.5s" }}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pending payouts */}
                  <div style={{ ...S.card, ...(stats.withdrawals.pending>0 ? { borderColor:"rgba(245,158,11,0.3)" }:{}) }}>
                    <div style={S.cardHead}>
                      <span style={S.cardTitle}><RiBankLine size={13}/> Pending Payouts</span>
                      {stats.withdrawals.pending>0 && <span style={{ fontSize:11, fontWeight:700, color:"#fbbf24", background:"rgba(245,158,11,0.12)", padding:"2px 8px", borderRadius:999 }}>Action needed</span>}
                    </div>
                    <div style={{ padding:"18px" }}>
                      <div style={{ fontSize:32, fontWeight:800, color:"#fbbf24", marginBottom:4 }}>{stats.withdrawals.pending}</div>
                      <div style={{ fontSize:13, color:"#475569", marginBottom:16 }}>requests · {formatVnd(stats.withdrawals.pendingAmount)} ₫ total</div>
                      {stats.withdrawals.pending>0 && (
                        <button style={S.primaryBtn} onClick={()=>setTab("withdrawals")}>Review Now →</button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ USERS ══ */}
        {tab==="users" && (
          <div style={S.content}>
            <div style={S.pageHead}>
              <div><h1 style={S.pageTitle}>User Management</h1><p style={S.pageSub}>{userTotal} users · {stats?.users.banned??0} banned</p></div>
            </div>
            <div style={S.toolbar}>
              <div style={S.searchBox}>
                <FiSearch size={13} style={S.searchIcon}/>
                <input style={S.searchInput} placeholder="Search name or email..." value={uSearch}
                  onChange={e=>setUSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(setUserPage(1),loadUsers())}/>
              </div>
              <select style={S.sel} value={uRole} onChange={e=>{setURole(e.target.value);setUserPage(1);}}>
                <option value="all">All roles</option>
                <option value="user">Students</option>
                <option value="instructor">Instructors</option>
                <option value="admin">Admins</option>
              </select>
              <button style={S.refreshBtn} onClick={()=>{setUserPage(1);loadUsers();}}>
                <FiSearch size={13}/> Search
              </button>
            </div>

            <div style={S.card}>
              <div style={{ ...S.tHead, gridTemplateColumns:"1fr 160px 90px 90px 110px 130px" }}>
                <span>User</span><span>Email</span><span>Role</span><span>Status</span><span>Change Role</span><span>Actions</span>
              </div>
              {uLoading ? <div style={S.loadRow}><FiRefreshCw size={15} style={{animation:"spin 0.8s linear infinite"}}/> Loading...</div>
              : users.length===0 ? <div style={S.emptyRow}>No users found</div>
              : users.map(u=>(
                <div key={u.id} style={{ ...S.tRow, gridTemplateColumns:"1fr 160px 90px 90px 110px 130px", ...(u.isBanned ? {opacity:0.65}:{}) }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:"#e2e8f0" }}>{u.name}</div>
                    <div style={{ fontSize:11, color:"#334155" }}>…{u.id.slice(-8)}</div>
                  </div>
                  <span style={{ fontSize:11, color:"#64748b", wordBreak:"break-all" }}>{u.email}</span>
                  <Tag text={u.role} {...(ROLE_TAG[u.role]??ROLE_TAG.user)}/>
                  {u.isBanned
                    ? <span style={{ fontSize:11, color:"#f87171", fontWeight:600 }}>🚫 Banned</span>
                    : <span style={{ fontSize:11, color:"#22c55e" }}>Active</span>
                  }
                  <select style={S.roleSelect} value={u.role} onChange={e=>doChangeRole(u.id, e.target.value)}>
                    <option value="user">Student</option>
                    <option value="instructor">Instructor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <div style={{ display:"flex", gap:5 }}>
                    {u.isBanned
                      ? <button style={{ ...S.actionBtn, background:"rgba(34,197,94,0.1)", color:"#4ade80", border:"1px solid rgba(34,197,94,0.25)" }} onClick={()=>doUnban(u.id)}>Unban</button>
                      : <button style={{ ...S.actionBtn, background:"rgba(245,158,11,0.1)", color:"#fbbf24", border:"1px solid rgba(245,158,11,0.25)" }} onClick={()=>{ setBanModal(u); setBanReason(""); }}>Ban</button>
                    }
                    <button style={S.deleteBtn} onClick={()=>doDeleteUser(u.id)} title="Delete"><FiTrash2 size={12}/></button>
                  </div>
                </div>
              ))}
              <Pager page={userPage} total={userPages} onChange={setUserPage}/>
            </div>
          </div>
        )}

        {/* ══ COURSES ══ */}
        {tab==="courses" && (
          <div style={S.content}>
            <div style={S.pageHead}>
              <div><h1 style={S.pageTitle}>Course Management</h1><p style={S.pageSub}>{cTotal} courses on platform</p></div>
            </div>
            <div style={S.toolbar}>
              <div style={S.searchBox}>
                <FiSearch size={13} style={S.searchIcon}/>
                <input style={S.searchInput} placeholder="Search title, category, instructor..." value={cSearch}
                  onChange={e=>setCSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(setCPage(1),loadCourses())}/>
              </div>
              <button style={S.refreshBtn} onClick={()=>{setCPage(1);loadCourses();}}><FiSearch size={13}/> Search</button>
            </div>
            <div style={S.card}>
              <div style={{ ...S.tHead, gridTemplateColumns:"1fr 130px 100px 70px 110px 60px" }}>
                <span>Course</span><span>Instructor</span><span>Category</span><span>Students</span><span>Revenue</span><span>Del</span>
              </div>
              {cLoading ? <div style={S.loadRow}><FiRefreshCw size={15} style={{animation:"spin 0.8s linear infinite"}}/> Loading...</div>
              : courses.length===0 ? <div style={S.emptyRow}>No courses found</div>
              : courses.map(c=>(
                <div key={c.id} style={{ ...S.tRow, gridTemplateColumns:"1fr 130px 100px 70px 110px 60px" }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:"#e2e8f0", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:280 }}>{c.title}</div>
                    <div style={{ fontSize:11, color:"#334155" }}>{c.level} · {formatVnd(c.price)} ₫</div>
                  </div>
                  <span style={{ fontSize:12, color:"#64748b" }}>{c.instructorName??'—'}</span>
                  <span style={{ fontSize:12, color:"#475569" }}>{c.category}</span>
                  <span style={{ fontSize:13, fontWeight:600, color:"#e2e8f0" }}>{c.studentCount}</span>
                  <span style={{ fontSize:13, fontWeight:600, color:"#22c55e" }}>{formatVnd(c.revenue)} ₫</span>
                  <button style={S.deleteBtn} onClick={()=>doDeleteCourse(c.id,c.title)} title="Delete"><FiTrash2 size={12}/></button>
                </div>
              ))}
              <Pager page={cPage} total={cPages} onChange={setCPage}/>
            </div>
          </div>
        )}

        {/* ══ WITHDRAWALS ══ */}
        {tab==="withdrawals" && (
          <div style={S.content}>
            <div style={S.pageHead}>
              <div>
                <h1 style={S.pageTitle}>Withdrawal Requests</h1>
                <p style={S.pageSub}>{wTotal} requests · {stats?.withdrawals.pending??0} pending approval</p>
              </div>
            </div>
            <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
              {["all","pending","approved","rejected","cancelled"].map(s=>(
                <button key={s} style={{ ...S.filterTab, ...(wStatus===s ? S.filterTabActive:{}) }}
                  onClick={()=>{setWStatus(s);setWPage(1);}}>
                  {s==="pending"&&stats&&stats.withdrawals.pending>0&&<span style={S.tabDot}/>}
                  {s.charAt(0).toUpperCase()+s.slice(1)}
                </button>
              ))}
            </div>
            <div style={S.card}>
              <div style={{ ...S.tHead, gridTemplateColumns:"120px 1fr 100px 100px 90px 80px 160px" }}>
                <span>Date</span><span>Instructor</span><span>Amount</span><span>Net Payout</span><span>Bank</span><span>Status</span><span>Action</span>
              </div>
              {wLoading ? <div style={S.loadRow}><FiRefreshCw size={15} style={{animation:"spin 0.8s linear infinite"}}/> Loading...</div>
              : withdrawals.length===0 ? <div style={S.emptyRow}>No requests found</div>
              : withdrawals.map(w=>(
                <div key={w.id} style={{ ...S.tRow, gridTemplateColumns:"120px 1fr 100px 100px 90px 80px 160px" }}>
                  <div style={{ fontSize:11, color:"#475569" }}>{w.createdAt}</div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:"#e2e8f0" }}>{w.instructorName??'—'}</div>
                    <div style={{ fontSize:11, color:"#334155" }}>{w.instructorEmail}</div>
                  </div>
                  <span style={{ fontSize:13, fontWeight:600, color:"#e2e8f0" }}>{formatVnd(w.amount)} ₫</span>
                  <span style={{ fontSize:13, fontWeight:700, color:"#22c55e" }}>{formatVnd(w.netAmount)} ₫</span>
                  <div>
                    <div style={{ fontSize:11, color:"#64748b" }}>{w.bankSnapshot?.bankName??'—'}</div>
                    <div style={{ fontSize:10, color:"#334155" }}>{w.bankSnapshot?.accountNumber}</div>
                  </div>
                  <Tag text={W_STATUS[w.status]?.label??w.status} bg={W_STATUS[w.status]?.bg??"rgba(100,116,139,0.1)"} color={W_STATUS[w.status]?.color??"#94a3b8"}/>
                  {w.status==="pending" ? (
                    <div style={{ display:"flex", gap:6 }}>
                      <button style={{ ...S.actionBtn, background:"rgba(34,197,94,0.12)", color:"#4ade80", border:"1px solid rgba(34,197,94,0.25)" }}
                        onClick={()=>{setReviewModal({w,action:"approve"});setReviewNote("");}}>
                        <FiCheck size={11}/> Approve
                      </button>
                      <button style={{ ...S.actionBtn, background:"rgba(239,68,68,0.1)", color:"#f87171", border:"1px solid rgba(239,68,68,0.2)", padding:"5px 8px" }}
                        onClick={()=>{setReviewModal({w,action:"reject"});setReviewNote("");}}>
                        <FiX size={11}/>
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize:11, color:"#334155", fontStyle:"italic" }}>{w.note ? `"${w.note.slice(0,40)}"` : "—"}</div>
                  )}
                </div>
              ))}
              <Pager page={wPage} total={wPages} onChange={setWPage}/>
            </div>
          </div>
        )}

        {/* ══ BROADCAST ══ */}
        {tab==="broadcast" && (
          <div style={S.content}>
            <div style={S.pageHead}>
              <div><h1 style={S.pageTitle}>Broadcast Notifications</h1><p style={S.pageSub}>Send platform-wide announcements to users</p></div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 380px", gap:20, alignItems:"start" }}>
              {/* Compose */}
              <div style={S.card}>
                <div style={S.cardHead}><span style={S.cardTitle}><FiSend size={13}/> Compose Message</span></div>
                <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
                  <div>
                    <label style={S.label}>Target Audience <span style={{ color:"#f43f5e" }}>*</span></label>
                    <div style={{ display:"flex", gap:8, marginTop:8 }}>
                      {[["all","Everyone"],["users","Students only"],["instructors","Instructors only"]].map(([val,lab])=>(
                        <button key={val} style={{ flex:1, padding:"9px 8px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s",
                          background: bTarget===val ? "rgba(99,102,241,0.15)":"transparent",
                          border: bTarget===val ? "1px solid rgba(99,102,241,0.4)":"1px solid rgba(255,255,255,0.08)",
                          color: bTarget===val ? "#a5b4fc":"#64748b",
                        }} onClick={()=>setBTarget(val)}>{lab}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={S.label}>Title <span style={{ color:"#f43f5e" }}>*</span></label>
                    <input style={{ ...S.input, marginTop:6, width:"100%", boxSizing:"border-box" as const }}
                      placeholder="e.g. 🎉 New courses available this week!"
                      value={bTitle} onChange={e=>setBTitle(e.target.value)} maxLength={255}/>
                    <span style={{ fontSize:11, color:"#334155" }}>{bTitle.length}/255</span>
                  </div>

                  <div>
                    <label style={S.label}>Message <span style={{ color:"#f43f5e" }}>*</span></label>
                    <textarea style={{ ...S.input, marginTop:6, width:"100%", boxSizing:"border-box" as const, height:100, resize:"none", lineHeight:1.5 }}
                      placeholder="Write your announcement here..."
                      value={bBody} onChange={e=>setBBody(e.target.value)}/>
                  </div>

                  <div>
                    <label style={S.label}>Link (optional)</label>
                    <input style={{ ...S.input, marginTop:6, width:"100%", boxSizing:"border-box" as const }}
                      placeholder="e.g. /courses?category=AI"
                      value={bLink} onChange={e=>setBLink(e.target.value)}/>
                  </div>

                  <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:"rgba(99,102,241,0.06)", borderRadius:9, border:"1px solid rgba(99,102,241,0.15)" }}>
                    <FiBell size={14} style={{ color:"#a5b4fc", flexShrink:0 }}/>
                    <span style={{ fontSize:12, color:"#64748b" }}>
                      This will create a notification for <strong style={{ color:"#a5b4fc" }}>every {bTarget==="all"?"user and instructor":bTarget==="users"?"student":"instructor"}</strong> on the platform.
                    </span>
                  </div>

                  <button style={{ ...S.primaryBtn, padding:"12px", justifyContent:"center" }}
                    onClick={doSendBroadcast} disabled={bSending||!bTitle.trim()||!bBody.trim()}>
                    {bSending ? <><span style={S.spinnerSm}/> Sending...</> : <><FiSend size={13}/> Send Broadcast</>}
                  </button>
                </div>
              </div>

              {/* History */}
              <div style={S.card}>
                <div style={S.cardHead}>
                  <span style={S.cardTitle}><FiRefreshCw size={13}/> Recent Broadcasts</span>
                  <button style={{ ...S.refreshBtn, fontSize:11, padding:"4px 10px" }} onClick={loadBroadcasts}>Refresh</button>
                </div>
                {broadcasts.length===0 ? (
                  <div style={{ padding:"2rem", textAlign:"center", color:"#334155", fontSize:13 }}>No broadcasts yet</div>
                ) : broadcasts.map((b,i)=>(
                  <div key={i} style={{ padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:"#e2e8f0" }}>{b.title}</span>
                      <span style={{ fontSize:11, color:"#475569" }}>{b.recipientCount} recipients</span>
                    </div>
                    <p style={{ fontSize:12, color:"#64748b", margin:"0 0 5px", lineHeight:1.4,
                      display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" as const, overflow:"hidden" }}>
                      {b.body}
                    </p>
                    <span style={{ fontSize:10, color:"#334155" }}>{b.sentAt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} input:focus,textarea:focus{outline:none;border-color:rgba(99,102,241,0.6)!important;box-shadow:0 0 0 3px rgba(99,102,241,0.12)!important}`}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  root: { display:"flex", minHeight:"100vh", background:"#020617", color:"#e2e8f0", fontFamily:'"Inter",system-ui,-apple-system,sans-serif' },

  sidebar: { width:210, flexShrink:0, background:"#080f1e", borderRight:"1px solid rgba(255,255,255,0.06)", display:"flex", flexDirection:"column", position:"sticky", top:0, height:"100vh" },
  sideTop: { flex:1, display:"flex", flexDirection:"column" },
  sideLogo: { display:"flex", alignItems:"center", gap:10, padding:"18px 16px 16px", borderBottom:"1px solid rgba(255,255,255,0.05)" },
  sideLogoIcon: { width:32, height:32, borderRadius:8, background:"linear-gradient(135deg,#6366f1,#4f46e5)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", flexShrink:0 },
  sideLogoTitle: { fontSize:13, fontWeight:800, color:"#e2e8f0" },
  sideLogoSub:   { fontSize:10, color:"#334155" },
  nav: { flex:1, padding:"10px 8px", display:"flex", flexDirection:"column", gap:2 },
  navBtn: { display:"flex", alignItems:"center", gap:9, padding:"8px 10px", borderRadius:7, border:"none", background:"transparent", color:"#475569", fontFamily:"inherit", fontSize:12, fontWeight:500, cursor:"pointer", width:"100%", textAlign:"left", transition:"all 0.15s" },
  navBtnActive: { background:"rgba(99,102,241,0.12)", color:"#a5b4fc", fontWeight:700 },
  navBadge: { background:"#ef4444", color:"#fff", fontSize:10, fontWeight:800, padding:"1px 5px", borderRadius:999, marginLeft:"auto" },
  sideBottom: { padding:"10px 8px 16px" },
  logoutBtn: { display:"flex", alignItems:"center", gap:7, width:"100%", padding:"8px 10px", borderRadius:7, border:"1px solid rgba(255,255,255,0.06)", background:"transparent", color:"#475569", fontFamily:"inherit", fontSize:12, cursor:"pointer" },

  main:    { flex:1, minWidth:0, overflowY:"auto" },
  content: { padding:"22px 26px", maxWidth:1200 },
  pageHead: { display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:22, gap:12 },
  pageTitle: { fontSize:20, fontWeight:800, color:"#f1f5f9", margin:"0 0 4px", letterSpacing:"-0.02em" },
  pageSub:   { fontSize:12, color:"#334155", margin:0 },

  refreshBtn: { display:"flex", alignItems:"center", gap:6, padding:"7px 12px", borderRadius:8, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", color:"#64748b", fontFamily:"inherit", fontSize:12, fontWeight:600, cursor:"pointer" },

  statsRow: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:18 },
  statCard: { background:"#0d1527", border:"1px solid rgba(255,255,255,0.07)", borderTop:"3px solid", borderRadius:12, padding:"14px 16px", display:"flex", alignItems:"flex-start", gap:12 },
  statIcon: { width:36, height:36, borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  statLabel: { fontSize:10, color:"#334155", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em" },
  statValue: { fontSize:20, fontWeight:800, color:"#f1f5f9", letterSpacing:"-0.02em", lineHeight:1.2, margin:"2px 0" },
  statSub:   { fontSize:11, display:"flex", alignItems:"center", gap:3 },

  overviewGrid: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginTop:4 },

  card: { background:"#0d1527", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, overflow:"hidden", marginBottom:0 },
  cardHead: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 16px", borderBottom:"1px solid rgba(255,255,255,0.05)" },
  cardTitle: { fontSize:12, fontWeight:700, color:"#e2e8f0", display:"flex", alignItems:"center", gap:6 },
  cardSub:   { fontSize:11, color:"#334155" },

  toolbar: { display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" },
  searchBox: { position:"relative", flex:"1 1 200px", minWidth:180 },
  searchIcon: { position:"absolute", left:11, top:"50%", transform:"translateY(-50%)", color:"#334155", pointerEvents:"none" },
  searchInput: { width:"100%", boxSizing:"border-box" as const, paddingLeft:32, paddingRight:10, paddingTop:8, paddingBottom:8, background:"#0d1527", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, color:"#e2e8f0", fontFamily:"inherit", fontSize:12, outline:"none" },
  sel: { padding:"8px 10px", background:"#0d1527", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, color:"#e2e8f0", fontFamily:"inherit", fontSize:12, cursor:"pointer" },

  tHead: { display:"grid", gap:8, padding:"8px 16px", borderBottom:"1px solid rgba(255,255,255,0.04)", fontSize:10, fontWeight:700, color:"#334155", textTransform:"uppercase", letterSpacing:"0.05em" },
  tRow:  { display:"grid", gap:8, padding:"11px 16px", borderBottom:"1px solid rgba(255,255,255,0.03)", alignItems:"center", transition:"background 0.1s" },
  loadRow:  { padding:"1.8rem", textAlign:"center", color:"#334155", fontSize:12, display:"flex", alignItems:"center", justifyContent:"center", gap:8 },
  emptyRow: { padding:"2rem", textAlign:"center", color:"#334155", fontSize:13 },

  pagerBtn: { width:28, height:28, borderRadius:6, border:"1px solid rgba(255,255,255,0.07)", background:"transparent", color:"#475569", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" },

  filterTab: { display:"flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:7, border:"1px solid rgba(255,255,255,0.07)", background:"transparent", color:"#475569", fontFamily:"inherit", fontSize:11, fontWeight:500, cursor:"pointer", transition:"all 0.15s" },
  filterTabActive: { background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.3)", color:"#a5b4fc", fontWeight:700 },
  tabDot: { width:6, height:6, borderRadius:"50%", background:"#f59e0b", boxShadow:"0 0 5px rgba(245,158,11,0.6)" },

  actionBtn: { display:"inline-flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius:6, fontFamily:"inherit", fontSize:11, fontWeight:700, cursor:"pointer" },
  deleteBtn: { width:28, height:28, borderRadius:6, border:"1px solid rgba(239,68,68,0.2)", background:"rgba(239,68,68,0.08)", color:"#f87171", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" },
  roleSelect: { padding:"5px 8px", background:"#080f1e", border:"1px solid rgba(255,255,255,0.07)", borderRadius:6, color:"#e2e8f0", fontFamily:"inherit", fontSize:11, cursor:"pointer" },

  primaryBtn: { display:"inline-flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:8, border:"none", background:"#6366f1", color:"#fff", fontFamily:"inherit", fontSize:12, fontWeight:700, cursor:"pointer" },
  ghostBtn:   { display:"inline-flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:8, border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"#64748b", fontFamily:"inherit", fontSize:12, fontWeight:600, cursor:"pointer" },

  overlay: { position:"fixed", inset:0, background:"rgba(2,6,23,0.8)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9998, backdropFilter:"blur(4px)" },
  modal:   { background:"#0d1527", border:"1px solid rgba(255,255,255,0.1)", borderRadius:16, padding:"26px 28px", width:440, maxWidth:"90vw", boxShadow:"0 24px 60px rgba(0,0,0,0.7)" },
  modalClose: { width:28, height:28, borderRadius:7, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#475569", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" },

  label: { fontSize:11, fontWeight:600, color:"#475569", letterSpacing:"0.02em" },
  input: { background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:"#e2e8f0", padding:"9px 12px", fontSize:13, fontFamily:"inherit" },

  skeletonGrid: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:18 },
  skeleton: { height:90, borderRadius:12, background:"#0d1527", animation:"sk-pulse 1.4s ease infinite" },

  toast: { position:"fixed", top:20, right:24, zIndex:9999, display:"flex", alignItems:"center", gap:8, padding:"11px 16px", borderRadius:9, fontSize:12, fontWeight:600, boxShadow:"0 8px 24px rgba(0,0,0,0.5)" },
  toastOk:  { background:"#14532d", border:"1px solid rgba(34,197,94,0.3)",  color:"#4ade80" },
  toastErr: { background:"#7f1d1d", border:"1px solid rgba(239,68,68,0.3)",  color:"#f87171" },

  spinnerSm: { width:14, height:14, borderRadius:"50%", border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"#fff", animation:"spin 0.7s linear infinite", display:"inline-block" },
};