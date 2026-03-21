
CREATE DATABASE IF NOT EXISTS elearning_platform;
USE elearning_platform;

-- USERS
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM('instructor','user') NOT NULL,
    status VARCHAR(255) DEFAULT 'new user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- COURSE INSTRUCTIONS
CREATE TABLE course_instructions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    role TEXT NOT NULL,
    budget TEXT NOT NULL,
    project_risk TEXT NOT NULL,
    case_study TEXT NOT NULL,
    requirement TEXT NOT NULL,
    about_course TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- COURSES
CREATE TABLE courses (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    language VARCHAR(100),
    level VARCHAR(100),
    category VARCHAR(100),
    instructor_id VARCHAR(36) NOT NULL,
    course_instruction_id VARCHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_instruction_id) REFERENCES course_instructions(id) ON DELETE SET NULL
);

-- COURSE CARDS
CREATE TABLE course_cards (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    title VARCHAR(255),
    price DECIMAL(10,2),
    current_price DECIMAL(10,2),
    instructor_id VARCHAR(36),
    course_detail_id VARCHAR(36),
    FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_detail_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- CART
CREATE TABLE carts (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- CART COURSES
CREATE TABLE cart_courses (
    cart_id VARCHAR(36),
    course_id VARCHAR(36),
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(cart_id,course_id),
    FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- WISHLIST
CREATE TABLE wishlists (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- WISHLIST COURSES
CREATE TABLE wishlist_courses (
    wishlist_id VARCHAR(36),
    course_id VARCHAR(36),
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(wishlist_id,course_id),
    FOREIGN KEY (wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- COUPONS
CREATE TABLE coupons (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    code VARCHAR(50) UNIQUE,
    type ENUM('percent','fixed') DEFAULT 'percent',
    value DECIMAL(10,2) NOT NULL,
    total_limit INT DEFAULT 100,
    per_user_limit INT DEFAULT 1,
    min_order DECIMAL(10,2) DEFAULT 0,
    max_discount DECIMAL(10,2),
    is_active TINYINT(1) DEFAULT 1,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- COUPON USAGE
CREATE TABLE coupon_usages (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    coupon_id VARCHAR(36),
    user_id VARCHAR(36),
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    discount_amount DECIMAL(10,2),
    FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- NOTIFICATIONS
CREATE TABLE notifications (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36),
    type ENUM('course_added','discount','coupon','system','reminder') DEFAULT 'system',
    title VARCHAR(255),
    body TEXT,
    link VARCHAR(500),
    is_read TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
