import { useState } from "react";
import type React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { MdOutlineEmail, MdLockOutline, MdPersonOutline } from "react-icons/md";
import { HiOutlineAcademicCap, HiOutlineUserGroup } from "react-icons/hi2";
import axiosInstance from "../../lib/axios";
import Footer from "../../common/Footer";
import "../../style/components/_register.scss";
import { useToast } from "../../context/toast";   // ← THÊM

interface SignupResponse { message: string; userId: string; }

function Register() {
  const navigate = useNavigate();
  const toast    = useToast();                     // ← THÊM

  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [role,     setRole]     = useState<"" | "user" | "instructor">("");
  const [agree,    setAgree]    = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // ── Validate với toast ──────────────────────────────────────
    if (!name.trim()) {
      toast.warning("Please enter your full name ");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      toast.warning("Invalid email address", "Please enter a valid email format.");
      return;
    }
    if (password.length < 6) {
      toast.warning("Password is too short", "Password must be at least 6 characters");
      return;
    }
    if (!role) {
      toast.warning("Select your role", "Please choose learner or instructor to continue.");
      setError("PLease choose your role");
      return;
    }

    setLoading(true);
    try {
      await axiosInstance.post<SignupResponse>("/auth/signup", { name, email, password, role });

      // ✅ Thành công → toast rồi chuyển trang
      toast.success(
        "Sign up successful. 🎉",
        "Your account has been created. Please sign in to continue."
      );

      setName(""); setEmail(""); setPassword(""); setRole("");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg    = (err as { response?: { data?: { message?: string } } })
                       ?.response?.data?.message ?? "Sign up failed, please try again.";

      if (status === 409) {
        toast.error("Email has been used", "Try log in again or use another email.");
      } else if (status === 400) {
        toast.error("Invalid information", msg);
      } else {
        toast.error("Sign up failed", msg);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="register-page">
      <div className="register-split">
        <div className="register-brand">
          <div className="register-brand__inner">
            <span className="register-brand__badge">CTUET</span>
            <h2 className="register-brand__headline">Start your<br />journey today.</h2>
            <p className="register-brand__sub">Choose your role and start studying or teaching journey today.</p>
            <div className="register-brand__roles">
              <div className="register-brand__role-card">
                <HiOutlineUserGroup className="register-brand__role-icon" />
                <div><strong>Learner</strong><span>Approaching hundred of practical courses</span></div>
              </div>
              <div className="register-brand__role-card">
                <HiOutlineAcademicCap className="register-brand__role-icon" />
                <div><strong>Instructor</strong><span>Share knowledge, generate income</span></div>
              </div>
            </div>
          </div>
          <div className="register-brand__blob register-brand__blob--1" aria-hidden="true" />
          <div className="register-brand__blob register-brand__blob--2" aria-hidden="true" />
        </div>
        <div className="register-form-panel">
          <div className="register-card">
            <div className="register-card__header">
              <h1>Create an account</h1>
              <p>FREE — Only 30 second</p>
            </div>
            {error && <div className="register-card__error" role="alert">{error}</div>}
            <form className="register-card__form" onSubmit={handleSubmit} noValidate>
              <div className="reg-field">
                <label htmlFor="reg-name">Full Name</label>
                <div className="reg-field__wrap">
                  <MdPersonOutline className="reg-field__icon" aria-hidden="true" />
                  <input id="reg-name" type="text" placeholder="Jonh Cena"
                    autoComplete="name" required value={name}
                    onChange={(e) => setName(e.target.value)} />
                </div>
              </div>
              <div className="reg-field">
                <label htmlFor="reg-email">Email</label>
                <div className="reg-field__wrap">
                  <MdOutlineEmail className="reg-field__icon" aria-hidden="true" />
                  <input id="reg-email" type="email" placeholder="you@example.com"
                    autoComplete="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="reg-field">
                <label htmlFor="reg-password">Password</label>
                <div className="reg-field__wrap">
                  <MdLockOutline className="reg-field__icon" aria-hidden="true" />
                  <input id="reg-password" type="password" placeholder="Atleast 6 characters"
                    autoComplete="new-password" required minLength={6} value={password}
                    onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              <div className="reg-field">
                <label>Role</label>
                <div className="reg-role-group">
                  <button type="button"
                    className={`reg-role-btn ${role === "user" ? "reg-role-btn--active" : ""}`}
                    onClick={() => setRole("user")}>
                    <HiOutlineUserGroup /> Learner
                  </button>
                  <button type="button"
                    className={`reg-role-btn ${role === "instructor" ? "reg-role-btn--active" : ""}`}
                    onClick={() => setRole("instructor")}>
                    <HiOutlineAcademicCap /> Instructor
                  </button>
                </div>
              </div>
              <label className="reg-checkbox">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>Send more special deals and personalize suggestion.</span>
              </label>
              <button className={`register-card__submit ${loading ? "register-card__submit--loading" : ""}`}
                type="submit" disabled={loading}>
                {loading ? <span className="register-card__spinner" /> : "Create an account"}
              </button>
            </form>
            <div className="register-card__divider"><span>Or sign up with</span></div>
            <div className="register-card__social">
              {[
                { src: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/1200px-Google_%22G%22_logo.svg.png", alt: "Google" },
                { src: "https://www.pngplay.com/wp-content/uploads/9/Facebook-Free-PNG.png", alt: "Facebook" },
                { src: "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg", alt: "Apple" },
              ].map(({ src, alt }) => (
                <NavLink key={alt} to="/" className="register-card__social-btn" aria-label={alt}>
                  <img src={src} alt={alt} />
                </NavLink>
              ))}
            </div>
            <p className="register-card__terms">
              By signing up, please agreed with{" "}
              <NavLink to="/terms">Term of use</NavLink> and{" "}
              <NavLink to="/privacy">Privacy policy</NavLink>.
            </p>
            <div className="register-card__divider"><span>Already have an account?</span></div>
            <p className="register-card__login">
              <NavLink to="/login">Sign in here→</NavLink>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </section>
  );
}

export default Register;