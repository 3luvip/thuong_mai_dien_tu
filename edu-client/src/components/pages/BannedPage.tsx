// src/components/pages/BannedPage.tsx
import { Link } from "react-router-dom";
import { MdOutlineBlock } from "react-icons/md";

export default function BannedPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#020617",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Inter, system-ui, sans-serif",
      padding: "24px",
    }}>
      <div style={{
        textAlign: "center",
        maxWidth: 480,
      }}>
        {/* Icon */}
        <div style={{
          width: 80, height: 80,
          borderRadius: "50%",
          background: "rgba(239,68,68,0.12)",
          border: "2px solid rgba(239,68,68,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px",
          fontSize: 36, color: "#ef4444",
        }}>
          <MdOutlineBlock />
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: "1.75rem", fontWeight: 800,
          color: "#f1f5f9", margin: "0 0 12px",
          letterSpacing: "-0.4px",
        }}>
          Account Banned
        </h1>

        {/* Message */}
        <p style={{
          fontSize: "0.95rem", color: "#94a3b8",
          lineHeight: 1.7, margin: "0 0 32px",
        }}>
          Your account has been suspended due to a violation of our Terms of Service.
          If you believe this is a mistake, please contact our support team.
        </p>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a
            href="mailto:support@ctuet.edu.vn"
            style={{
              padding: "10px 24px",
              background: "#6366f1", color: "#fff",
              borderRadius: 9, fontSize: "0.9rem",
              fontWeight: 600, textDecoration: "none",
              transition: "background 0.15s",
            }}
          >
            Contact Support
          </a>
          <Link
            to="/login"
            style={{
              padding: "10px 24px",
              background: "transparent", color: "#94a3b8",
              border: "1px solid rgba(148,163,184,0.2)",
              borderRadius: 9, fontSize: "0.9rem",
              fontWeight: 500, textDecoration: "none",
            }}
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}