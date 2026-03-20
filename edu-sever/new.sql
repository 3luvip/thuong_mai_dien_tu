use edu_update;

-- ============================================================
-- E-Learning Platform - Cleaned Database Setup
-- ============================================================

CREATE DATABASE IF NOT EXISTS edu_server;
USE edu_server;

-- ─── USERS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          VARCHAR(36)  NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    role        ENUM('instructor', 'user') NOT NULL,
    status      VARCHAR(255) NOT NULL DEFAULT 'I am new User',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─── COURSE_INSTRUCTIONS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_instructions (
    id           VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    role         TEXT        NOT NULL,
    budget       TEXT        NOT NULL,
    project_risk TEXT        NOT NULL,
    case_study   TEXT        NOT NULL,
    requirement  TEXT        NOT NULL,
    about_course TEXT        NOT NULL,
    created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─── COURSES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
    id                    VARCHAR(36)   NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    title                 VARCHAR(255)  NOT NULL,
    author                VARCHAR(255)  NOT NULL,
    course_sub            VARCHAR(255)  NOT NULL,
    description           TEXT          NOT NULL,
    price                 DECIMAL(10,2) NOT NULL,
    language              VARCHAR(100)  NOT NULL,
    level                 VARCHAR(100)  NOT NULL,
    category              VARCHAR(100)  NOT NULL,
    path                  VARCHAR(500)  NOT NULL,
    filename              VARCHAR(255)  NOT NULL,
    instructor_id         VARCHAR(36)   NOT NULL,
    course_instruction_id VARCHAR(36)   NULL,
    created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (instructor_id)         REFERENCES users(id)               ON DELETE CASCADE,
    FOREIGN KEY (course_instruction_id) REFERENCES course_instructions(id) ON DELETE SET NULL
);

CREATE INDEX idx_courses_instructor ON courses (instructor_id);
CREATE INDEX idx_courses_category   ON courses (category);

