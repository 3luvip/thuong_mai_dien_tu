import { NavLink } from "react-router-dom";
import { CiSearch } from "react-icons/ci";
import { IoCartOutline } from "react-icons/io5";
import { BsGlobe } from "react-icons/bs";
import { useEffect, useRef, useState } from "react";
import axiosInstance from "../../lib/axios";
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

function Navbar() {
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const exploreRef = useRef<HTMLDivElement | null>(null);
  const exploreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<
    { title: string; category: string; url: string }[]
  >([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── close on outside click / Escape ── */
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (
        e.target instanceof Node &&
        exploreRef.current &&
        !exploreRef.current.contains(e.target)
      ) {
        setIsExploreOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsExploreOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  /* ── search suggestions with debounce ── */
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

  /* ── explore hover handlers with delay ── */
  const handleExploreEnter = () => {
    if (exploreTimeoutRef.current) clearTimeout(exploreTimeoutRef.current);
    setIsExploreOpen(true);
  };
  const handleExploreLeave = () => {
    exploreTimeoutRef.current = setTimeout(() => setIsExploreOpen(false), 150);
  };

  return (
    <header>
      <nav aria-label="Primary navigation">
        <div className="navbar">
          {/* ── Logo ── */}
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
                textTransform: "uppercase" as const,
                whiteSpace: "nowrap",
              }}>
                Learning
              </span>
            </span>
          </NavLink>

          <div className="nav-list">
            {/* ── Explore Dropdown ── */}
            <div
              className="explore-dropdown"
              ref={exploreRef}
              onMouseEnter={handleExploreEnter}
              onMouseLeave={handleExploreLeave}
            >
              <button
                className="explore-trigger"
                type="button"
                aria-haspopup="menu"
                aria-expanded={isExploreOpen}
                onClick={() => setIsExploreOpen((v) => !v)}
              >
                Explore
              </button>

              <div
                className={`explore-menu ${isExploreOpen ? "is-open" : ""}`}
                role="menu"
                aria-label="Explore categories"
              >
                <div className="explore-menu-inner">
                  {Object.entries(categories).map(([mainCategory, subs]) => (
                    <div className="explore-col" key={mainCategory}>
                      <NavLink
                        to={`/courses?category=${encodeURIComponent(mainCategory)}`}
                        className="explore-title"
                        onClick={() => setIsExploreOpen(false)}
                      >
                        {mainCategory}
                      </NavLink>
                      <div className="explore-items">
                        {subs.map((sub) => (
                          <NavLink
                            key={sub}
                            to={`/courses?category=${encodeURIComponent(sub)}`}
                            className="explore-item"
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

            {/* ── Search ── */}
            <div className="search" style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Search for Anything"
                className="user-input"
                aria-label="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setShowSuggest(true)}
                onBlur={() => setTimeout(() => setShowSuggest(false), 120)}
              />
              <span className="search-icon" aria-hidden="true">
                <CiSearch />
              </span>

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
                          idx === suggestions.length - 1
                            ? "none"
                            : "1px solid #f1f5f9",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{s.title}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        {s.category}
                      </div>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Nav items ── */}
          <div className="nav-list-item">
            <ul>
              <li>
                <NavLink to="/tech-on-udemy">Tech on Edu</NavLink>
              </li>
              <li className="Cart">
                <NavLink to="/cart">
                  <span aria-hidden="true">
                    <IoCartOutline />
                  </span>
                </NavLink>
              </li>
            </ul>
          </div>

          {/* ── Auth buttons ── */}
          <div className="nav-btn">
            <button className="login-btn" type="button">
              <NavLink to="/login">Login</NavLink>
            </button>
            <button className="signup-btn" type="button">
              <NavLink to="/signup">Sign Up</NavLink>
            </button>
            <button className="lang-btn" type="button" aria-label="Language">
              <BsGlobe />
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}

export default Navbar;