# thuong_mai_dien_tu

Dự án gồm 2 phần:

- **`edu-sever/`**: Backend Rust (Axum + SQLx MySQL)
- **`edu-client/`**: Frontend React (Vite)

## Yêu cầu

### Linux

- **Node.js** (khuyến nghị LTS) + **npm**
- **Rust** (rustup) + cargo
- **MySQL** (server)
- Gói build cho Rust/SQLx:
  - Arch: `base-devel openssl pkgconf`
  - Ubuntu/Debian: `build-essential pkg-config libssl-dev`

### Windows

- **Node.js** (khuyến nghị LTS) + **npm**
- **Rust** (rustup)
- **MySQL** (server)
- Build tools cho Rust:
  - Cài **Visual Studio Build Tools** (C++ build tools)

## Cài đặt & chạy Backend (`edu-sever`) 

### 1) Chuẩn bị database MySQL

Tạo database và import schema/seed (file `edu-sever/database.sql`):

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS edu_server CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p edu_server < edu-sever/database.sql
```

### 2) Cấu hình biến môi trường

Tạo file `.env` từ mẫu:

```bash
cp edu-sever/.env.example edu-sever/.env
```

Mở `edu-sever/.env` và chỉnh `DATABASE_URL`, `JWT_SECRET`… theo máy bạn.

### 3) Chạy server

```bash
cd edu-sever
cargo run
```

Mặc định server chạy tại `http://127.0.0.1:8080` (theo `HOST`/`PORT` trong `.env`).

## Cài đặt & chạy Frontend (`edu-client`)

```bash
cd edu-client
npm install
npm run dev
```

Mở URL do Vite in ra trên terminal (thường là `http://localhost:5173`).

## Build production (tuỳ chọn)

### Frontend

```bash
cd edu-client
npm run build
npm run preview
```

### Backend

```bash
cd edu-sever
cargo build --release
```

## Ghi chú

- File bí mật như `edu-sever/.env` đã được ignore; chỉ commit `edu-sever/.env.example`.
- Thư mục nặng như `edu-client/node_modules/`, `edu-sever/target/`, `edu-sever/uploads/` đã được ignore.
