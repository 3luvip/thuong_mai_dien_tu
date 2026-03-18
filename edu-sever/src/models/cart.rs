use serde::Deserialize;




#[derive(Debug, Deserialize)]
pub struct AddToCartRequest {
    pub user_id: String,   // ← snake_case
    pub course_id: String, // ← snake_case
}

#[derive(sqlx::FromRow)]
pub struct CartCourseRow {
    pub id: String,
    pub title: String,
    pub author: String,
    pub price: bigdecimal::BigDecimal,
    pub current_price: Option<bigdecimal::BigDecimal>,
    pub level: String,
    pub category: String,
    pub path: String,
}

#[derive(sqlx::FromRow)]
pub struct CartItemSimple {
    pub id: String,
    pub title: String,
    pub level: String,
    pub category: String,
    pub path: String,
}

#[derive(serde::Deserialize)]
pub struct RemoveFromCartRequest {
    pub user_id: String,
    pub course_id: String,
}