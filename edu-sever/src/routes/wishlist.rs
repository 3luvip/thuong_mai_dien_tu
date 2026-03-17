// src/routes/wishlist.rs

use axum::{routing::{delete, get, post}, Router};
use crate::controllers::wishlist::{
    add_to_wishlist, get_wishlist, get_wishlist_ids, remove_from_wishlist,
};
use crate::state::AppState;

pub fn wishlist_routes() -> Router<AppState> {
    Router::new()
        .route("/{user_id}",      get(get_wishlist))
        .route("/{user_id}/ids",  get(get_wishlist_ids))
        .route("/add",               post(add_to_wishlist))
        .route("/remove",           delete(remove_from_wishlist))
}