// src/routes/withdrawal.rs

use axum::{
    Router,
    routing::{delete, get, patch, post},
};

use crate::controllers::withdrawal::{
    admin_list_requests, approve_request, cancel_request,
    create_withdrawal, get_balance, get_bank_account,
    get_my_requests, reject_request, upsert_bank_account,
};
use crate::state::AppState;

pub fn withdrawal_routes() -> Router<AppState> {
    Router::new()
        // Instructor
        .route("/balance/{instructor_id}",      get(get_balance))
        .route("/bank/{instructor_id}",         get(get_bank_account))
        .route("/bank",                         post(upsert_bank_account))
        .route("/request",                      post(create_withdrawal))
        .route("/requests/{instructor_id}",     get(get_my_requests))
        .route("/request/{id}",                 delete(cancel_request))
        // Admin
        .route("/request/{id}/approve",         patch(approve_request))
        .route("/request/{id}/reject",          patch(reject_request))
        .route("/admin/requests",               get(admin_list_requests))
}