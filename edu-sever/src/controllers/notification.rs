// ═══════════════════════════════════════════════════════════════════════════════
// src/controllers/notification.rs  — TẠO MỚI
// ═══════════════════════════════════════════════════════════════════════════════

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde_json::{json, Value};

use crate::errors::{AppError, AppResult};
use crate::state::AppState;

#[derive(sqlx::FromRow)]
struct NotifRow {
    id:         String,
    r#type:     String,
    title:      String,
    body:       String,
    link:       Option<String>,
    is_read:    i8,
    created_at: chrono::NaiveDateTime,
}

// ─── GET /notifications/:userId ──────────────────────────────────────────────
pub async fn get_notifications(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> AppResult<Json<Value>> {
    let rows: Vec<NotifRow> = sqlx::query_as(
        r#"SELECT id, type, title, body, link, is_read, created_at
           FROM notifications
           WHERE user_id = ?
           ORDER BY created_at DESC
           LIMIT 20"#,
    )
    .bind(&user_id)
    .fetch_all(&state.db)
    .await?;

    let (unread_count,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0",
    )
    .bind(&user_id)
    .fetch_one(&state.db)
    .await?;

    let items: Vec<Value> = rows
        .into_iter()
        .map(|r| {
            json!({
                "id":        r.id,
                "type":      r.r#type,
                "title":     r.title,
                "body":      r.body,
                "link":      r.link,
                "isRead":    r.is_read == 1,
                "createdAt": r.created_at.to_string(),
            })
        })
        .collect();

    Ok(Json(json!({
        "notifications": items,
        "unreadCount":   unread_count,
    })))
}

// ─── PATCH /notifications/user/:userId/read-all ───────────────────────────────
pub async fn mark_all_read(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> AppResult<Json<Value>> {
    sqlx::query(
        "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0",
    )
    .bind(&user_id)
    .execute(&state.db)
    .await?;

    Ok(Json(json!({ "message": "All notifications marked as read" })))
}

// ─── PATCH /notifications/item/:notifId/read ─────────────────────────────────
pub async fn mark_one_read(
    State(state): State<AppState>,
    Path(notif_id): Path<String>,
) -> AppResult<Json<Value>> {
    let affected = sqlx::query(
        "UPDATE notifications SET is_read = 1 WHERE id = ?",
    )
    .bind(&notif_id)
    .execute(&state.db)
    .await?
    .rows_affected();

    if affected == 0 {
        return Err(AppError::NotFound("Notification not found".into()));
    }

    Ok(Json(json!({ "message": "Notification marked as read" })))
}

// ─── DELETE /notifications/item/:notifId ─────────────────────────────────────
pub async fn delete_notification(
    State(state): State<AppState>,
    Path(notif_id): Path<String>,
) -> AppResult<StatusCode> {
    sqlx::query("DELETE FROM notifications WHERE id = ?")
        .bind(&notif_id)
        .execute(&state.db)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}