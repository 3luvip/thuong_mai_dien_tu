use axum::{routing::post, Router};
use crate::controllers::ai::suggest;
use crate::state::AppState;

pub fn ai_routes() -> Router<AppState> {
    Router::new()
        .route("/suggest", post(suggest))
}

