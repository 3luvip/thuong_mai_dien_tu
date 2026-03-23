import { NavLink, useNavigate } from "react-router-dom";
import { CiSearch } from "react-icons/ci";
import { IoCartOutline, IoHeart, IoHeartOutline } from "react-icons/io5";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import axiosInstance from "../../lib/axios";
import { session } from "../../lib/storage";
import DropDown from "./DropDown";
import NotificationBell from "../Notification/NotificationBell";
import { useWishlist } from "../../context/wishlistContext";
import { useCart } from "../../context/useCart";
import "../../style/components/_navbar.scss";

const categories: Record<string, string[]> = {
  Development: [
    "Web Development",
    "App Development",
    "Game Development",
    "Programming Language",
    "Database Design & Development",
  ],
  Business: ["Entrepreneurship", "Leadership", "Strategy"],
  FinanceAccounting: [
    "Accounting & Bookkeeping",
    "CryptoCurrency & Blockchain",
    "Finance",
    "Investing & Trading",
  ],
  Software: [
    "IT Certification",
    "Network & Security",
    "Hardware",
    "Operating Systems & Server",
    "Other IT & Services",
  ],
  Productivity: ["Microsoft", "Apple", "Linux", "Google", "Samsung"],
  PersonalDevelopment: [
    "Personal Transformation",
    "Personal Productivity",
    "Career Development",
    "Parenting & Relationship",
  ],
  Design: ["UX Design", "Graphic Design", "Interior Design"],
  Marketing: ["Digital Marketing", "SEO", "Content Marketing"],
  Health: ["Fitness", "Mental Health", "Nutrition"],
  Music: ["Instruments", "Music Production", "Vocal"],
};

