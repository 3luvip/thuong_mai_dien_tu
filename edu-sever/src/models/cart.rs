use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Maps to the `carts` table
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Cart {
    pub id: String,
    pub user_id: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

/// Request body for adding a course to cart
#[derive(Debug, Deserialize)]
pub struct AddToCartRequest {
    pub user_id: String,   // ← snake_case
    pub course_id: String, // ← snake_case
}


/// A course row returned inside cart response
#[derive(Debug, Serialize, FromRow)]
pub struct CartCourseItem {
    pub id: String,
    pub title: String,
    pub author: String,
    pub price: f64,
    pub level: String,
    pub category: String,
    pub path: String,
}