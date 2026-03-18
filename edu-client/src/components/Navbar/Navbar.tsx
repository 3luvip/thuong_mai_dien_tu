import { NavLink } from 'react-router-dom';
import { CiSearch } from "react-icons/ci";
import { IoCartOutline } from "react-icons/io5";
import { BsGlobe } from "react-icons/bs";
import { use, useEffect, useRef, useState } from "react";
import "../../style/components/_navbar.scss";



function Navbar() {
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const exploreRef        = useRef<HTMLDivElement | null>(null);
  const exploreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const el = exploreRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
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
          <NavLink to="/" end className="logo" aria-label="Home">
            <img
              src="https://khoacntp.ctuet.edu.vn/wp-content/uploads/2020/03/%C4%90%E1%BA%A1i_h%E1%BB%8Dc_K%E1%BB%B9_thu%E1%BA%ADt_-_C%C3%B4ng_ngh%E1%BB%87_C%E1%BA%A7n_Th%C6%A1.png"
              alt="CTUET"
            />
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
                
              </div>
            </div>

            {/* ── Search ── */}
            <div className="search">
              <input
                type="text"
                placeholder="Search for Anything"
                className="user-input"
                aria-label="Search"
              />
              <span className="search-icon" aria-hidden="true">
                <CiSearch />
              </span>
            </div>
          </div>

          <div className="nav-list-item">
            <ul>
              <li><NavLink to="/tech-on-udemy">Tech on Edu</NavLink></li>
              <li className="Cart">
                <NavLink to="/cart">
                  <span aria-hidden="true">
                    <IoCartOutline />
                  </span>
                </NavLink>
              </li>
            </ul>
          </div>

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