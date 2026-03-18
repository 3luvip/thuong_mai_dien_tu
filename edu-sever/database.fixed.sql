-- Add migration script here
-- ============================================================
-- E-Learning Platform - Full Database Setup + Seed Data
-- ============================================================

CREATE DATABASE IF NOT EXISTS edu_server;
USE edu_server;

-- â”€â”€â”€ USERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€ COURSE_INSTRUCTIONS (pháº£i táº¡o trÆ°á»›c courses vÃ¬ courses FK Ä‘áº¿n Ä‘Ã¢y) â”€â”€â”€
CREATE TABLE IF NOT EXISTS course_instructions (
    id           VARCHAR(36)  NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    role         TEXT         NOT NULL,
    budget       TEXT         NOT NULL,
    project_risk TEXT         NOT NULL,
    case_study   TEXT         NOT NULL,
    requirement  TEXT         NOT NULL,
    about_course TEXT         NOT NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- â”€â”€â”€ COURSES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€ COURSE_CARDS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

-- â”€â”€â”€ CARTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS carts (
    id         VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    user_id    VARCHAR(36) NOT NULL,
    created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- â”€â”€â”€ CART_COURSES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS cart_courses (
    cart_id   VARCHAR(36) NOT NULL,
    course_id VARCHAR(36) NOT NULL,
    added_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (cart_id, course_id),
    FOREIGN KEY (cart_id)   REFERENCES carts(id)   ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS notifications (
    id         VARCHAR(36)  NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    user_id    VARCHAR(36)  NOT NULL,
    type       ENUM(
                 'course_added',      -- instructor thÃªm khÃ³a há»c má»›i
                 'discount',          -- khÃ³a há»c giáº£m giÃ¡
                 'coupon',            -- mÃ£ giáº£m giÃ¡ má»›i
                 'system',            -- thÃ´ng bÃ¡o há»‡ thá»‘ng
                 'reminder'           -- nháº¯c nhá»Ÿ há»c táº­p
               ) NOT NULL DEFAULT 'system',
    title      VARCHAR(255) NOT NULL,
    body       TEXT         NOT NULL,
    -- deep-link: click thÃ´ng bÃ¡o â†’ navigate Ä‘áº¿n Ä‘Ã¢u
    link       VARCHAR(500) NULL,
    is_read    TINYINT(1)   NOT NULL DEFAULT 0,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE INDEX idx_notif_user_read ON notifications (user_id, is_read);
CREATE INDEX idx_notif_user_time ON notifications (user_id, created_at DESC);




CREATE TABLE IF NOT EXISTS coupons (
    id              VARCHAR(36)             NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    code            VARCHAR(50)             NOT NULL UNIQUE,
    type            ENUM('percent','fixed') NOT NULL DEFAULT 'percent',
    value           DECIMAL(10,2)           NOT NULL,
    -- Giá»›i háº¡n toÃ n há»‡ thá»‘ng: tá»•ng sá»‘ láº§n mÃ£ Ä‘Æ°á»£c dÃ¹ng trÃªn Táº¤T Cáº¢ user
    total_limit     INT                     NOT NULL DEFAULT 100,
    -- Giá»›i háº¡n má»—i user: má»—i user chá»‰ Ä‘Æ°á»£c dÃ¹ng mÃ£ nÃ y bao nhiÃªu láº§n
    per_user_limit  INT                     NOT NULL DEFAULT 1,
    -- ÄÆ¡n tá»‘i thiá»ƒu Ä‘á»ƒ dÃ¹ng mÃ£
    min_order       DECIMAL(10,2)           NOT NULL DEFAULT 0,
    -- Giáº£m tá»‘i Ä‘a (chá»‰ Ã¡p dá»¥ng type=percent)
    max_discount    DECIMAL(10,2)           NULL,
    is_active       TINYINT(1)              NOT NULL DEFAULT 1,
    expires_at      DATETIME                NULL,
    created_at      DATETIME                NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME                NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupon_usages (
    id          VARCHAR(36)   NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    coupon_id   VARCHAR(36)   NOT NULL,
    user_id     VARCHAR(36)   NOT NULL,
    used_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- discount_amount: sá»‘ tiá»n Ä‘Ã£ giáº£m trong láº§n dÃ¹ng nÃ y (Ä‘á»ƒ audit)
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,

    FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
);


CREATE INDEX idx_coupon_usages_user_coupon ON coupon_usages (user_id, coupon_id);


CREATE TABLE IF NOT EXISTS wishlists (
    id         VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    user_id    VARCHAR(36) NOT NULL UNIQUE,
    created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wishlist_courses (
    wishlist_id VARCHAR(36) NOT NULL,
    course_id   VARCHAR(36) NOT NULL,
    added_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (wishlist_id, course_id),
    FOREIGN KEY (wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id)   REFERENCES courses(id)   ON DELETE CASCADE
);
 
CREATE INDEX idx_wishlist_courses_course ON wishlist_courses (course_id);















CREATE TABLE IF NOT EXISTS sections (
    id           VARCHAR(36)  NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    course_id    VARCHAR(36)  NOT NULL,
    title        VARCHAR(255) NOT NULL,
    position     INT          NOT NULL DEFAULT 0,  -- thá»© tá»± hiá»ƒn thá»‹
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX idx_sections_course ON sections (course_id, position);


CREATE TABLE IF NOT EXISTS lectures (
    id           VARCHAR(36)   NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    section_id   VARCHAR(36)   NOT NULL,
    title        VARCHAR(255)  NOT NULL,
    position     INT           NOT NULL DEFAULT 0,
    duration_sec INT           NOT NULL DEFAULT 0,   -- thá»i lÆ°á»£ng (giÃ¢y)
    is_preview   TINYINT(1)    NOT NULL DEFAULT 0,   -- cho phÃ©p xem trÆ°á»›c miá»…n phÃ­
    video_url    VARCHAR(500)  NULL,
    created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);
 
CREATE INDEX idx_lectures_section ON lectures (section_id, position);

CREATE TABLE IF NOT EXISTS course_learnings (
    id         VARCHAR(36)  NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    course_id  VARCHAR(36)  NOT NULL,
    content    TEXT         NOT NULL,
    position   INT          NOT NULL DEFAULT 0,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS course_tags (
    id        VARCHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    course_id VARCHAR(36) NOT NULL,
    tag       VARCHAR(100) NOT NULL,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);
 
CREATE INDEX idx_course_tags ON course_tags (course_id);

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
 
-- â”€â”€â”€ ORDER_ITEMS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS order_items (
    id         VARCHAR(36)   NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    order_id   VARCHAR(36)   NOT NULL,
    course_id  VARCHAR(36)   NOT NULL,
    price      DECIMAL(10,2) NOT NULL,   -- giÃ¡ táº¡i thá»i Ä‘iá»ƒm mua
    created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id)  REFERENCES orders(id)  ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);
 
CREATE INDEX idx_order_items_order  ON order_items (order_id);
CREATE INDEX idx_order_items_course ON order_items (course_id);


CREATE TABLE IF NOT EXISTS lecture_progress (
    id              VARCHAR(36)  NOT NULL DEFAULT (UUID()) PRIMARY KEY,
    user_id         VARCHAR(36)  NOT NULL,
    lecture_id      VARCHAR(36)  NOT NULL,
    course_id       VARCHAR(36)  NOT NULL,
    is_completed    TINYINT(1)   NOT NULL DEFAULT 0,
    watched_sec     INT          NOT NULL DEFAULT 0,
    last_watched_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_lecture (user_id, lecture_id),
    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE CASCADE
);
 
CREATE INDEX idx_progress_user_course ON lecture_progress (user_id, course_id);
 
