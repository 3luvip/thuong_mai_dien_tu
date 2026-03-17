use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::query;
use uuid::Uuid;

use crate::state::AppState;
use crate::{
    errors::{AppError, AppResult},
    models::user,
};

#[derive(Deserialize)]
pub struct WishlistBody {
    pub user_id: String,
    pub course_id: String,
}

async fn get_or_create_wishlist(
    db: &sqlx::MySqlPool,
    user_id: &str,
) -> Result<String, sqlx::Error> {
    let row: Option<(String,)> = sqlx::query_as("SELECT id FROM wishlists WHERE user_id = ?")
        .bind(user_id)
        .fetch_optional(db)
        .await?;

    if let Some((id,)) = row {
        return Ok(id);
    }

    let id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO wishlists (id, user_id) VALUES (?, ?)")
        .bind(&id)
        .bind(user_id)
        .execute(db)
        .await?;
    Ok(id)
}

pub async fn get_wishlist(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> AppResult<Json<Value>> {
    #[derive(sqlx::FromRow)]
    struct Row {
        id:            String,
        title:         String,
        author:        String,
        price:         bigdecimal::BigDecimal,
        current_price: Option<bigdecimal::BigDecimal>,
        level:         String,
        category:      String,
        path:          String,
        added_at:      chrono::NaiveDateTime,
    }
 
    let rows: Vec<Row> = sqlx::query_as(
        r#"SELECT
               c.id,
               c.title,
               c.author,
               c.price,
               cc.current_price,
               c.level,
               c.category,
               c.path,
               wc.added_at
           FROM wishlists w
           JOIN wishlist_courses wc ON wc.wishlist_id = w.id
           JOIN courses c           ON c.id = wc.course_id
           LEFT JOIN course_cards cc ON cc.course_detail_id = c.id
           WHERE w.user_id = ?
           ORDER BY wc.added_at DESC"#
    )
    .bind(&user_id)
    .fetch_all(&state.db)
    .await?;
 
    use bigdecimal::ToPrimitive;
 
    let courses: Vec<Value> = rows.into_iter().map(|r| {
        json!({
            "id":           r.id,
            "title":        r.title,
            "author":       r.author,
            "price":        r.price.to_f64().unwrap_or(0.0),
            "currentPrice": r.current_price.as_ref().and_then(|v| v.to_f64()),
            "level":        r.level,
            "category":     r.category,
            "path":         r.path,
            "addedAt":      r.added_at.to_string(),
        })
    }).collect();
 
    Ok(Json(json!({
        "courses": courses,
        "total":   courses.len(),   // NOTE: courses moved, use len before
    })))
    // Fix: recalculate
}

pub async fn get_wishlist_fixed(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> AppResult<Json<Value>> {
    #[derive(sqlx::FromRow)]
    struct Row {
        id:            String,
        title:         String,
        author:        String,
        price:         bigdecimal::BigDecimal,
        current_price: Option<bigdecimal::BigDecimal>,
        level:         String,
        category:      String,
        path:          String,
        added_at:      chrono::NaiveDateTime,
    }
 
    use bigdecimal::ToPrimitive;
 
    let rows: Vec<Row> = sqlx::query_as(
        r#"SELECT c.id, c.title, c.author, c.price,
                  cc.current_price, c.level, c.category, c.path, wc.added_at
           FROM wishlists w
           JOIN wishlist_courses wc ON wc.wishlist_id = w.id
           JOIN courses c           ON c.id = wc.course_id
           LEFT JOIN course_cards cc ON cc.course_detail_id = c.id
           WHERE w.user_id = ?
           ORDER BY wc.added_at DESC"#
    )
    .bind(&user_id)
    .fetch_all(&state.db)
    .await?;
 
    let total = rows.len();
    let courses: Vec<Value> = rows.into_iter().map(|r| json!({
        "id":           r.id,
        "title":        r.title,
        "author":       r.author,
        "price":        r.price.to_f64().unwrap_or(0.0),
        "currentPrice": r.current_price.as_ref().and_then(|v| v.to_f64()),
        "level":        r.level,
        "category":     r.category,
        "path":         r.path,
        "addedAt":      r.added_at.to_string(),
    })).collect();
 
    Ok(Json(json!({ "courses": courses, "total": total })))
}

pub async fn add_to_wishlist(
    State(state): State<AppState>,
    Json(body): Json<WishlistBody>,
) -> AppResult<Json<Value>> {
    let wishlist_id = get_or_create_wishlist(&state.db, &body.user_id).await
        .map_err(|e| AppError::Internal(e.to_string()))?;
 
    // Kiểm tra đã có chưa
    let exists: Option<(i64,)> = sqlx::query_as(
        "SELECT 1 FROM wishlist_courses WHERE wishlist_id = ? AND course_id = ?"
    )
    .bind(&wishlist_id)
    .bind(&body.course_id)
    .fetch_optional(&state.db)
    .await?;
 
    if exists.is_some() {
        return Err(AppError::Validation("Khóa học đã có trong danh sách yêu thích.".into()));
    }
 
    sqlx::query(
        "INSERT INTO wishlist_courses (wishlist_id, course_id) VALUES (?, ?)"
    )
    .bind(&wishlist_id)
    .bind(&body.course_id)
    .execute(&state.db)
    .await?;
 
    Ok(Json(json!({ "message": "Đã thêm vào danh sách yêu thích." })))
}
 
// ─── DELETE /wishlist/remove ──────────────────────────────────────────────────
pub async fn remove_from_wishlist(
    State(state): State<AppState>,
    Json(body): Json<WishlistBody>,
) -> AppResult<Json<Value>> {
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM wishlists WHERE user_id = ?"
    )
    .bind(&body.user_id)
    .fetch_optional(&state.db)
    .await?;
 
    let (wishlist_id,) = row
        .ok_or_else(|| AppError::NotFound("Wishlist không tồn tại.".into()))?;
 
    sqlx::query(
        "DELETE FROM wishlist_courses WHERE wishlist_id = ? AND course_id = ?"
    )
    .bind(&wishlist_id)
    .bind(&body.course_id)
    .execute(&state.db)
    .await?;
 
    Ok(Json(json!({ "message": "Đã xóa khỏi danh sách yêu thích." })))
}

pub async fn get_wishlist_ids(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> AppResult<Json<Value>> {
    let ids: Vec<(String,)> = sqlx::query_as(
        r#"SELECT wc.course_id
           FROM wishlists w
           JOIN wishlist_courses wc ON wc.wishlist_id = w.id
           WHERE w.user_id = ?"#
    )
    .bind(&user_id)
    .fetch_all(&state.db)
    .await?;
 
    let id_list: Vec<String> = ids.into_iter().map(|(id,)| id).collect();
    Ok(Json(json!({ "ids": id_list })))
}

