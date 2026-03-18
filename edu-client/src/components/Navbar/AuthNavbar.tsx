import { NavLink, useNavigate } from "react-router-dom";
import { CiSearch } from "react-icons/ci";
import { IoCartOutline, IoHeart, IoHeartOutline } from "react-icons/io5";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import DropDown from "./DropDown";
import NotificationBell from "../Notification/NotificationBell";
import { useWishlist } from "../../context/wishlistContext";
import { useCart } from "../../context/useCart";
import "../../style/components/_navbar.scss";

function getInitials(name: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

function AuthNavbar({ setIsAuthenticated }: { setIsAuthenticated: (v: boolean) => void }) {
  const navigate  = useNavigate();
  const { total: wishlistTotal } = useWishlist();
  const { cartItems, fetchCart } = useCart();

  const [role,          setrole]          = useState<string | null>(null);
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const exploreRef        = useRef<HTMLDivElement | null>(null);
  const exploreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [userInitials,   setUserInitials]   = useState("");
  const [userName,       setUserName]       = useState<string | null>(null);
  const [userEmail,      setUserEmail]      = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef        = useRef<HTMLDivElement | null>(null);
  const userMenuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setrole(localStorage.getItem("role")); }, []);

  useEffect(() => {
    const token  = localStorage.getItem("token");
    const userId = localStorage.getItem("userId");
    if (!token) return;

    axios.get("http://localhost:8080/auth/user-Info", {
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => {
      setUserName(res.data.name ?? null);
      setUserEmail(res.data.email ?? null);
      setUserInitials(getInitials(res.data.name ?? null));
    }).catch(console.error);

    if (userId) fetchCart(userId);
  }, []);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (e.target instanceof Node) {
        if (exploreRef.current && !exploreRef.current.contains(e.target)) setIsExploreOpen(false);
        if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setIsUserMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setIsExploreOpen(false); setIsUserMenuOpen(false); }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const handleExploreEnter  = () => { if (exploreTimeoutRef.current) clearTimeout(exploreTimeoutRef.current); setIsExploreOpen(true); };
  const handleExploreLeave  = () => { exploreTimeoutRef.current = setTimeout(() => setIsExploreOpen(false), 150); };
  const handleUserMenuEnter = () => { if (userMenuTimeoutRef.current) clearTimeout(userMenuTimeoutRef.current); setIsUserMenuOpen(true); };
  const handleUserMenuLeave = () => { userMenuTimeoutRef.current = setTimeout(() => setIsUserMenuOpen(false), 150); };
  const handleLogout        = () => { localStorage.removeItem("token"); setIsAuthenticated(false); navigate("/login"); };

  return (
    <header>
      <nav aria-label="Primary navigation">
        <div className="navbar-auth">

          {/* ── LEFT ── */}
          <div className="nav-left">
            <NavLink to="/" end className="logo" aria-label="Home">
              <img src="https://khoacntp.ctuet.edu.vn/wp-content/uploads/2020/03/%C4%90%E1%BA%A1i_h%E1%BB%8Dc_K%E1%BB%B9_thu%E1%BA%ADt_-_C%C3%B4ng_ngh%E1%BB%87_C%E1%BA%A7n_Th%C6%A1.png" alt="CTUET" />
            </NavLink>

            {/* Explore dropdown */}
            <div
              className="explore-dropdown-auth"
              ref={exploreRef}
              onMouseEnter={handleExploreEnter}
              onMouseLeave={handleExploreLeave}
            >
              <button
                className="explore-trigger-auth"
                type="button"
                aria-haspopup="menu"
                aria-expanded={isExploreOpen}
                onClick={() => setIsExploreOpen((v) => !v)}
              >
                Explore
              </button>

              <div
                className={`explore-menu-auth ${isExploreOpen ? "is-open" : ""}`}
                role="menu"
                aria-label="Explore categories"
              >
                
                
              </div>
            </div>
          </div>

          {/* ── CENTER ── */}
          <div className="nav-center">
            <div className="nav-search">
              <span className="nav-search-icon" aria-hidden="true"><CiSearch /></span>
              <input type="text" placeholder="Search for Anything" />
            </div>
          </div>

          {/* ── RIGHT ── */}
          <div className="nav-right">
            <div className="nav-list-item">
              <ul>
                {role === "instructor" ? (
                  <li><NavLink to="/instructor-dashboard">Instructor</NavLink></li>
                ) : (
                  <li><NavLink to="/authenticated-home">New Learners</NavLink></li>
                )}

                <li><NavLink to="/my-courses">My learning</NavLink></li>

                {/* Wishlist */}
                <li style={{ position: "relative" }}>
                  <NavLink to="/wishlist" aria-label="Danh sách yêu thích"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative", padding: "6px 8px" }}>
                    <span style={{ fontSize: 22, display: "flex" }}>
                      {wishlistTotal > 0 ? <IoHeart style={{ color: "#f43f5e" }} /> : <IoHeartOutline />}
                    </span>
                    {wishlistTotal > 0 && (
                      <span style={{
                        position: "absolute", top: 0, right: 0,
                        background: "#f43f5e", color: "#fff",
                        fontSize: 10, fontWeight: 700,
                        minWidth: 17, height: 17, borderRadius: 999,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "0 3px", border: "2px solid #020617",
                      }}>
                        {wishlistTotal > 99 ? "99+" : wishlistTotal}
                      </span>
                    )}
                  </NavLink>
                </li>

                {/* Cart */}
                <li className="Cart" style={{ position: "relative" }}>
                  <NavLink to="/cart" style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative", padding: "6px 8px" }}>
                    <span style={{ fontSize: 22, display: "flex" }}><IoCartOutline /></span>
                    {cartItems.length > 0 && (
                      <span style={{
                        position: "absolute", top: 0, right: 0,
                        background: "#6366f1", color: "#fff",
                        fontSize: 10, fontWeight: 700,
                        minWidth: 17, height: 17, borderRadius: 999,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "0 3px", border: "2px solid #020617",
                      }}>
                        {cartItems.length > 99 ? "99+" : cartItems.length}
                      </span>
                    )}
                  </NavLink>
                </li>

                {/* Notification bell */}
                <li style={{ display: "flex", alignItems: "center" }}>
                  <NotificationBell />
                </li>

                {/* Avatar / user menu */}
                {userInitials && (
                  <li>
                    <div className="user-menu-container" ref={userMenuRef}
                      onMouseEnter={handleUserMenuEnter} onMouseLeave={handleUserMenuLeave}>
                      <button type="button" className="user-avatar-btn"
                        aria-haspopup="menu" aria-expanded={isUserMenuOpen}
                        onClick={() => setIsUserMenuOpen((v) => !v)}>
                        <div className="nav-avatar"><span>{userInitials}</span></div>
                      </button>
                      <div className={`user-menu ${isUserMenuOpen ? "is-open" : ""}`}
                        role="menu" aria-label="User menu">
                        <div className="user-menu-header">
                          <div className="nav-avatar nav-avatar-lg"><span>{userInitials}</span></div>
                          <div className="user-menu-header-text">
                            <div className="user-menu-name">{userName ?? "User"}</div>
                            {userEmail && <div className="user-menu-email">{userEmail}</div>}
                          </div>
                        </div>
                        {[
                          { label: "My learning",       action: () => navigate("/my-courses") },
                          { label: "Yêu thích ❤️",      action: () => navigate("/wishlist") },
                          { label: "Thông báo 🔔",       action: () => navigate("/notifications") },
                          { label: "Account settings",  action: () => {} },
                          { label: "Edit profile",      action: () => navigate("/edit-profile") },
                          { label: "Help and Support",  action: () => {} },
                        ].map(({ label, action }) => (
                          <div key={label} className="user-menu-section">
                            <button type="button" className="user-menu-item"
                              onClick={() => { action(); setIsUserMenuOpen(false); }}>
                              {label}
                            </button>
                          </div>
                        ))}
                        <div className="user-menu-section">
                          <button type="button" className="user-menu-item"
                            onClick={() => { handleLogout(); setIsUserMenuOpen(false); }}>
                            Log out
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                )}
              </ul>
            </div>
          </div>

        </div>
      </nav>
      <DropDown />
    </header>
  );
}

export default AuthNavbar;