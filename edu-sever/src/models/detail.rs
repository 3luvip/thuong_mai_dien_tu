#[derive(sqlx::FromRow)]
pub struct CourseInfoRow {
    pub id: String,
    pub title: String,
    pub course_sub: String,
    pub description: String,
    pub language: String,
    pub level: String,
    pub category: String,
    pub filename: String,
    pub instructor_id: String,
    pub instructor_name: Option<String>,
    pub instructor_email: Option<String>,
    pub instructor_status: Option<String>,
}
