use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::Utc;
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::errors::{AppError, AppResult};
use crate::middleware::auth::AuthUser;
use crate::models::user::{Claims, LoginRequest, SignupRequest};
use crate::state::AppState;

const VALID_ROLES: &[&str] = &["instructor", "user"];

// ─── POST /auth/signup ────────────────────────────────────────────────────────

pub async fn signup(
    State(state): State<AppState>,
    Json(body): Json<SignupRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    // Validate email
    if body.email.is_empty() || !body.email.contains('@') {
        return Err(AppError::Validation("Please enter a valid email".into()));
    }
    // Validate password length
    if body.password.len() < 6 {
        return Err(AppError::Validation("Password must be at least 6 characters".into()));
    }
    // Validate name
    if body.name.trim().is_empty() {
        return Err(AppError::Validation("Name must not be empty".into()));
    }
    // Validate role
    if !VALID_ROLES.contains(&body.role.as_str()) {
        return Err(AppError::Validation("Role must be 'instructor' or 'user'".into()));
    }

    // Check email uniqueness
    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM users WHERE email = ?"
    )
    .bind(&body.email)
    .fetch_optional(&state.db)
    .await?;

    if existing.is_some() {
        return Err(AppError::Validation("Email already exists".into()));
    }

    // Hash password
    let hashed = hash(&body.password, DEFAULT_COST)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let user_id = Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&user_id)
    .bind(&body.email)
    .bind(&hashed)
    .bind(&body.name)
    .bind(&body.role)
    .execute(&state.db)
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "message": "User created successfully",
            "userId": user_id
        })),
    ))
}

// ─── POST /auth/login ─────────────────────────────────────────────────────────

pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> AppResult<Json<Value>> {
    // Find user
    let user: Option<(String, String, String, String)> = sqlx::query_as(
        "SELECT id, email, password, role FROM users WHERE email = ?"
    )
    .bind(&body.email)
    .fetch_optional(&state.db)
    .await?;

    let (user_id, email, hashed_password, role) = user.ok_or_else(|| {
        AppError::Unauthorized
    })?;

    // Verify password
    let is_valid = verify(&body.password, &hashed_password)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    if !is_valid {
        return Err(AppError::Unauthorized);
    }

    // Build JWT (8 hour expiry)
    let exp = (Utc::now().timestamp() + 8 * 3600) as usize;
    let claims = Claims {
        sub: user_id.clone(),
        email: email.clone(),
        role: role.clone(),
        exp,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.jwt_secret.as_bytes()),
    )?;

    Ok(Json(json!({
        "token": token,
        "userId": user_id,
        "role": role
    })))
}

// ─── GET /auth/verify ─────────────────────────────────────────────────────────

pub async fn verify_token(
    AuthUser(claims): AuthUser,
) -> Json<Value> {
    Json(json!({
        "message": "Token is valid",
        "userId": claims.sub
    }))
}

// ─── GET /auth/user-Info ──────────────────────────────────────────────────────

pub async fn get_user_info(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
) -> AppResult<Json<Value>> {
    let row: Option<(String, String)> = sqlx::query_as(
        "SELECT name, email FROM users WHERE id = ?"
    )
    .bind(&claims.sub)
    .fetch_optional(&state.db)
    .await?;

    let (name, email) = row.ok_or_else(|| AppError::NotFound("User not found".into()))?;

    Ok(Json(json!({ "name": name, "email": email })))
}

// ─── Update Profile ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub name:   Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UpdateProfileResponse {
    pub message: String,
    pub name:    String,
    pub status:  String,
}

pub async fn update_profile(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Json(body): Json<UpdateProfileRequest>,
) -> Result<Json<UpdateProfileResponse>, AppError> {
    let user_id = &claims.sub;

    // Validate
    if let Some(ref n) = body.name {
        if n.trim().is_empty() {
            return Err(AppError::Validation("Tên không được để trống".into()));
        }
    }

    sqlx::query!(
        "UPDATE users SET name = COALESCE(?, name), status = COALESCE(?, status) WHERE id = ?",
        body.name,
        body.status,
        user_id,
    )
    .execute(&state.db)
    .await?;

    let row = sqlx::query!("SELECT name, status FROM users WHERE id = ?", user_id)
        .fetch_one(&state.db)
        .await?;

    Ok(Json(UpdateProfileResponse {
        message: "Cập nhật thành công".into(),
        name:    row.name,
        status:  row.status,
    }))
}

// ─── Change Password ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password:     String,
}

pub async fn change_password(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Json(body): Json<ChangePasswordRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let user_id = &claims.sub;

    if body.new_password.len() < 6 {
        return Err(AppError::Validation("Mật khẩu mới phải ít nhất 6 ký tự".into()));
    }

    let row = sqlx::query!("SELECT password FROM users WHERE id = ?", user_id)
        .fetch_one(&state.db)
        .await?;

    let ok = bcrypt::verify(&body.current_password, &row.password)
        .map_err(|_| AppError::Internal("bcrypt error".into()))?;

    if !ok {
        return Err(AppError::Validation("Mật khẩu hiện tại không đúng".into()));
    }

    let hashed = bcrypt::hash(&body.new_password, bcrypt::DEFAULT_COST)
        .map_err(|_| AppError::Internal("hash error".into()))?;

    sqlx::query!("UPDATE users SET password = ? WHERE id = ?", hashed, user_id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "message": "Đổi mật khẩu thành công" })))
}