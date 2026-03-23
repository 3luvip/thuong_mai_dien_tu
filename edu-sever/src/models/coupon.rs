
use serde::{Deserialize, Serialize};

// ─── Request bodies ───────────────────────────────────────────────────────────

/// Áp mã giảm giá (CartPage gọi — thêm course_ids để check scope)
#[derive(Debug, Deserialize)]
pub struct ApplyCouponRequest {
    pub user_id: String,
    pub code: String,
    pub order_total: f64,
    /// Danh sách course_id trong giỏ — dùng để kiểm tra phạm vi instructor coupon
    pub course_ids: Vec<String>,
}

/// Xác nhận sử dụng coupon khi thanh toán
#[derive(Debug, Deserialize)]
pub struct ConfirmCouponRequest {
    pub user_id: String,
    pub coupon_id: String,
    pub discount_amount: f64,
}

/// Body tạo coupon (admin tạo platform | instructor tạo instructor-scoped)
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCouponRequest {
    pub code: String,
    pub r#type: String,          // "percent" | "fixed"
    pub value: f64,
    pub total_limit: i32,
    pub per_user_limit: i32,
    pub min_order: f64,
    pub max_discount: Option<f64>,
    pub expires_at: Option<String>, // ISO 8601: "2025-12-31T23:59:59"
    /// Với instructor coupon: danh sách course_id muốn gắn (phải là của mình)
    pub course_ids: Option<Vec<String>>,
}

/// Patch một số trường khi cập nhật
#[derive(Debug, Deserialize)]
pub struct UpdateCouponRequest {
    pub is_active: Option<bool>,
    pub expires_at: Option<String>,
    pub total_limit: Option<i32>,
    pub per_user_limit: Option<i32>,
    pub min_order: Option<f64>,
    pub max_discount: Option<f64>,
    /// Gắn thêm / bỏ bớt courses (chỉ instructor coupon)
    pub course_ids: Option<Vec<String>>,
}

// ─── DB rows ──────────────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
pub struct CouponRow {
    pub id: String,
    pub code: String,
    pub scope: String,
    pub created_by_user_id: Option<String>,
    pub r#type: String,
    pub value: bigdecimal::BigDecimal,
    pub total_limit: i32,
    pub per_user_limit: i32,
    pub min_order: bigdecimal::BigDecimal,
    pub max_discount: Option<bigdecimal::BigDecimal>,
    pub is_active: i8,
    pub expires_at: Option<chrono::NaiveDateTime>,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(sqlx::FromRow)]
pub struct CouponListRow {
    pub id: String,
    pub code: String,
    pub scope: String,
    pub r#type: String,
    pub value: bigdecimal::BigDecimal,
    pub total_limit: i32,
    pub per_user_limit: i32,
    pub min_order: bigdecimal::BigDecimal,
    pub max_discount: Option<bigdecimal::BigDecimal>,
    pub is_active: i8,
    pub expires_at: Option<chrono::NaiveDateTime>,
    pub created_at: chrono::NaiveDateTime,
    pub used_count: i64,
    pub created_by_name: Option<String>,
}