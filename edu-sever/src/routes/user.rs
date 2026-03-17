use axum::{routing::get, Router, Json};
use serde_json::{json, Value};
use crate::middleware::auth::AuthUser;
use crate::state::AppState;

async fn instructor_route(AuthUser(claims): AuthUser) -> Json<Value> {
    if claims.role != "instructor" {
        return Json(json!({ "message": "Forbidden: Instructors only" }));
    }
    Json(json!({ "message": "Welcome Instructor" }))
}

async fn user_route(AuthUser(_claims): AuthUser) -> Json<Value> {
    Json(json!({ "message": "Welcome User" }))
}

/// Returns Router<AppState> — state is provided by main via with_state
pub fn user_routes() -> Router<AppState> {
    Router::new()
        .route("/instructor", get(instructor_route))
        .route("/user",       get(user_route))
} 