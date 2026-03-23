// src/routes/note.rs

use axum::{Router, routing::{delete, get, patch, post}};
use crate::state::AppState;
use crate::controllers::note::{get_notes, create_note, update_note, delete_note};

pub fn note_routes() -> Router<AppState> {
    Router::new()
        // GET  /notes/:user_id/:lecture_id  → lấy notes của bài giảng
        .route("/{user_id}/{lecture_id}", get(get_notes))
        // POST /notes                       → tạo note mới
        .route("/",                       post(create_note))
        // PATCH /notes/:note_id            → cập nhật note
        .route("/{note_id}",              patch(update_note))
        // DELETE /notes/:note_id           → xóa note
        .route("/{note_id}",              delete(delete_note))
}