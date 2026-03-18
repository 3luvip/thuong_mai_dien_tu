use serde::Deserialize;

#[derive(sqlx::FromRow)]
pub struct SectionRow {
    pub id: String,
    pub title: String,
    pub position: i32,
}

#[derive(sqlx::FromRow)]
pub struct LectureRow {
    pub id: String,
    pub section_id: String,
    pub title: String,
    pub position: i32,
    pub duration_sec: i32,
    pub is_preview: i8,
    pub video_url: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateSectionRequest {
    pub course_id: String,
    pub title: String,
}

#[derive(Deserialize)]
pub struct UpdateSectionRequest {
    pub title: String,
}

#[derive(Deserialize)]
pub struct CreateLectureRequest {
    pub section_id: String,
    pub title: String,
    pub is_preview: Option<bool>,
}

#[derive(Deserialize)]
pub struct UpdateLectureRequest {
    pub title: Option<String>,
    pub is_preview: Option<bool>,
    pub duration_sec: Option<i32>,
}

#[derive(sqlx::FromRow)]
pub struct CourseRow {
    pub id: String,
    pub title: String,
    pub course_sub: String,
    pub description: String,
    pub price: bigdecimal::BigDecimal,
    pub language: String,
    pub level: String,
    pub category: String,
    pub path: String,
    pub created_at: chrono::NaiveDateTime,
}
