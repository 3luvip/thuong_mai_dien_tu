use axum::{routing::{get, post}, Router};
use crate::controllers::auth::{get_user_info, login, signup, verify_token};
use crate::state::AppState;

pub fn auth_routes() -> Router<AppState> {
    Router::new()
        .route("/signup",    post(signup))
        .route("/login",     post(login))
        .route("/verify",    get(verify_token))
        .route("/user-Info", get(get_user_info))
}