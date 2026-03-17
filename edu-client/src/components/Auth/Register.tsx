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
      toast.warning("Vui lòng nhập họ và tên");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      toast.warning("Email không hợp lệ", "Vui lòng nhập đúng định dạng email.");
      return;
    }
    if (password.length < 6) {
      toast.warning("Mật khẩu quá ngắn", "Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    if (!role) {
      toast.warning("Vui lòng chọn vai trò", "Chọn Học viên hoặc Giảng viên để tiếp tục.");
      setError("Vui lòng chọn vai trò của bạn.");
      return;
    }

    setLoading(true);
    try {
      await axiosInstance.post<SignupResponse>("/auth/signup", { name, email, password, role });

      // ✅ Thành công → toast rồi chuyển trang
      toast.success(
        "Đăng ký thành công! 🎉",
        "Tài khoản của bạn đã được tạo. Hãy đăng nhập để bắt đầu."
      );

      setName(""); setEmail(""); setPassword(""); setRole("");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg    = (err as { response?: { data?: { message?: string } } })
                       ?.response?.data?.message ?? "Đăng ký thất bại, vui lòng thử lại.";

      if (status === 409) {
        toast.error("Email đã được sử dụng", "Thử đăng nhập hoặc dùng email khác.");
      } else if (status === 400) {
        toast.error("Thông tin không hợp lệ", msg);
      } else {
        toast.error("Đăng ký thất bại", msg);
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
            <p className="register-brand__sub">Chọn vai trò của bạn và bắt đầu hành trình học tập hoặc giảng dạy ngay hôm nay.</p>
            <div className="register-brand__roles">
              <div className="register-brand__role-card">
                <HiOutlineUserGroup className="register-brand__role-icon" />
                <div><strong>Học viên</strong><span>Tiếp cận hàng trăm khóa học thực chiến</span></div>
              </div>
              <div className="register-brand__role-card">
                <HiOutlineAcademicCap className="register-brand__role-icon" />
                <div><strong>Giảng viên</strong><span>Chia sẻ kiến thức, xây dựng thu nhập</span></div>
              </div>
            </div>
          </div>
          <div className="register-brand__blob register-brand__blob--1" aria-hidden="true" />
          <div className="register-brand__blob register-brand__blob--2" aria-hidden="true" />
        </div>
        <div className="register-form-panel">
          <div className="register-card">
            <div className="register-card__header">
              <h1>Tạo tài khoản</h1>
              <p>Miễn phí — chỉ mất 30 giây</p>
            </div>
            {error && <div className="register-card__error" role="alert">{error}</div>}
            <form className="register-card__form" onSubmit={handleSubmit} noValidate>
              <div className="reg-field">
                <label htmlFor="reg-name">Họ và tên</label>
                <div className="reg-field__wrap">
                  <MdPersonOutline className="reg-field__icon" aria-hidden="true" />
                  <input id="reg-name" type="text" placeholder="Nguyễn Văn A"
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
                <label htmlFor="reg-password">Mật khẩu</label>
                <div className="reg-field__wrap">
                  <MdLockOutline className="reg-field__icon" aria-hidden="true" />
                  <input id="reg-password" type="password" placeholder="Tối thiểu 6 ký tự"
                    autoComplete="new-password" required minLength={6} value={password}
                    onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              <div className="reg-field">
                <label>Vai trò</label>
                <div className="reg-role-group">
                  <button type="button"
                    className={`reg-role-btn ${role === "user" ? "reg-role-btn--active" : ""}`}
                    onClick={() => setRole("user")}>
                    <HiOutlineUserGroup /> Học viên
                  </button>
                  <button type="button"
                    className={`reg-role-btn ${role === "instructor" ? "reg-role-btn--active" : ""}`}
                    onClick={() => setRole("instructor")}>
                    <HiOutlineAcademicCap /> Giảng viên
                  </button>
                </div>
              </div>
              <label className="reg-checkbox">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>Gửi cho tôi các ưu đãi đặc biệt và đề xuất cá nhân hóa.</span>
              </label>
              <button className={`register-card__submit ${loading ? "register-card__submit--loading" : ""}`}
                type="submit" disabled={loading}>
                {loading ? <span className="register-card__spinner" /> : "Tạo tài khoản"}
              </button>
            </form>
            <div className="register-card__divider"><span>hoặc đăng ký với</span></div>
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
              Bằng cách đăng ký, bạn đồng ý với{" "}
              <NavLink to="/terms">Điều khoản sử dụng</NavLink> và{" "}
              <NavLink to="/privacy">Chính sách riêng tư</NavLink>.
            </p>
            <div className="register-card__divider"><span>đã có tài khoản?</span></div>
            <p className="register-card__login">
              <NavLink to="/login">Đăng nhập tại đây →</NavLink>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </section>
  );
}

export default Register;