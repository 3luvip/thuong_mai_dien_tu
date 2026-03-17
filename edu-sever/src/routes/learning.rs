// src/routes/learning.rs

use axum::{Router, routing::{get, post}};
use crate::state::AppState;
use crate::controllers::learning::{get_my_courses, get_learn_data, update_progress};

pub fn learning_routes() -> Router<AppState> {
    Router::new()
        .route("/my-courses/{user_id}",               get(get_my_courses))
        .route("/learn/{user_id}/{course_id}",         get(get_learn_data))
        .route("/progress",                            post(update_progress))
}