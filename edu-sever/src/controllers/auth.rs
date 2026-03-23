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
    if body.email.is_empty() || !body.email.contains('@') {
        return Err(AppError::Validation("Please enter a valid email".into()));
    }
    if body.password.len() < 6 {
        return Err(AppError::Validation("Password must be at least 6 characters".into()));
    }
    if body.name.trim().is_empty() {
        return Err(AppError::Validation("Name must not be empty".into()));
    }
    if !VALID_ROLES.contains(&body.role.as_str()) {
        return Err(AppError::Validation("Role must be 'instructor' or 'user'".into()));
    }

    let existing: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM users WHERE email = ?"
    )
    .bind(&body.email)
    .fetch_optional(&state.db)
    .await?;

    if existing.is_some() {
        return Err(AppError::Validation("Email already exists".into()));
    }

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

#[derive(sqlx::FromRow)]
struct UserRow {
    id:        String,
    email:     String,
    password:  String,
    role:      String,
    is_banned: i8,
}

pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> AppResult<Json<Value>> {
    // Fetch user — cả is_banned
    let user: Option<UserRow> = sqlx::query_as(
        "SELECT id, email, password, role, is_banned FROM users WHERE email = ?"
    )
    .bind(&body.email)
    .fetch_optional(&state.db)
    .await?;

    // Không tìm thấy → 404
    let user = user.ok_or_else(|| AppError::NotFound("Email not found".into()))?;

    // Verify password → 401 nếu sai
    let is_valid = verify(&body.password, &user.password)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    if !is_valid {
        return Err(AppError::Unauthorized);
    }

    // Check banned → 403 với lý do
    if user.is_banned == 1 {
        let ban_reason: Option<(Option<String>,)> = sqlx::query_as(
            "SELECT ban_reason FROM users WHERE id = ?"
        )
        .bind(&user.id)
        .fetch_optional(&state.db)
        .await?;

        let reason = ban_reason
            .and_then(|(r,)| r)
            .unwrap_or_else(|| "Violation of Terms of Service".into());

        return Ok(Json(json!({
            "banned": true,
            "reason": reason
        })));
    }

    // Build JWT (8 hour expiry)
    let exp = (Utc::now().timestamp() + 8 * 3600) as usize;
    let claims = Claims {
        sub:   user.id.clone(),
        email: user.email.clone(),
        role:  user.role.clone(),
        exp,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.jwt_secret.as_bytes()),
    )?;

    Ok(Json(json!({
        "token":  token,
        "userId": user.id,
        "role":   user.role   // trả về "admin" / "instructor" / "user"
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
    let row: Option<(String, String, String, String)> = sqlx::query_as(
        "SELECT name, email, role, status FROM users WHERE id = ?"
    )
    .bind(&claims.sub)
    .fetch_optional(&state.db)
    .await?;

    let (name, email, role, status) = row
        .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    Ok(Json(json!({ "name": name, "email": email, "role": role, "status": status })))
}

// ─── PUT /auth/update-profile ─────────────────────────────────────────────────

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

    if let Some(ref n) = body.name {
        if n.trim().is_empty() {
            return Err(AppError::Validation("Name must not be empty".into()));
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
        message: "Updated successfully".into(),
        name:    row.name,
        status:  row.status,
    }))
}

// ─── PUT /auth/change-password ────────────────────────────────────────────────

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
        return Err(AppError::Validation("New password must be at least 6 characters".into()));
    }

    let row = sqlx::query!("SELECT password FROM users WHERE id = ?", user_id)
        .fetch_one(&state.db)
        .await?;

    let ok = bcrypt::verify(&body.current_password, &row.password)
        .map_err(|_| AppError::Internal("bcrypt error".into()))?;

    if !ok {
        return Err(AppError::Validation("Current password is incorrect".into()));
    }

    let hashed = bcrypt::hash(&body.new_password, bcrypt::DEFAULT_COST)
        .map_err(|_| AppError::Internal("hash error".into()))?;

    sqlx::query!("UPDATE users SET password = ? WHERE id = ?", hashed, user_id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "message": "Password changed successfully" })))
}