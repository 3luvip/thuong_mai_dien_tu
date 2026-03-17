use serde::Deserialize;

/// Body cho POST /apply-coupon (chỉ validate, chưa ghi DB)
#[derive(Debug, Deserialize)]
pub struct ApplyCouponRequest {
    pub user_id:     String,
    pub code:        String,
    pub order_total: f64,
}

/// Body cho POST /confirm-coupon (ghi usage vào DB khi thanh toán)
#[derive(Debug, Deserialize)]
pub struct ConfirmCouponRequest {
    pub user_id:         String,
    pub coupon_id:       String,
    pub discount_amount: f64,
}


