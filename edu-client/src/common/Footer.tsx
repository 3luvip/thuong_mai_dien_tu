import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BsGlobe } from 'react-icons/bs';
import { FaTwitter, FaLinkedin, FaYoutube, FaFacebook } from 'react-icons/fa';
import axiosInstance from '../lib/axios';
import "../style/components/_footer.scss"

interface FooterLink {
  id: string;
  label: string;
  url: string;
  isSeeAll?: boolean;
}

interface FooterSection {
  category: string;
  links: FooterLink[];
}

interface FooterResponse {
  message: string;
  row1: FooterSection[];
  row2: FooterSection[];
}

interface StaticCol {
  heading: string;
  links: { label: string; to: string }[];
}

interface SocialLink {
  icon: React.ReactNode;
  href: string;
  label: string;
}

// ─── Static data ──────────────────────────────────────────────────────────────

const CAREERS_LINKS: FooterLink[] = [
  { id: 'c1', label: 'Data Scientist',           url: '/courses?category=Data Science' },
  { id: 'c2', label: 'Full Stack Web Developer', url: '/courses?category=Web Development' },
  { id: 'c3', label: 'Cloud Engineer',           url: '/courses?category=IT Certifications' },
  { id: 'c4', label: 'Project Manager',          url: '/courses?category=Leadership' },
  { id: 'c5', label: 'Game Developer',           url: '/courses?category=Game' },
  { id: 'c6', label: 'All Career Accelerators',  url: '/careers', isSeeAll: true },
];

const STATIC_COLS: StaticCol[] = [
  {
    heading: 'About',
    links: [
      { label: 'About us',          to: '/about' },
      { label: 'Careers',           to: '/careers' },
      { label: 'Contact us',        to: '/contact' },
      { label: 'Blog',              to: '/blog' },
      { label: 'Investors',         to: '/investors' },
    ],
  },
  {
    heading: 'Discover CTUET',
    links: [
      { label: 'Get the app',       to: '/app' },
      { label: 'Teach on CTUET',    to: '/teach' },
      { label: 'Plans and Pricing', to: '/pricing' },
      { label: 'Affiliate',         to: '/affiliate' },
      { label: 'Help and Support',  to: '/support' },
    ],
  },
  {
    heading: 'CTUET for Business',
    links: [
      { label: 'CTUET Business',    to: '/business' },
      { label: 'Enterprise',        to: '/enterprise' },
      { label: 'Government',        to: '/government' },
      { label: 'Campus',            to: '/campus' },
    ],
  },
  {
    heading: 'Legal & Accessibility',
    links: [
      { label: 'Accessibility',     to: '/accessibility' },
      { label: 'Privacy policy',    to: '/privacy' },
      { label: 'Sitemap',           to: '/sitemap' },
      { label: 'Terms',             to: '/terms' },
    ],
  },
];

const SOCIAL_LINKS: SocialLink[] = [
  { icon: <FaTwitter />,  href: 'https://twitter.com',  label: 'Twitter' },
  { icon: <FaLinkedin />, href: 'https://linkedin.com', label: 'LinkedIn' },
  { icon: <FaYoutube />,  href: 'https://youtube.com',  label: 'YouTube' },
  { icon: <FaFacebook />, href: 'https://facebook.com', label: 'Facebook' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkeletonCol() {
  return (
    <div className="footer__col footer__col--skeleton">
      <div className="footer__skeleton footer__skeleton--heading" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="footer__skeleton footer__skeleton--link" />
      ))}
    </div>
  );
}

interface FooterColProps {
  category: string;
  links: FooterLink[];
}

function FooterCol({ category, links }: FooterColProps) {
  return (
    <div className="footer__col">
      <h4 className="footer__col-heading">{category}</h4>
      <ul className="footer__col-list">
        {links.map((link) => (
          <li key={link.id}>
            <Link
              to={link.url}
              className={`footer__link${link.isSeeAll ? ' footer__link--see-all' : ''}`}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Main Footer ──────────────────────────────────────────────────────────────

function Footer() {
  const [row1, setRow1]       = useState<FooterSection[]>([]);
  const [row2, setRow2]       = useState<FooterSection[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError]     = useState<boolean>(false);  // ← boolean, không phải null

  useEffect(() => {
    axiosInstance
      .get<FooterResponse>('/courseCreation/footer')
      .then((res) => {
        const r1: FooterSection[] = res.data.row1 ?? [];
        const r2: FooterSection[] = res.data.row2 ?? [];

        // Override cột đầu hàng 1 bằng CAREERS_LINKS tĩnh
        if (r1.length > 0) {
          r1[0] = { ...r1[0], links: CAREERS_LINKS };
        }

        setRow1(r1);
        setRow2(r2);
      })
      .catch((err: unknown) => {
        console.error('Footer fetch error:', err);
        setError(true);   // ← boolean thay vì true vào null state
      })
      .finally(() => setLoading(false));
  }, []);

  const skeletons = [...Array(4)].map((_, i) => <SkeletonCol key={i} />);

  return (
    <footer className="footer">

      {/* ── Skills: 2 hàng x 4 cột ── */}
      <div className="footer__skills">
        <h3 className="footer__skills-title">
          Explore top skills and certifications
        </h3>

        {/* Hàng 1 */}
        <div className="footer__grid">
          {loading && skeletons}
          {!loading && !error && row1.map(({ category, links }) => (
            <FooterCol key={category} category={category} links={links} />
          ))}
        </div>

        {/* Hàng 2 */}
        <div className="footer__grid footer__grid--row2">
          {loading && skeletons}
          {!loading && !error && row2.map(({ category, links }) => (
            <FooterCol key={category} category={category} links={links} />
          ))}
        </div>

        {!loading && error && (
          <p className="footer__error">Could not load course data.</p>
        )}
      </div>

      <hr className="footer__divider" />

      {/* ── About / Discover / Business / Legal ── */}
      <div className="footer__bottom">
        <div className="footer__grid">
          {STATIC_COLS.map((col) => (
            <div key={col.heading} className="footer__col">
              <h4 className="footer__col-heading">{col.heading}</h4>
              <ul className="footer__col-list">
                {col.links.map(({ label, to }) => (
                  <li key={label}>
                    <Link to={to} className="footer__link">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <hr className="footer__divider" />

        {/* ── Copyright bar ── */}
        <div className="footer__bar">
          <Link to="/" className="footer__logo">CTUET</Link>
          <p className="footer__copy">© 2025 CTUET, Inc.</p>

          <div className="footer__socials">
            {SOCIAL_LINKS.map(({ icon, href, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="footer__social-icon"
                aria-label={label}
              >
                {icon}
              </a>
            ))}
          </div>

          <Link to="/cookies" className="footer__cookie">Cookie Settings</Link>
          <span className="footer__lang"><BsGlobe /> English</span>
        </div>
      </div>

    </footer>
  );
}

export default Footer;