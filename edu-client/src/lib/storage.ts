/**
 * storage.ts — Session-scoped auth storage
 *
 * Dùng sessionStorage thay vì localStorage để mỗi tab trình duyệt
 * có phiên đăng nhập độc lập (tab A login không ảnh hưởng tab B).
 *
 * adminToken / adminUserId / adminRole vẫn giữ nguyên trong localStorage
 * vì Admin dashboard thường cần tồn tại sau F5.
 */

const S = sessionStorage;

// ─── Auth keys ───────────────────────────────────────────────────────────────
export const session = {
  getToken:  ()            => S.getItem("token"),
  setToken:  (v: string)   => S.setItem("token", v),
  removeToken: ()          => S.removeItem("token"),

  getRole:   ()            => S.getItem("role"),
  setRole:   (v: string)   => S.setItem("role", v),
  removeRole: ()           => S.removeItem("role"),

  getUserId: ()            => S.getItem("userId"),
  setUserId: (v: string)   => S.setItem("userId", v),
  removeUserId: ()         => S.removeItem("userId"),

  /** Xoá toàn bộ auth keys trong một lần gọi */
  clear: () => {
    S.removeItem("token");
    S.removeItem("role");
    S.removeItem("userId");
  },

  /** Trả về true nếu đang có token hợp lệ trong tab này */
  isLoggedIn: () => !!S.getItem("token"),
};