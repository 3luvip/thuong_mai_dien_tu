use serde::Deserialize;

#[derive(sqlx::FromRow)]
pub struct PurchasedRow {
    pub course_id: String,
    pub purchased_at: chrono::NaiveDateTime,
}

#[derive(sqlx::FromRow)]
pub struct CourseRow {
    pub id: String,
    pub title: String,
    pub course_sub: String,
    pub path: String,
    pub level: String,
    pub category: String,
    pub instructor_name: Option<String>,
}

#[derive(sqlx::FromRow)]
pub struct LastLectureRow {
    pub id: String,
    pub title: String,
}

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
#[derive(sqlx::FromRow)]
pub struct ProgressRow {
    pub lecture_id: String,
    pub is_completed: i8,
    pub watched_sec: i32,
}

#[derive(Deserialize)]
pub struct UpdateProgressRequest {
    pub user_id: String,
    pub lecture_id: String,
    pub course_id: String,
    pub watched_sec: i32,
    pub is_completed: bool,
}