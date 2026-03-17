use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Maps to the `courses` table
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Course {
    pub id: String,
    pub title: String,
    pub author: String,
    pub course_sub: String,
    pub description: String,
    pub price: f64,
    pub language: String,
    pub level: String,
    pub category: String,
    pub path: String,
    pub filename: String,
    pub instructor_id: String,
    pub course_instruction_id: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

/// Request body for creating a course (multipart form)
#[derive(Debug, Deserialize)]
pub struct CreateCourseRequest {
    pub title: String,
    pub author: String,
    pub course_sub: String,
    pub description: String,
    pub price: String,
    pub language: String,
    pub level: String,
    pub category: String,
    pub instructor: String,   // instructor user id
}

/// Response DTO for course detail
#[derive(Debug, Serialize)]
pub struct CourseDetailResponse {
    pub id: String,
    pub title: String,
    pub course_sub: String,
    pub description: String,
    pub price: f64,
    pub language: String,
    pub level: String,
    pub category: String,
    pub instructor_id: String,
    pub instructor_name: Option<String>,
    pub instructor_email: Option<String>,
    pub image_url: String,
    pub filename: String,
    pub course_instruction_id: Option<String>,
}