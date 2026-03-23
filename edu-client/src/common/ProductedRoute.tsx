import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { session } from "../lib/storage";

interface ProtectedRouteProps {
  children: ReactNode;
  isAuthenticated?: boolean;
  allowedRoles?: string[];
  redirectTo?: string;
}

function homePathForRole(role: string | null): string {
  if (role === "instructor") return "/instructor-dashboard";
  return "/authenticated-home";
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  isAuthenticated,
  allowedRoles,
  redirectTo,
}) => {
  // ✅ Đọc từ sessionStorage — mỗi tab kiểm tra phiên của chính nó
  const token      = session.getToken();
  const storedRole = session.getRole();

  const authed = isAuthenticated ?? !!token;
  if (!authed) {
    return <Navigate to={redirectTo ?? "/login"} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const ok = storedRole ? allowedRoles.includes(storedRole) : false;
    if (!ok) {
      return <Navigate to={homePathForRole(storedRole)} replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;