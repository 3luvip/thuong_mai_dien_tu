import { useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import "../../style/components/_navbar.scss";
const categories = {
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

function DropDown() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = (category: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpenMenu(category);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpenMenu(null), 150);
  };

  return (
    <div className="category-wrapper">
      <ul className="main-menu">
        {Object.entries(categories).map(([mainCategory, subCategories]) => (
          <li
            key={mainCategory}
            className="menu-item"
            onMouseEnter={() => handleMouseEnter(mainCategory)}
            onMouseLeave={handleMouseLeave}
          >
            <NavLink
              to={`/courses?category=${encodeURIComponent(mainCategory)}`}
              className="menu-item-link"
              onClick={() => setOpenMenu(null)}
            >
              {mainCategory}
            </NavLink>

            {openMenu === mainCategory && (
              <div
                className="mega-menu"
                style={{ display: "block" }}
                onMouseEnter={() => handleMouseEnter(mainCategory)}
                onMouseLeave={handleMouseLeave}
              >
                <div className="mega-menu-content">
                  {subCategories.map((sub, index) => (
                    <div className="mega-item" key={index}>
                      <NavLink
                        to={`/courses?category=${encodeURIComponent(sub)}`}
                        className="mega-item-link"
                        onClick={() => setOpenMenu(null)}
                      >
                        {sub}
                      </NavLink>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default DropDown;
