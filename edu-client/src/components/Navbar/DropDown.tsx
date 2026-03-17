import { useRef, useState } from "react";
import "../../style/components/_navbar.scss";
const categories = {
  Development: [
    "Web Development",
    "App Development",
    "Game Development",
    "Programming Language",
    "Database Design & Developement",
  ],
  Business: ["Entrepreneurship", "Leadership", "Strategy"],
  FinanceAccounting: [
    "Accounting & Bookkeeping",
    "CryptoCurrency & Blockchain",
    "Finance",
    "Investing & Trading",
    "Graphic Design",
    "Interior Design",
  ],
  Software: [
    "IT Certification",
    "Network & Security",
    "Hardware",
    "Operating Systems & Server",
    "Other IT & Services",
    "Leadership",
  ],
  Productivity: [
    "MicroSoft",
    "Apple",
    "Linux",
    "Google",
    "Samsung",
    "Safery",
    "Yahoo",
    "Leadership",
    "Strategy",
  ],
  PersonalDevelopment: [
    "Personal Transformation",
    "Personal Productivity",
    "Leadership",
    "career Development",
    "Parenting & Relationship",
  ],
  Design: ["Web Development", "App Development", "Game Development"],
  Marketing: ["Entrepreneurship", "Leadership", "Strategy"],
  Health: ["UX Design", "Graphic Design", "Interior Design"],
  Music: ["UX Design", "Graphic Design", "Interior Design"],
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
            {mainCategory}

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
                      {sub}
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
