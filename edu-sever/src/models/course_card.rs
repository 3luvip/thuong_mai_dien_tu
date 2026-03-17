use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Maps to the `course_cards` table
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CourseCard {
    pub id: String,
    pub title: String,
    pub author: String,
    pub price: f64,
    pub current_price: f64,
    pub path: String,
    pub filename: String,
    pub instructor_id: String,
    pub course_detail_id: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

/// Request body for creating a course card (multipart form)
#[derive(Debug, Deserialize)]
pub struct CreateCourseCardRequest {
    pub title: String,
    pub author: String,
    pub price: String,
    pub instructor: String,       // instructor user id
    pub course_details: String,   // course id
}

/// Response DTO returned when listing course cards
#[derive(Debug, Serialize, FromRow)]
pub struct CourseCardResponse {
    pub id: String,
    pub title: String,
    pub author: String,
    pub price: f64,
    pub current_price: f64,
    pub image_url: String,
    pub filename: String,
    pub instructor_id: String,
    pub instructor_name: Option<String>,
    pub instructor_email: Option<String>,
    pub course_detail_id: String,
}