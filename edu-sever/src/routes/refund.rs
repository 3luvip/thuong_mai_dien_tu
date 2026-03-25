// src/routes/refund.rs

use axum::{Router, routing::{get, patch, post}};
use crate::controllers::refund::{
    admin_approve_refund, admin_list_refunds, admin_reject_refund,
    create_refund_request, get_eligible_courses,
    get_refund_history, get_subscription_refund_info,
};
use crate::state::AppState;

pub fn refund_routes() -> Router<AppState> {
    Router::new()
        // User endpoints
        .route("/eligible-courses/{user_id}", get(get_eligible_courses))
        .route("/subscription/{user_id}",     get(get_subscription_refund_info))
        .route("/request",                    post(create_refund_request))
        .route("/history/{user_id}",          get(get_refund_history))
        // Admin endpoints
        .route("/admin/requests",             get(admin_list_refunds))
        .route("/admin/{id}/approve",         patch(admin_approve_refund))
        .route("/admin/{id}/reject",          patch(admin_reject_refund))
}