
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
    pub filename: String,
    pub instructor_id: String,
    pub course_instruction_id: Option<String>,
    pub instructor_name: Option<String>,
    pub instructor_email: Option<String>,
}
#[derive(sqlx::FromRow)]
pub struct CourseCardRow {
    pub id: String,
    pub title: String,
    pub author: String,
    pub price: bigdecimal::BigDecimal,
    pub current_price: bigdecimal::BigDecimal,
    pub path: String,
    pub filename: String,
    pub instructor_id: String,
    pub course_detail_id: String,
    pub instructor_name: Option<String>,
    pub instructor_email: Option<String>,
}

#[derive(sqlx::FromRow)]
pub struct AllCourseRow {
    pub id: String,
    pub title: String,
    pub author: String,
    pub course_sub: String,
    pub price: bigdecimal::BigDecimal,
    pub language: String,
    pub level: String,
    pub category: String,
    pub path: String,
    pub filename: String,
    pub instructor_id: String,
    pub instructor_name: Option<String>,
    pub current_price: Option<bigdecimal::BigDecimal>,
    pub card_id: Option<String>,
}
