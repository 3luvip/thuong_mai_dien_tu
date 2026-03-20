import "../src/style/main.scss";
import { useEffect, useState } from "react";
import axiosInstance from "./lib/axios";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
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
import CourseCategoryPage from "./components/Course/CourseCategoryPage"; // ← MỚI
import MyCoursesPage from "./components/Learning/MyCoursesPage";
import LearnPage from "./components/Learning/LearnPage";
import { CartProvider } from "./context/CartProvider";
import { ToastProvider } from "./context/toast";
import { WishlistProvider } from "./context/wishlistContext";

function App() {
  const [IsAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem("token");
      if (!token) { setIsAuthenticated(false); return; }
      try {
        await axiosInstance.get("/auth/verify");
        setIsAuthenticated(true);
      } catch { setIsAuthenticated(false); }
    };
    const syncAuth = () => setIsAuthenticated(!!localStorage.getItem("token"));
    verifyToken();
    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, []);

  return (
    <ToastProvider>
      <WishlistProvider>
        <CartProvider>
          <Router>
            {IsAuthenticated ? (
              <AuthNavbar setIsAuthenticated={setIsAuthenticated} />
            ) : (
              <Navbar />
            )}
            <Routes>
              {/* ── Public ── */}
              <Route path="/"      element={<Home />} />
              <Route path="signup" element={<Register />} />
              <Route path="login"  element={<Login setIsAuthenticated={setIsAuthenticated} />} />
              <Route path="course-detail/:courseCardId" element={<CourseDetailPage />} />

              <Route path="courses" element={<CourseCategoryPage />} />

              {/* ── User ── */}
              <Route path="authenticated-home" element={
                <ProtectedRoute isAuthenticated={IsAuthenticated} allowedRoles={["user","instructor"]}>
                  <AuthenticatedHome />
                </ProtectedRoute>
              } />
              <Route path="cart" element={
                <ProtectedRoute isAuthenticated={IsAuthenticated} allowedRoles={["user","instructor"]}>
                  <CartPage />
                </ProtectedRoute>
              } />
              <Route path="notifications" element={
                <ProtectedRoute isAuthenticated={IsAuthenticated} allowedRoles={["user","instructor"]}>
                  <NotificationsPage />
                </ProtectedRoute>
              } />
              <Route path="wishlist" element={
                <ProtectedRoute isAuthenticated={IsAuthenticated} allowedRoles={["user","instructor"]}>
                  <WishlistPage />
                </ProtectedRoute>
              } />

              {/* ── Learning ── */}
              <Route path="my-courses" element={
                <ProtectedRoute isAuthenticated={IsAuthenticated} allowedRoles={["user","instructor"]}>
                  <MyCoursesPage />
                </ProtectedRoute>
              } />
              <Route path="learn/:courseId" element={
                <ProtectedRoute isAuthenticated={IsAuthenticated} allowedRoles={["user","instructor"]}>
                  <LearnPage />
                </ProtectedRoute>
              } />

              {/* ── Instructor ── */}
              <Route path="instructor-dashboard" element={
                <ProtectedRoute isAuthenticated={IsAuthenticated} allowedRoles={["instructor"]}>
                  <InstructorDashboard />
                </ProtectedRoute>
              } />
              <Route path="create-course" element={
                <ProtectedRoute isAuthenticated={IsAuthenticated} allowedRoles={["instructor"]}>
                  <CreateCoursePage />
                </ProtectedRoute>
              } />
            </Routes>
          </Router>
        </CartProvider>
      </WishlistProvider>
    </ToastProvider>
  );
}

export default App;