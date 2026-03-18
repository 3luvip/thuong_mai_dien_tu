use axum::{Router, routing::{get, post, put}};
use crate::controllers::auth::{change_password, get_user_info, login, signup, update_profile, verify_token};
use crate::state::AppState;

pub fn auth_routes() -> Router<AppState> {
    Router::new()
        .route("/signup",    post(signup))
        .route("/login",     post(login))
        .route("/verify",    get(verify_token))
        .route("/user-Info", get(get_user_info))
        .route("/update-profile",  put(update_profile))  
        .route("/change-password", put(change_password))
}