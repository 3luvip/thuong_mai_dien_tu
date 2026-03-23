// src/routes/admin.rs

use axum::{Router, routing::{delete, get, patch, post}};
use crate::controllers::admin::*;
use crate::state::AppState;

pub fn admin_routes() -> Router<AppState> {
    Router::new()
        .route("/stats",                    get(get_platform_stats))
        // Users
        .route("/users",                    get(list_users))
        .route("/users/{id}/role",          patch(change_user_role))
        .route("/users/{id}/ban",           patch(ban_user))
        .route("/users/{id}/unban",         patch(unban_user))
        .route("/users/{id}",               delete(delete_user))
        // Courses
        .route("/courses",                  get(list_courses))
        .route("/courses/{id}",             delete(delete_course))
        // Withdrawals
        .route("/withdrawals",              get(list_withdrawals))
        .route("/withdrawals/{id}/approve", patch(approve_withdrawal))
        .route("/withdrawals/{id}/reject",  patch(reject_withdrawal))
        // Broadcast
        .route("/broadcast",                post(broadcast_notification))
        .route("/broadcasts",               get(list_broadcasts))
}