-- ─── COURSE_CARDS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_cards (
    id               VARCHAR(36)   NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    title            VARCHAR(255)  NOT NULL,
    author           VARCHAR(255)  NOT NULL,
    price            DECIMAL(10,2) NOT NULL,
    current_price    DECIMAL(10,2) NOT NULL,
    path             VARCHAR(500)  NOT NULL,
    filename         VARCHAR(255)  NOT NULL,
    instructor_id    VARCHAR(36)   NOT NULL,
    course_detail_id VARCHAR(36)   NOT NULL,
    created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (instructor_id)    REFERENCES users(id)   ON DELETE CASCADE,
    FOREIGN KEY (course_detail_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX idx_course_cards_detail ON course_cards (course_detail_id);

-- ─── COUPONS ─────────────────────────────────────────────────
-- (Định nghĩa MỘT LẦN duy nhất)
CREATE TABLE IF NOT EXISTS coupons (
    id             VARCHAR(36)             NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    code           VARCHAR(50)             NOT NULL UNIQUE,
    type           ENUM('percent','fixed') NOT NULL DEFAULT 'percent',
    value          DECIMAL(10,2)           NOT NULL,
    total_limit    INT                     NOT NULL DEFAULT 100,
    per_user_limit INT                     NOT NULL DEFAULT 1,
    min_order      DECIMAL(10,2)           NOT NULL DEFAULT 0,
    max_discount   DECIMAL(10,2)           NULL,
    is_active      TINYINT(1)              NOT NULL DEFAULT 1,
    expires_at     DATETIME                NULL,
    created_at     DATETIME                NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME                NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupon_usages (
    id              VARCHAR(36)   NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    coupon_id       VARCHAR(36)   NOT NULL,
    user_id         VARCHAR(36)   NOT NULL,
    used_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
);

CREATE INDEX idx_coupon_usages_user_coupon ON coupon_usages (user_id, coupon_id);

-- ─── WISHLISTS ────────────────────────────────────────────────
-- (Phải tạo TRƯỚC wishlist_courses)
CREATE TABLE IF NOT EXISTS wishlists (
    id         VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    user_id    VARCHAR(36) NOT NULL UNIQUE,
    created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─── WISHLIST_COURSES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlist_courses (
    wishlist_id VARCHAR(36) NOT NULL,
    course_id   VARCHAR(36) NOT NULL,
    added_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (wishlist_id, course_id),
    FOREIGN KEY (wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id)   REFERENCES courses(id)   ON DELETE CASCADE
);

CREATE INDEX idx_wishlist_courses_course ON wishlist_courses (course_id);

-- ─── CARTS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carts (
    id         VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    user_id    VARCHAR(36) NOT NULL,
    created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_carts_user ON carts (user_id);

-- ─── CART_COURSES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart_courses (
    cart_id   VARCHAR(36) NOT NULL,
    course_id VARCHAR(36) NOT NULL,
    added_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (cart_id, course_id),
    FOREIGN KEY (cart_id)   REFERENCES carts(id)   ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- ─── NOTIFICATIONS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id         VARCHAR(36)  NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    user_id    VARCHAR(36)  NOT NULL,
    type       ENUM('course_added','discount','coupon','system','reminder') NOT NULL DEFAULT 'system',
    title      VARCHAR(255) NOT NULL,
    body       TEXT         NOT NULL,
    link       VARCHAR(500) NULL,
    is_read    TINYINT(1)   NOT NULL DEFAULT 0,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_notif_user_read ON notifications (user_id, is_read);
CREATE INDEX idx_notif_user_time ON notifications (user_id, created_at DESC);

-- ─── SECTIONS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sections (
    id         VARCHAR(36)  NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    course_id  VARCHAR(36)  NOT NULL,
    title      VARCHAR(255) NOT NULL,
    position   INT          NOT NULL DEFAULT 0,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX idx_sections_course ON sections (course_id, position);

-- ─── LECTURES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lectures (
    id           VARCHAR(36)  NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    section_id   VARCHAR(36)  NOT NULL,
    title        VARCHAR(255) NOT NULL,
    position     INT          NOT NULL DEFAULT 0,
    duration_sec INT          NOT NULL DEFAULT 0,
    is_preview   TINYINT(1)   NOT NULL DEFAULT 0,
    video_url    VARCHAR(500) NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);

CREATE INDEX idx_lectures_section ON lectures (section_id, position);

-- ─── COURSE_LEARNINGS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_learnings (
    id        VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    course_id VARCHAR(36) NOT NULL,
    content   TEXT        NOT NULL,
    position  INT         NOT NULL DEFAULT 0,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX idx_course_learnings ON course_learnings (course_id, position);

-- ─── COURSE_TAGS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_tags (
    id        VARCHAR(36)  NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    course_id VARCHAR(36)  NOT NULL,
    tag       VARCHAR(100) NOT NULL,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX idx_course_tags ON course_tags (course_id);

-- ─── REVIEWS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
    id         VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    course_id  VARCHAR(36) NOT NULL,
    user_id    VARCHAR(36) NOT NULL,
    rating     TINYINT     NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment    TEXT        NULL,
    created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_review_user_course (user_id, course_id),
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
);

CREATE INDEX idx_reviews_course ON reviews (course_id);

-- ─── ORDERS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id              VARCHAR(36)   NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    user_id         VARCHAR(36)   NOT NULL,
    status          ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
    total_amount    DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    final_amount    DECIMAL(10,2) NOT NULL DEFAULT 0,
    coupon_id       VARCHAR(36)   NULL,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
    FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL
);

CREATE INDEX idx_orders_user ON orders (user_id, created_at DESC);

-- ─── ORDER_ITEMS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
    id         VARCHAR(36)   NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    order_id   VARCHAR(36)   NOT NULL,
    course_id  VARCHAR(36)   NOT NULL,
    price      DECIMAL(10,2) NOT NULL,
    created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id)  REFERENCES orders(id)  ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX idx_order_items_order  ON order_items (order_id);
CREATE INDEX idx_order_items_course ON order_items (course_id);

-- ─── LECTURE_PROGRESS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lecture_progress (
    id              VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    user_id         VARCHAR(36) NOT NULL,
    lecture_id      VARCHAR(36) NOT NULL,
    course_id       VARCHAR(36) NOT NULL,
    is_completed    TINYINT(1)  NOT NULL DEFAULT 0,
    watched_sec     INT         NOT NULL DEFAULT 0,
    last_watched_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_lecture (user_id, lecture_id),
    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE CASCADE
);

CREATE INDEX idx_progress_user_course ON lecture_progress (user_id, course_id);