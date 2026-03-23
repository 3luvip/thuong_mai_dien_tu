// src/routes/membership.rs

use axum::{Router, routing::{get, post}};
use crate::controllers::membership::{get_membership, get_discount, subscribe};
use crate::state::AppState;

pub fn membership_routes() -> Router<AppState> {
    Router::new()
        .route("/{user_id}",          get(get_membership))
        .route("/discount/{user_id}", get(get_discount))
        .route("/subscribe",         post(subscribe))
}