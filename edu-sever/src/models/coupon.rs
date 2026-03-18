use serde::Deserialize;

/// Body cho POST /apply-coupon (chỉ validate, chưa ghi DB)
#[derive(Debug, Deserialize)]
pub struct ApplyCouponRequest {
    pub user_id: String,
    pub code: String,
    pub order_total: f64,
}

/// Body cho POST /confirm-coupon (ghi usage vào DB khi thanh toán)
#[derive(Debug, Deserialize)]
pub struct ConfirmCouponRequest {
    pub user_id: String,
    pub coupon_id: String,
    pub discount_amount: f64,
}

#[derive(sqlx::FromRow)]
pub struct CouponRow {
    pub id: String,
    pub r#type: String,
    pub value: bigdecimal::BigDecimal,
    pub total_limit: i32,
    pub per_user_limit: i32,
    pub min_order: bigdecimal::BigDecimal,
    pub max_discount: Option<bigdecimal::BigDecimal>,
    pub is_active: i8,
    pub expires_at: Option<chrono::NaiveDateTime>,
}
