use serde::Deserialize;

#[derive(Deserialize)]
pub struct CheckoutRequest {
    pub user_id: String,
    pub course_ids: Vec<String>, // course_cards.id hoặc courses.id
    pub coupon_id: Option<String>,
    pub total_amount: f64,
    pub discount_amount: f64,
    pub final_amount: f64,
}

#[derive(sqlx::FromRow)]
pub struct OrderRow {
    pub id: String,
    pub status: String,
    pub final_amount: bigdecimal::BigDecimal,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(sqlx::FromRow)]
pub struct ItemRow {
    pub order_id: String,
    pub course_id: String,
    pub title: String,
    pub filename: String,
    pub price: bigdecimal::BigDecimal,
}
