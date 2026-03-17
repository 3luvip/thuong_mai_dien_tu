import { NavLink } from 'react-router-dom';
import { CiSearch } from "react-icons/ci";
import { IoCartOutline } from "react-icons/io5";
import { BsGlobe } from "react-icons/bs";
import { useEffect, useRef, useState } from "react";
import "../../style/components/_navbar.scss"
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
            <div
              className="explore-dropdown"
              ref={exploreRef}
              onMouseEnter={() => setIsExploreOpen(true)}
              onMouseLeave={() => setIsExploreOpen(false)}
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
                        to="/explore"
                        className="explore-title"
                        onClick={() => setIsExploreOpen(false)}
                      >
                        {mainCategory}
                      </NavLink>
                      <div className="explore-items">
                        {subs.map((sub) => (
                          <NavLink
                            key={sub}
                            to={`/explore?topic=${encodeURIComponent(sub)}`}
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
  )
}

export default Navbar;