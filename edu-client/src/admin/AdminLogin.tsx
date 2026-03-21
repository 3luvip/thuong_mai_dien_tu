// src/admin/AdminLogin.tsx
// Completely standalone admin login — separate localStorage keys

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiShield, FiMail, FiLock, FiEye, FiEyeOff, FiAlertCircle } from "react-icons/fi";
import axiosInstance from "../lib/axios";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Please fill in all fields"); return; }
    setLoading(true);
    try {
      const res = await axiosInstance.post("/auth/login", { email, password });
      const { token, role, userId } = res.data;
      if (role !== "admin") {
        setError("Access denied. Admin credentials required.");
        return;
      }
      // Store with separate keys so admin session doesn't affect main app
      localStorage.setItem("adminToken",  token);
      localStorage.setItem("adminUserId", userId);
      localStorage.setItem("adminRole",   role);
      navigate("/admin/dashboard");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg?.includes("Unauthorized") || msg?.includes("password")) {
        setError("Invalid email or password.");
      } else {
        setError(msg ?? "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Logo */}
        <div style={S.logoWrap}>
          <div style={S.logoIcon}><FiShield size={26} /></div>
          <div>
            <div style={S.logoTitle}>Admin Portal</div>
            <div style={S.logoSub}>CTUET Learning Platform</div>
          </div>
        </div>

        <h1 style={S.heading}>Sign in to Admin</h1>
        <p style={S.subtext}>Restricted access — administrators only</p>

        {error && (
          <div style={S.errorBox}>
            <FiAlertCircle size={14} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={S.form} noValidate>
          <div style={S.field}>
            <label style={S.label}>Email address</label>
            <div style={S.inputWrap}>
              <FiMail size={15} style={S.inputIcon} />
              <input
                style={S.input}
                type="email"
                placeholder="admin@ctuet.edu.vn"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div style={S.field}>
            <label style={S.label}>Password</label>
            <div style={S.inputWrap}>
              <FiLock size={15} style={S.inputIcon} />
              <input
                style={{ ...S.input, paddingRight: 42 }}
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                style={S.eyeBtn}
                onClick={() => setShowPw(v => !v)}
              >
                {showPw ? <FiEyeOff size={14} /> : <FiEye size={14} />}
              </button>
            </div>
          </div>

          <button type="submit" style={S.submitBtn} disabled={loading}>
            {loading ? (
              <span style={S.spinner} />
            ) : (
              <><FiShield size={15} /> Sign In</>
            )}
          </button>
        </form>

        <p style={S.footer}>
          This portal is for authorized administrators only.
          Unauthorized access attempts are logged.
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #334155; }
        input:focus { outline: none; border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
      `}</style>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#020617",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
  },
  card: {
    width: "100%",
    maxWidth: 400,
    background: "#0d1527",
    border: "1px solid rgba(99,102,241,0.2)",
    borderRadius: 18,
    padding: "36px 32px",
    boxShadow: "0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.08)",
  },
  logoWrap: {
    display: "flex", alignItems: "center", gap: 12, marginBottom: 28,
  },
  logoIcon: {
    width: 46, height: 46, borderRadius: 12,
    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", flexShrink: 0,
    boxShadow: "0 4px 14px rgba(99,102,241,0.4)",
  },
  logoTitle: { fontSize: 15, fontWeight: 800, color: "#e2e8f0" },
  logoSub:   { fontSize: 11, color: "#475569", marginTop: 2 },
  heading:   { fontSize: 22, fontWeight: 800, color: "#f1f5f9", margin: "0 0 6px", letterSpacing: "-0.02em" },
  subtext:   { fontSize: 13, color: "#475569", margin: "0 0 24px" },
  errorBox: {
    display: "flex", alignItems: "center", gap: 8,
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: 9, padding: "10px 14px", fontSize: 13, color: "#f87171",
    marginBottom: 18,
  },
  form:  { display: "flex", flexDirection: "column", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12, fontWeight: 600, color: "#64748b", letterSpacing: "0.01em" },
  inputWrap: { position: "relative" },
  inputIcon: {
    position: "absolute", left: 13, top: "50%",
    transform: "translateY(-50%)", color: "#334155", pointerEvents: "none",
  },
  input: {
    width: "100%", boxSizing: "border-box" as const,
    paddingLeft: 38, paddingRight: 14, paddingTop: 11, paddingBottom: 11,
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10, color: "#e2e8f0", fontFamily: "inherit", fontSize: 14,
    transition: "border-color 0.15s, box-shadow 0.15s",
  },
  eyeBtn: {
    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
    background: "transparent", border: "none", color: "#475569",
    cursor: "pointer", display: "flex", alignItems: "center",
  },
  submitBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "12px", borderRadius: 10, border: "none",
    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
    color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 700,
    cursor: "pointer", marginTop: 4,
    boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
    transition: "opacity 0.15s",
  },
  spinner: {
    width: 18, height: 18, borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.25)",
    borderTopColor: "#fff",
    animation: "spin 0.7s linear infinite",
    display: "inline-block",
  },
  footer: { fontSize: 11, color: "#334155", textAlign: "center", margin: "20px 0 0", lineHeight: 1.6 },
};