use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Deserialize, Serialize, FromRow)]
pub struct User {
    pub id: String,
    pub email: String,
    pub password: String,
    pub name: String,
    pub role: String,
    pub status: String,
    pub create_at: NaiveDateTime,
    pub update_at: NaiveDateTime
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct UserInfo {
    pub id: String,
    pub name: String,
    pub email: String,
    pub role: String
}

#[derive(Debug, Deserialize)]
pub struct SignupRequest {
    pub email: String,
    pub password: String,
    pub name: String,
    pub role: String,   // "instructor" | "user"
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,        // user id
    pub email: String,
    pub role: String,
    pub exp: usize,         // expiry timestamp
}
