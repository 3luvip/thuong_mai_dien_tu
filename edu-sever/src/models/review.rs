use serde::Deserialize;

#[derive(Deserialize)]
pub struct CreateReviewRequest {
    pub course_id: String,
    pub user_id: String,
    pub rating: u8,
    pub comment: Option<String>,
}