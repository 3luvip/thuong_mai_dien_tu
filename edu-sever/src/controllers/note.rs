// src/controllers/note.rs

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{errors::{AppError, AppResult}, state::AppState};

// ─── Request bodies ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateNoteRequest {
    pub user_id:    String,
    pub lecture_id: String,
    pub course_id:  String,
    pub content:    String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateNoteRequest {
    pub content: String,
}

// ─── GET /notes/:user_id/:lecture_id ─────────────────────────────────────────
// Lấy tất cả note của user cho một bài giảng

pub async fn get_notes(
    State(state): State<AppState>,
    Path((user_id, lecture_id)): Path<(String, String)>,
) -> AppResult<Json<Value>> {
    #[derive(sqlx::FromRow)]
    struct NoteRow {
        id:         String,
        content:    String,
        created_at: chrono::NaiveDateTime,
        updated_at: chrono::NaiveDateTime,
    }

    let rows: Vec<NoteRow> = sqlx::query_as(
        r#"SELECT id, content, created_at, updated_at
           FROM lecture_notes
           WHERE user_id = ? AND lecture_id = ?
           ORDER BY created_at ASC"#,
    )
    .bind(&user_id)
    .bind(&lecture_id)
    .fetch_all(&state.db)
    .await?;

    let notes: Vec<Value> = rows.into_iter().map(|r| json!({
        "id":        r.id,
        "content":   r.content,
        "createdAt": r.created_at.format("%Y-%m-%d %H:%M").to_string(),
        "updatedAt": r.updated_at.format("%Y-%m-%d %H:%M").to_string(),
    })).collect();

    Ok(Json(json!({ "notes": notes })))
}

// ─── POST /notes ──────────────────────────────────────────────────────────────
// Tạo note mới

pub async fn create_note(
    State(state): State<AppState>,
    Json(body): Json<CreateNoteRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    let content = body.content.trim().to_string();
    if content.is_empty() {
        return Err(AppError::Validation("Note content cannot be empty".into()));
    }
    if content.len() > 10_000 {
        return Err(AppError::Validation("Note max 10,000 characters".into()));
    }

    let note_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO lecture_notes (id, user_id, lecture_id, course_id, content)
         VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&note_id)
    .bind(&body.user_id)
    .bind(&body.lecture_id)
    .bind(&body.course_id)
    .bind(&content)
    .execute(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(json!({
        "message": "Note created",
        "note": {
            "id":      note_id,
            "content": content,
        }
    }))))
}

// ─── PATCH /notes/:note_id ────────────────────────────────────────────────────
// Cập nhật nội dung note

pub async fn update_note(
    State(state): State<AppState>,
    Path(note_id): Path<String>,
    Json(body): Json<UpdateNoteRequest>,
) -> AppResult<Json<Value>> {
    let content = body.content.trim().to_string();
    if content.is_empty() {
        return Err(AppError::Validation("Note content cannot be empty".into()));
    }
    if content.len() > 10_000 {
        return Err(AppError::Validation("Note max 10,000 characters".into()));
    }

    let result = sqlx::query(
        "UPDATE lecture_notes SET content = ? WHERE id = ?"
    )
    .bind(&content)
    .bind(&note_id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Note not found".into()));
    }

    Ok(Json(json!({ "message": "Note updated", "content": content })))
}

// ─── DELETE /notes/:note_id ───────────────────────────────────────────────────

pub async fn delete_note(
    State(state): State<AppState>,
    Path(note_id): Path<String>,
) -> AppResult<StatusCode> {
    sqlx::query("DELETE FROM lecture_notes WHERE id = ?")
        .bind(&note_id)
        .execute(&state.db)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}