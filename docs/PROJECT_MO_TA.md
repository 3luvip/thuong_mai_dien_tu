Mục tiêu: Xây dựng một nền tảng học trực tuyến kết hợp thương mại điện tử — nơi học viên tìm kiếm, mua khóa học, theo dõi tiến độ học và tương tác (đánh giá, wishlist, giỏ hàng, thanh toán đơn hàng); giảng viên tạo và quản lý khóa học, nhận doanh thu và rút tiền qua tài khoản ngân hàng; quản trị viên quản lý người dùng, hệ thống và duyệt/từ chối yêu cầu rút tiền. Hệ thống dùng API REST (Rust/Axum + MySQL) và giao diện web (React/Vite), có JWT, mã giảm giá, thông báo, cron cập nhật giá hiển thị cho thẻ khóa học, và tích hợp gợi ý nội dung qua AI (endpoint gợi ý).

# Mô tả dự án & cơ sở dữ liệu — thuong_mai_dien_tu
Tài liệu tóm tắt kiến trúc, API, frontend và schema MySQL của repository **Project_TMDT_12** (E-learning + TMĐT).

---

## What are you trying to achieve?

Xây dựng một **nền tảng học trực tuyến kết hợp thương mại điện tử**: học viên tìm kiếm, mua khóa học, theo dõi tiến độ học, đánh giá, giỏ hàng và wishlist; giảng viên tạo khóa học, upload bài giảng, quản lý doanh thu và **rút tiền**; quản trị viên thống kê nền tảng, quản lý người dùng/khóa học, duyệt rút tiền và **phát thông báo broadcast**. Hệ thống gồm **API REST** (Rust/Axum + MySQL + JWT) và **giao diện web** (React/Vite), có **mã giảm giá**, **thông báo**, **cron điều chỉnh giá hiển thị** trên thẻ khóa học, và **gợi ý tìm kiếm** kết hợp dữ liệu DB với **LLM Groq** (tuỳ chọn, qua biến môi trường).

---

## 1. Tổng quan kiến trúc

| Thành phần | Đường dẫn | Vai trò |
|------------|-----------|---------|
| Backend | `edu-sever/` | Rust + Axum + SQLx + MySQL, JWT, upload file, cron |
| Frontend | `edu-client/` | React 19 + TypeScript + Vite, HashRouter, Axios |

- **Client–server**: SPA gọi HTTP tới backend (mặc định cổng **8080**).
- **CORS**: trong code hiện mở rộng (phù hợp dev); production nên thu hẹp origin.

---

## 2. Backend (`edu-sever/`)

### 2.1 Công nghệ

| Thành phần | Thư viện | Ghi chú |
|------------|----------|---------|
| HTTP | Axum | Router, `State`, JSON |
| Database | SQLx (async), `MySqlPool` | Pool tối đa 10 connections |
| Auth | jsonwebtoken, bcrypt | Header `Authorization: Bearer <JWT>` |
| File tĩnh | `tower_http::ServeDir`, `tokio::fs` | Thư mục `UPLOAD_DIR` |
| Lập lịch | tokio-cron-scheduler | Giảm giá định kỳ trên `course_cards` |
| AI (tuỳ chọn) | reqwest | Groq API nếu có `GROQ_API_KEY` |

**AppState**: `db`, `jwt_secret`, `upload_dir`.

### 2.2 Biến môi trường (`edu-sever/.env.example`)

- `DATABASE_URL` — kết nối MySQL
- `HOST`, `PORT` — bind server
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `UPLOAD_DIR`, `MAX_FILE_SIZE_MB`
- `GROQ_API_KEY`, `GROQ_MODEL` (tuỳ chọn, cho `/ai/suggest`)

### 2.3 Bảo mật & phân quyền

- **AuthUser** (middleware): decode JWT; thiếu/sai token → 401.
- **Admin**: handler trong `controllers/admin.rs` yêu cầu `claims.role == "admin"`.
- **Đăng ký**: chỉ role `instructor` hoặc `user`; `admin` thường seed trong SQL.

### 2.4 Prefix API (đăng ký trong `src/main.rs`)

Base: `http://<host>:<port>`

| Prefix | Nội dung chính |
|--------|----------------|
| `/auth` | signup, login, verify, user-Info, update-profile, change-password |
| `/userAuth` | route mẫu JWT (instructor vs user) |
| `/courseCreation` | tạo course / instruction / card; danh sách, chi tiết, categories, footer; giỏ hàng; coupon apply/confirm |
| `/orders` | checkout, my-orders |
| `/reviews` | tạo review (`POST /reviews/`) |
| `/notifications` | theo user; đọc một/tất cả; xóa |
| `/wishlist` | danh sách, ids, add/remove |
| `/ai` | `POST /suggest` — gợi ý khóa học (+ câu trả lời Groq nếu có key) |
| `/instructor` | khóa của GV, curriculum, CRUD section/lecture, upload video (giới hạn body **2 GiB**), xóa video |
| `/learning` | khóa đã mua, dữ liệu học, cập nhật tiến độ |
| `/withdrawal` | số dư, bank, tạo/hủy yêu cầu rút; admin duyệt/từ chối, list |
| `/admin` | stats, users (role/ban/delete), courses, withdrawals, broadcast |
| `/uploads`, `/images` | static từ `UPLOAD_DIR` |

### 2.5 Cron giảm giá (`src/services/cron.rs`)

- Mỗi **2 phút**.
- `course_cards` có `created_at` cách hiện tại **≥ 48 giờ** và `current_price != price`.
- Cập nhật: `current_price = floor(current_price / 2)`.

### 2.6 Cấu trúc mã

