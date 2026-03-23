import "../src/style/main.scss";
import { useEffect, useState } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import axiosInstance from "./lib/axios";
import { session } from "./lib/storage";
import AuthNavbar from "./components/Navbar/AuthNavbar";
import Navbar from "./components/Navbar/Navbar";
import Home from "./components/pages/Home";
import Register from "./components/Auth/Register";
import Login from "./components/Auth/Login";
import ProtectedRoute from "./common/ProductedRoute";
import AuthenticatedHome from "./components/pages/AuthenticatedHome";
import CartPage from "./components/Card/CartPage";
import NotificationsPage from "./components/Notification/NotificationsPage";
import WishlistPage from "./components/Wishlist/WishlistPage";
import InstructorDashboard from "./components/pages/InstructorDashBoard";
import CreateCoursePage from "./components/Instructor/CreateCoursePage";
import CourseDetailPage from "./components/Course/CourseDetailPage";
import CourseCategoryPage from "./components/Course/CourseCategoryPage";
import MyCoursesPage from "./components/Learning/MyCoursesPage";
import LearnPage from "./components/Learning/LearnPage";
import EditProfilePage from "./components/pages/EditProfilePage";
import AdminLogin from "./admin/AdminLogin";
import AdminDashboard from "./admin/AdminDashboard";
import OrderHistoryPage from "./order/OrderHistoryPage";
import { CartProvider } from "./context/CartProvider";
import { ToastProvider } from "./context/toast";
import { WishlistProvider } from "./context/wishlistContext";
import SupportChat from "./components/Chat/SupportChat";
import SubscriptionPage from "./components/pages/SubscriptionPage";

// ── Navbar wrapper — hidden on admin routes ──────────────────────────────────
function AppNavbar({
  isAuthenticated,
  setIsAuthenticated,
}: {
  isAuthenticated: boolean;
  setIsAuthenticated: (v: boolean) => void;
}) {
  const { pathname } = useLocation();
  if (pathname.startsWith("/admin")) return null;
  return isAuthenticated ? (
    <AuthNavbar setIsAuthenticated={setIsAuthenticated} />
  ) : (
    <Navbar />
  );
}

// ── SupportChat wrapper — hidden on admin routes ─────────────────────────────
function AppSupportChat() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/admin")) return null;
  return <SupportChat />;
}

// ─────────────────────────────────────────────────────────────────────────────

function App() {
  const [IsAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const verifyToken = async () => {
      const token = session.getToken();
      if (!token) {
        setIsAuthenticated(false);
        return;
      }
      try {
        await axiosInstance.get("/auth/verify");
        setIsAuthenticated(true);
      } catch {
        setIsAuthenticated(false);
      }
    };

    verifyToken();
  }, []);

  return (
    <ToastProvider>
      <WishlistProvider>
        <CartProvider>
          <Router>
            <AppNavbar
              isAuthenticated={IsAuthenticated}
              setIsAuthenticated={setIsAuthenticated}
            />

            <Routes>
              {/* ── Public ── */}
              <Route path="/" element={<Home />} />
              <Route path="/signup" element={<Register />} />
              <Route
                path="/login"
                element={<Login setIsAuthenticated={setIsAuthenticated} />}
              />
              <Route
                path="/course-detail/:courseCardId"
                element={<CourseDetailPage />}
              />
              <Route path="/courses" element={<CourseCategoryPage />} />

              {/* ── User ── */}
              <Route
                path="/authenticated-home"
                element={
                  <ProtectedRoute
                    isAuthenticated={IsAuthenticated}
                    allowedRoles={["user", "instructor"]}
                  >
                    <AuthenticatedHome />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/cart"
                element={
                  <ProtectedRoute
                    isAuthenticated={IsAuthenticated}
                    allowedRoles={["user", "instructor"]}
                  >
                    <CartPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute
                    isAuthenticated={IsAuthenticated}
                    allowedRoles={["user", "instructor"]}
                  >
                    <NotificationsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/wishlist"
                element={
                  <ProtectedRoute
                    isAuthenticated={IsAuthenticated}
                    allowedRoles={["user", "instructor"]}
                  >
                    <WishlistPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/subscription"
                element={
                  <ProtectedRoute
                    isAuthenticated={IsAuthenticated}
                    allowedRoles={["user", "instructor"]}
                  >
                    <SubscriptionPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/edit-profile"
                element={
                  <ProtectedRoute
                    isAuthenticated={IsAuthenticated}
                    allowedRoles={["user", "instructor"]}
                  >
                    <EditProfilePage />
                  </ProtectedRoute>
                }
              />

              {/* ── Order history ── */}
              <Route
                path="/order-history"
                element={
                  <ProtectedRoute
                    isAuthenticated={IsAuthenticated}
                    allowedRoles={["user", "instructor"]}
                  >
                    <OrderHistoryPage />
                  </ProtectedRoute>
                }
              />

              {/* ── Learning ── */}
              <Route
                path="/my-courses"
                element={
                  <ProtectedRoute
                    isAuthenticated={IsAuthenticated}
                    allowedRoles={["user", "instructor"]}
                  >
                    <MyCoursesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/learn/:courseId"
                element={
                  <ProtectedRoute
                    isAuthenticated={IsAuthenticated}
                    allowedRoles={["user", "instructor"]}
                  >
                    <LearnPage />
                  </ProtectedRoute>
                }
              />

              {/* ── Instructor ── */}
              <Route
                path="/instructor-dashboard"
                element={
                  <ProtectedRoute
                    isAuthenticated={IsAuthenticated}
                    allowedRoles={["instructor"]}
                  >
                    <InstructorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/create-course"
                element={
                  <ProtectedRoute
                    isAuthenticated={IsAuthenticated}
                    allowedRoles={["instructor"]}
                  >
                    <CreateCoursePage />
                  </ProtectedRoute>
                }
              />

              {/* ── Admin (standalone, no Navbar/SupportChat) ── */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
            </Routes>
            <AppSupportChat />
          </Router>
        </CartProvider>
      </WishlistProvider>
    </ToastProvider>
  );
}

export default App;
