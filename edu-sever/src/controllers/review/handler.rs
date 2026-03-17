use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use bigdecimal::ToPrimitive;
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{
    errors::{AppError, AppResult},
    state::AppState,
};

#[derive(Deserialize)]
pub struct CreateReviewRequest {
    pub course_id: String,
    pub user_id: String,
    pub rating: u8,
    pub comment: Option<String>,
}

pub async fn create_review(
    State(state): State<AppState>,
    Json(body): Json<CreateReviewRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    if body.rating < 1 || body.rating > 5 {
        return Err(AppError::Validation("Rating phải từ 1 đến 5".into()));
    }

    // Kiểm tra user đã mua khóa học chưa
    let purchased: Option<(String,)> = sqlx::query_as(
        r#"SELECT oi.id FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE oi.course_id = ? AND o.user_id = ? AND o.status = 'paid'
           LIMIT 1"#,
    )
    .bind(&body.course_id)
    .bind(&body.user_id)
    .fetch_optional(&state.db)
    .await?;

    if purchased.is_none() {
        return Err(AppError::Validation(
            "Bạn cần mua khóa học trước khi đánh giá".into(),
        ));
    }

    let review_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO reviews (id, course_id, user_id, rating, comment) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), updated_at = NOW()",
    )
    .bind(&review_id)
    .bind(&body.course_id)
    .bind(&body.user_id)
    .bind(body.rating)
    .bind(&body.comment)
    .execute(&state.db)
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({ "message": "Đánh giá đã được ghi nhận!", "reviewId": review_id })),
    ))
}