- `controllers/` — xử lý HTTP
- `models/` — struct / DTO
- `routes/` — ánh xạ path → handler
- `middleware/` — JWT
- `errors/` — lỗi thống nhất
- `services/` — cron, …

---

## 3. Frontend (`edu-client/`)

### 3.1 Stack

- React 19, TypeScript, Vite 7
- react-router-dom (**HashRouter**)
- Axios (`src/lib/axios.ts`, `baseURL` mặc định `http://localhost:8080`)
- Sass, Swiper, react-icons, react-tabs

Một số component dùng `import.meta.env.VITE_API_URL` — nên cấu hình khi deploy.

### 3.2 Context & auth

- `CartProvider`, `WishlistProvider`, `ToastProvider`
- Token `localStorage`; `GET /auth/verify` khi load app; `ProtectedRoute` theo role

### 3.3 Route chính (`src/App.tsx`)

- Public: `/`, `/signup`, `/login`, `/course-detail/:courseCardId`, `/courses`
- User + instructor: `/authenticated-home`, `/cart`, `/notifications`, `/wishlist`, `/edit-profile`, `/my-courses`, `/learn/:courseId`
- Instructor: `/instructor-dashboard`, `/create-course`
- Admin: `/admin/login`, `/admin/dashboard` (ẩn navbar chính)

---

## 4. Database MySQL (`edu_server`)

### 4.1 File schema

- `edu-sever/new.sql` — định nghĩa bảng, ALTER, trigger, seed admin, bảng rút tiền
- `edu-sever/database.sql` — README hướng dẫn import khi setup (có thể khác biệt nhỏ; ghi rõ phiên bản đang chạy trên môi trường)

### 4.2 Quy ước

- Khóa chính kiểu **UUID** (`VARCHAR(36)`) phổ biến
- **FOREIGN KEY** + `ON DELETE CASCADE` (một số chỗ `SET NULL`, ví dụ `orders.coupon_id`)
- Index: instructor, category, user + thời gian, v.v.

### 4.3 Bảng theo nhóm

#### Người dùng

| Bảng | Mô tả |
|------|--------|
| `users` | `email` UNIQUE; password hash; `role`: instructor / user / admin; `status`; `is_banned`, `ban_reason`; timestamps |

#### Khóa học & hiển thị

| Bảng | Mô tả |
|------|--------|
| `course_instructions` | Khối mô tả dự án: role, budget, project_risk, case_study, requirement, about_course |
| `courses` | Khóa học đầy đủ: title, author, course_sub, description, price, language, level, category, path/filename, instructor_id, course_instruction_id |
| `course_cards` | Thẻ list: price, **current_price**, ảnh, instructor_id, course_detail_id → courses |

#### Curriculum

| Bảng | Mô tả |
|------|--------|
| `sections` | Thuộc course_id, position |
| `lectures` | section_id, title, position, duration_sec, is_preview, video_url |
| `course_learnings` | Nội dung “sẽ học được”, position |
| `course_tags` | Tag theo course |

#### TMĐT

| Bảng | Mô tả |
|------|--------|
| `carts`, `cart_courses` | Giỏ hàng theo user |
| `wishlists`, `wishlist_courses` | Wishlist 1–1 user, N–N course |
| `coupons`, `coupon_usages` | Mã giảm giá %/cố định, giới hạn, lịch sử dùng |
| `orders`, `order_items` | Đơn: pending/paid/failed/refunded; dòng: course + giá snapshot |

#### Học tập & đánh giá

| Bảng | Mô tả |
|------|--------|
| `lecture_progress` | UNIQUE (user_id, lecture_id): watched_sec, is_completed |
| `reviews` | UNIQUE (user_id, course_id): rating 1–5, comment |

#### Hệ thống

| Bảng | Mô tả |
|------|--------|
| `notifications` | type: course_added, discount, coupon, system, reminder, broadcast, …; title, body, link, is_read |

#### Giảng viên — rút tiền

| Bảng | Mô tả |
|------|--------|
| `bank_accounts` | instructor_id UNIQUE; thông tin NH |
| `withdrawal_requests` | amount, platform_fee, net_amount; status pending/approved/rejected/cancelled; note; bank_snapshot (JSON) |

### 4.4 Trigger & seed (trong `new.sql`)

- **Trigger `trg_welcome_user`**: sau INSERT `users` → tạo `wishlists`, `carts`, thông báo chào mừng.
- **User admin mẫu**: chỉ dùng môi trường dev; đổi mật khẩu trên production.

---

## 5. Luồng nghiệp vụ tóm tắt

1. Đăng ký → user mới → trigger tạo wishlist, cart, notification chào mừng.
2. Duyệt `course_cards` (giá hiển thị có thể đổi theo cron) → chi tiết → wishlist/cart → coupon → checkout.
3. Học: API learning + cập nhật `lecture_progress`.
4. Giảng viên: tạo course, curriculum, upload video; bank + withdrawal.
5. Admin: thống kê, quản user/course, duyệt rút tiền, broadcast.
6. AI: `POST /ai/suggest` — luôn có suggestions từ DB; có Groq thì thêm câu trả lời tiếng Việt dựa trên danh sách candidate.

---

## 6. Chạy nhanh (tham khảo `README.md` gốc)

**Backend**

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS edu_server CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p edu_server < edu-sever/database.sql
cp edu-sever/.env.example edu-sever/.env
cd edu-sever && cargo run
```

**Frontend**

```bash
cd edu-client && npm install && npm run dev
```

---

*Tài liệu được sinh để mô tả codebase; cập nhật khi schema hoặc route thay đổi.*