function getInitials(name: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

function AuthNavbar({ setIsAuthenticated }: { setIsAuthenticated: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { total: wishlistTotal } = useWishlist();
  const { cartItems, fetchCart } = useCart();

  const [role,          setRole]          = useState<string | null>(null);
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const exploreRef        = useRef<HTMLDivElement | null>(null);
  const exploreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [userInitials,   setUserInitials]   = useState("");
  const [userName,       setUserName]       = useState<string | null>(null);
  const [userEmail,      setUserEmail]      = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef        = useRef<HTMLDivElement | null>(null);
  const userMenuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [search,      setSearch]      = useState("");
  const [suggestions, setSuggestions] = useState<{ title: string; category: string; url: string }[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // ✅ sessionStorage
    setRole(session.getRole());
  }, []);

  useEffect(() => {
    const token  = session.getToken();
    const userId = session.getUserId();
    if (!token) return;

    axios
      .get("http://localhost:8080/auth/user-Info", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setUserName(res.data.name ?? null);
        setUserEmail(res.data.email ?? null);
        setUserInitials(getInitials(res.data.name ?? null));
      })
      .catch(console.error);

    if (userId) fetchCart(userId);
  }, []);

  useEffect(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (!search.trim()) {
      setSuggestions([]);
      return;
    }
    suggestTimer.current = setTimeout(() => {
      axiosInstance
        .post("/ai/suggest", { query: search, limit: 8 })
        .then((res) => setSuggestions(res.data.suggestions ?? []))
        .catch(() => setSuggestions([]));
    }, 350);
  }, [search]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!(e.target instanceof Node)) return;
      if (exploreRef.current  && !exploreRef.current.contains(e.target))  setIsExploreOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setIsUserMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsExploreOpen(false);
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const handleExploreEnter  = () => { if (exploreTimeoutRef.current)  clearTimeout(exploreTimeoutRef.current);  setIsExploreOpen(true);  };
  const handleExploreLeave  = () => { exploreTimeoutRef.current  = setTimeout(() => setIsExploreOpen(false),  150); };
  const handleUserMenuEnter = () => { if (userMenuTimeoutRef.current) clearTimeout(userMenuTimeoutRef.current); setIsUserMenuOpen(true); };
  const handleUserMenuLeave = () => { userMenuTimeoutRef.current = setTimeout(() => setIsUserMenuOpen(false), 150); };

  const handleLogout = () => {
    // ✅ Xoá sessionStorage của tab này
    session.clear();
    setIsAuthenticated(false);
    navigate("/login");
  };

  return (
    <header>
      <nav aria-label="Primary navigation">
        <div className="navbar-auth">

          <div className="nav-left">
            <NavLink to="/" end className="logo" aria-label="Home"
              style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
            >
              <img
                src="https://khoacntp.ctuet.edu.vn/wp-content/uploads/2020/03/%C4%90%E1%BA%A1i_h%E1%BB%8Dc_K%E1%BB%B9_thu%E1%BA%ADt_-_C%C3%B4ng_ngh%E1%BB%87_C%E1%BA%A7n_Th%C6%A1.png"
                alt="CTUET"
              />
              <span style={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1.15,
              }}>
                <span style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "#e2e8f0",
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                }}>
                  CTUT
                </span>
                <span style={{
                  fontSize: 9.5,
                  fontWeight: 600,
                  color: "#6366f1",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}>
                  Learning
                </span>
              </span>
            </NavLink>

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
                <div className="explore-menu-inner-auth">
                  {Object.entries(categories).map(([mainCategory, subs]) => (
                    <div className="explore-col-auth" key={mainCategory}>
                      <NavLink
                        to={`/courses?category=${encodeURIComponent(mainCategory)}`}
                        className="explore-title-auth"
                        onClick={() => setIsExploreOpen(false)}
                      >
                        {mainCategory}
                      </NavLink>
                      <div className="explore-items-auth">
                        {subs.map((sub) => (
                          <NavLink
                            key={sub}
                            to={`/courses?category=${encodeURIComponent(sub)}`}
                            className="explore-item-auth"
                            onClick={() => setIsExploreOpen(false)}
                          >
                            {sub}
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="nav-center">
            <div className="nav-search" style={{ position: "relative" }}>
              <span className="nav-search-icon" aria-hidden="true">
                <CiSearch />
              </span>
              <input
                type="text"
                placeholder="Search for Anything"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setShowSuggest(true)}
                onBlur={() => setTimeout(() => setShowSuggest(false), 120)}
              />

              {showSuggest && suggestions.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    right: 0,
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    boxShadow: "0 8px 24px rgba(2, 6, 23, 0.12)",
                    zIndex: 5000,
                    maxHeight: 320,
                    overflow: "auto",
                  }}
                >
                  {suggestions.map((s, idx) => (
                    <NavLink
                      key={`${s.url}-${idx}`}
                      to={s.url}
                      onMouseDown={(e) => e.preventDefault()}
                      style={{
                        display: "block",
                        padding: "10px 12px",
                        color: "#0f172a",
                        textDecoration: "none",
                        borderBottom:
                          idx === suggestions.length - 1 ? "none" : "1px solid #f1f5f9",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{s.title}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{s.category}</div>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="nav-right">
            <div className="nav-list-item">
              <ul>
                {role === "instructor" ? (
                  <li><NavLink to="/instructor-dashboard">Instructor</NavLink></li>
                ) : (
                  <li><NavLink to="/authenticated-home">New Learners</NavLink></li>
                )}

                <li><NavLink to="/my-courses">My learning</NavLink></li>

                <li style={{ position: "relative" }}>
                  <NavLink
                    to="/wishlist"
                    aria-label="Wishlist"
                    style={{
                      display: "flex", alignItems: "center",
                      justifyContent: "center", position: "relative", padding: "6px 8px",
                    }}
                  >
                    <span style={{ fontSize: 22, display: "flex" }}>
                      {wishlistTotal > 0
                        ? <IoHeart style={{ color: "#f43f5e" }} />
                        : <IoHeartOutline />}
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

                <li className="Cart" style={{ position: "relative" }}>
                  <NavLink
                    to="/cart"
                    style={{
                      display: "flex", alignItems: "center",
                      justifyContent: "center", position: "relative", padding: "6px 8px",
                    }}
                  >
                    <span style={{ fontSize: 22, display: "flex" }}>
                      <IoCartOutline />
                    </span>
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

                <li style={{ display: "flex", alignItems: "center" }}>
                  <NotificationBell />
                </li>

                {userInitials && (
                  <li>
                    <div
                      className="user-menu-container"
                      ref={userMenuRef}
                      onMouseEnter={handleUserMenuEnter}
                      onMouseLeave={handleUserMenuLeave}
                    >
                      <button
                        type="button"
                        className="user-avatar-btn"
                        aria-haspopup="menu"
                        aria-expanded={isUserMenuOpen}
                        onClick={() => setIsUserMenuOpen((v) => !v)}
                      >
                        <div className="nav-avatar"><span>{userInitials}</span></div>
                      </button>

                      <div
                        className={`user-menu ${isUserMenuOpen ? "is-open" : ""}`}
                        role="menu"
                        aria-label="User menu"
                      >
                        <div className="user-menu-header">
                          <div className="nav-avatar nav-avatar-lg">
                            <span>{userInitials}</span>
                          </div>
                          <div className="user-menu-header-text">
                            <div className="user-menu-name">{userName ?? "User"}</div>
                            {userEmail && (
                              <div className="user-menu-email">{userEmail}</div>
                            )}
                          </div>
                        </div>

                        {[
                          { label: "My learning",      action: () => navigate("/my-courses")    },
                          { label: "Wishlist",          action: () => navigate("/wishlist")      },
                          { label: "Notifications",     action: () => navigate("/notifications") },
                          { label: "Membership & Plans", action: () => navigate("/subscription") },
                          { label: "Edit profile",      action: () => navigate("/edit-profile")  },
                          
                          { label: "Help and Support",  action: () => {}                         },
                        ].map(({ label, action }) => (
                          <div key={label} className="user-menu-section">
                            <button
                              type="button"
                              className="user-menu-item"
                              onClick={() => { action(); setIsUserMenuOpen(false); }}
                            >
                              {label}
                            </button>
                          </div>
                        ))}

                        <div className="user-menu-section">
                          <button
                            type="button"
                            className="user-menu-item"
                            onClick={() => { handleLogout(); setIsUserMenuOpen(false); }}
                          >
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