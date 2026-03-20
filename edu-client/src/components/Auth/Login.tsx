import "../../style/components/_login.scss";
import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type React from "react";
import { MdOutlineEmail, MdLockOutline } from "react-icons/md";
import axiosInstance from "../../lib/axios";
import Footer from "../../common/Footer";
import { useToast } from "../../context/toast";   // ← THÊM

interface LoginProps {
  setIsAuthenticated?: (value: boolean) => void;
  setRole?: (value: string) => void;
}
interface LoginResponse  { token: string; role: string; userId: string; }
interface UserVerifyResponse { userId: string; }

function Login({ setIsAuthenticated, setRole }: LoginProps) {
  const navigate = useNavigate();
  const toast    = useToast();                     // ← THÊM

  const safeSetIsAuthenticated = setIsAuthenticated ?? (() => undefined);
  const safeSetRole            = setRole            ?? (() => undefined);

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

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
          navigate(role === "instructor" ? "/instructor-dashboard" : "/authenticated-home");
        }
      } catch { localStorage.removeItem("token"); }
    };
    verify();
  }, [navigate, safeSetIsAuthenticated, safeSetRole]);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Client-side validation với toast
    if (!email.trim()) {
      toast.warning("Please enter your email!");
      return;
    }
    if (!password) {
      toast.warning("Please enter your password");
      return;
    }

    setLoading(true);
    try {
      const res = await axiosInstance.post<LoginResponse>("/auth/login", { email, password });
      console.log(res)
      const { token, role, userId } = res.data;

      localStorage.setItem("token",  token);
      localStorage.setItem("role",   role);
      localStorage.setItem("userId", userId);
      if (role === "instructor") localStorage.setItem("instructorId", userId);

      safeSetIsAuthenticated(true);
      safeSetRole(role);

      toast.success(
        "Đăng nhập thành công!",
        `Chào mừng bạn trở lại 👋`
      );

      setEmail(""); setPassword("");
      navigate(role === "instructor" ? "/instructor-dashboard" : "/authenticated-home");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg    = (err as { response?: { data?: { message?: string } } })
                       ?.response?.data?.message ?? "Đăng nhập thất bại";

      
      if (status === 401) {
        toast.error("Sai mật khẩu", "Mật khẩu bạn nhập không đúng. Vui lòng thử lại.");
      } else if (status === 404) {
        toast.error("Tài khoản không tồn tại", "Email này chưa được đăng ký.");
      } else if (status === 403) {
        toast.error("Tài khoản bị khóa", "Liên hệ admin để được hỗ trợ.");
      } else {
        toast.error("Đăng nhập thất bại", msg);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="login-page">
      <div className="login-split">
        <div className="login-brand">
          <div className="login-brand__inner">
            <span className="login-brand__badge">CTUET</span>
            <h2 className="login-brand__headline">Learn without<br />limits.</h2>
            <p className="login-brand__sub">Join thousands of students mastering real-world skills every day.</p>
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
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  <span>Remember me</span>
                </label>
                <NavLink to="/forgot-password" className="login-card__forgot">Forgot password?</NavLink>
              </div>
              <button className={`login-card__submit ${loading ? "login-card__submit--loading" : ""}`}
                type="submit" disabled={loading}>
                {loading ? <span className="login-card__spinner" /> : "Sign In"}
              </button>
            </form>
            <div className="login-card__divider"><span>or</span></div>
            <p className="login-card__signup">
              Don't have an account? <NavLink to="/signup">Create one free</NavLink>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </section>
  );
}

export default Login;