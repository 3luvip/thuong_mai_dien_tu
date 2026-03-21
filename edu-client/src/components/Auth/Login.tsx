import "../../style/components/_login.scss";
import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type React from "react";
import { MdOutlineEmail, MdLockOutline, MdOutlineBlock } from "react-icons/md";
import axiosInstance from "../../lib/axios";
import Footer from "../../common/Footer";
import { useToast } from "../../context/toast";

interface LoginProps {
  setIsAuthenticated?: (value: boolean) => void;
  setRole?: (value: string) => void;
}
interface LoginResponse {
  token: string;
  role: string;
  userId: string;
  banned?: boolean;
  reason?: string;
}
interface UserVerifyResponse { userId: string; }

function redirectByRole(role: string, navigate: (path: string) => void) {
  if (role === "admin")            navigate("/admin/dashboard");
  else if (role === "instructor")  navigate("/instructor-dashboard");
  else                             navigate("/authenticated-home");
}

// ─── Ban Modal ────────────────────────────────────────────────────────────────
function BanModal({ reason, onClose }: { reason: string; onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(4px)",
          zIndex: 9998,
          animation: "fadeIn 0.2s ease",
        }}
      />

      {/* Modal */}
      <div style={{
        position: "fixed",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 9999,
        width: "min(480px, calc(100vw - 48px))",
        background: "#0f172a",
        border: "1px solid rgba(239,68,68,0.3)",
        borderRadius: 16,
        padding: "32px 28px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        animation: "slideUp 0.25s cubic-bezier(0.22,1,0.36,1)",
        fontFamily: "Inter, system-ui, sans-serif",
      }}>
        {/* Icon */}
        <div style={{
          width: 64, height: 64,
          borderRadius: "50%",
          background: "rgba(239,68,68,0.1)",
          border: "2px solid rgba(239,68,68,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
          fontSize: 30, color: "#ef4444",
        }}>
          <MdOutlineBlock />
        </div>

        {/* Title */}
        <h2 style={{
          textAlign: "center",
          fontSize: "1.3rem", fontWeight: 800,
          color: "#f1f5f9", margin: "0 0 10px",
          letterSpacing: "-0.3px",
        }}>
          Account Suspended
        </h2>

        <p style={{
          textAlign: "center",
          fontSize: "0.88rem", color: "#94a3b8",
          margin: "0 0 24px", lineHeight: 1.6,
        }}>
          Your account has been suspended by an administrator.
        </p>

        {/* Reason box */}
        <div style={{
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 10,
          padding: "14px 16px",
          marginBottom: 24,
        }}>
          <p style={{
            fontSize: "0.75rem", fontWeight: 700,
            color: "#ef4444", textTransform: "uppercase",
            letterSpacing: "0.08em", margin: "0 0 6px",
          }}>
            Reason
          </p>
          <p style={{
            fontSize: "0.9rem", color: "#fca5a5",
            margin: 0, lineHeight: 1.6,
          }}>
            {reason}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <a
            href="mailto:support@ctuet.edu.vn"
            style={{
              flex: 1, textAlign: "center",
              padding: "11px 0",
              background: "#6366f1", color: "#fff",
              borderRadius: 9, fontSize: "0.88rem",
              fontWeight: 600, textDecoration: "none",
            }}
          >
            Contact Support
          </a>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "11px 0",
              background: "transparent", color: "#94a3b8",
              border: "1px solid rgba(148,163,184,0.2)",
              borderRadius: 9, fontSize: "0.88rem",
              fontWeight: 500, cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Close
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, calc(-50% + 16px)); }
          to   { opacity: 1; transform: translate(-50%, -50%); }
        }
      `}</style>
    </>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────
function Login({ setIsAuthenticated, setRole }: LoginProps) {
  const navigate = useNavigate();
  const toast    = useToast();

  const safeSetIsAuthenticated = setIsAuthenticated ?? (() => undefined);
  const safeSetRole            = setRole            ?? (() => undefined);

  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [remember,  setRemember]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [banReason, setBanReason] = useState<string | null>(null);

  useEffect(() => {
    const verify = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        await axiosInstance.get<UserVerifyResponse>("/auth/verify");
        const role = localStorage.getItem("role");
        if (role) {
          safeSetIsAuthenticated(true);
          safeSetRole(role);
          redirectByRole(role, navigate);
        }
      } catch { localStorage.removeItem("token"); }
    };
    verify();
  }, [navigate, safeSetIsAuthenticated, safeSetRole]);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) { toast.warning("Please enter your email!"); return; }
    if (!password)     { toast.warning("Please enter your password"); return; }

    setLoading(true);
    try {
      const res = await axiosInstance.post<LoginResponse>("/auth/login", { email, password });
      const data = res.data;

      // Tài khoản bị ban — hiện modal với lý do
      if (data.banned) {
        setBanReason(data.reason ?? "Violation of Terms of Service.");
        setLoading(false);
        return;
      }

      const { token, role, userId } = data;

      localStorage.setItem("token",  token);
      localStorage.setItem("role",   role);
      localStorage.setItem("userId", userId);
      if (role === "instructor") localStorage.setItem("instructorId", userId);

      safeSetIsAuthenticated(true);
      safeSetRole(role);

      toast.success("Login Successfully!", "Welcome Back 👋");
      setEmail(""); setPassword("");
      redirectByRole(role, navigate);

    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg    = (err as { response?: { data?: { message?: string } } })
                       ?.response?.data?.message ?? "Login failed";

      if (status === 401) {
        toast.error("Wrong password", "Please try again.");
      } else if (status === 404) {
        toast.error("Account not found", "This email has not been registered.");
      } else {
        toast.error("Login failed", msg);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="login-page">
      {/* Ban modal */}
      {banReason && (
        <BanModal
          reason={banReason}
          onClose={() => setBanReason(null)}
        />
      )}

      <div className="login-split">
        <div className="login-brand">
          <div className="login-brand__inner">
            <span className="login-brand__badge">CTUET</span>
            <h2 className="login-brand__headline">Learn without<br />limits.</h2>
            <p className="login-brand__sub">
              Join thousands of students mastering real-world skills every day.
            </p>
            <ul className="login-brand__pills">
              {["Web Development","AI & Machine Learning","Blockchain","Mobile Apps"].map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div className="login-brand__blob login-brand__blob--1" aria-hidden="true" />
          <div className="login-brand__blob login-brand__blob--2" aria-hidden="true" />
        </div>

        <div className="login-form-panel">
          <div className="login-card">
            <div className="login-card__header">
              <h1>Welcome back</h1>
              <p>Sign in to continue learning</p>
            </div>

            {error && <div className="login-card__error" role="alert">{error}</div>}

            <form className="login-card__form" onSubmit={handleSubmit} noValidate>
              <div className="login-field">
                <label htmlFor="login-email">Email</label>
                <div className="login-field__input-wrap">
                  <MdOutlineEmail className="login-field__icon" aria-hidden="true" />
                  <input id="login-email" type="email" placeholder="you@example.com"
                    autoComplete="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="login-field">
                <label htmlFor="login-password">Password</label>
                <div className="login-field__input-wrap">
                  <MdLockOutline className="login-field__icon" aria-hidden="true" />
                  <input id="login-password" type="password" placeholder="••••••••"
                    autoComplete="current-password" required value={password}
                    onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              <div className="login-card__meta">
                <label className="login-card__remember">
                  <input type="checkbox" checked={remember}
                    onChange={(e) => setRemember(e.target.checked)} />
                  <span>Remember me</span>
                </label>
                <NavLink to="/forgot-password" className="login-card__forgot">
                  Forgot password?
                </NavLink>
              </div>
              <button
                className={`login-card__submit ${loading ? "login-card__submit--loading" : ""}`}
                type="submit" disabled={loading}
              >
                {loading ? <span className="login-card__spinner" /> : "Sign In"}
              </button>
            </form>

            <div className="login-card__divider"><span>or</span></div>
            <p className="login-card__signup">
              Don't have an account?{" "}
              <NavLink to="/signup">Create one free</NavLink>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </section>
  );
}

export default Login;