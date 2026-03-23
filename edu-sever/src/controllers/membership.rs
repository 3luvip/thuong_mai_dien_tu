// src/controllers/membership.rs

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use chrono::{Duration, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{errors::{AppError, AppResult}, state::AppState};

// ─── Constants ────────────────────────────────────────────────────────────────

/// Discount % áp dụng khi checkout (không stack với coupon)
pub const PRO_DISCOUNT_PCT:  f64 = 15.0;  // Pro  → 15% off
pub const TEAM_DISCOUNT_PCT: f64 = 25.0;  // Team → 25% off

pub const PRO_PRICE_VND:  f64 = 500_000.0;   // /tháng
pub const TEAM_PRICE_VND: f64 = 2_000_000.0; // /tháng/user

// ─── Request bodies ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SubscribeRequest {
    pub user_id:        String,
    pub tier:           String,   // "pro" | "team"
    pub payment_method: String,
    pub duration_days:  Option<i64>, // mặc định 30
}

// ─── GET /membership/:user_id ─────────────────────────────────────────────────

pub async fn get_membership(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> AppResult<Json<Value>> {
    #[derive(sqlx::FromRow)]
    struct Row {
        membership_tier:       String,
        membership_expires_at: Option<chrono::NaiveDateTime>,
    }

    let row: Option<Row> = sqlx::query_as(
        "SELECT membership_tier, membership_expires_at FROM users WHERE id = ?"
    )
    .bind(&user_id)
    .fetch_optional(&state.db)
    .await?;

    let row = row.ok_or_else(|| AppError::NotFound("User not found".into()))?;

    // Kiểm tra hết hạn — tự động reset về free nếu cần
    let now = Utc::now().naive_utc();
    let is_expired = row.membership_expires_at
        .map(|exp| exp < now)
        .unwrap_or(false);

    if is_expired && row.membership_tier != "free" {
        sqlx::query(
            "UPDATE users SET membership_tier = 'free', membership_expires_at = NULL WHERE id = ?"
        )
        .bind(&user_id)
        .execute(&state.db)
        .await?;

        return Ok(Json(json!({
            "tier":      "free",
            "expiresAt": null,
            "isActive":  false,
            "discount":  0,
        })));
    }

    let discount = match row.membership_tier.as_str() {
        "pro"  => PRO_DISCOUNT_PCT,
        "team" => TEAM_DISCOUNT_PCT,
        _      => 0.0,
    };

    // Lấy lịch sử giao dịch
    #[derive(sqlx::FromRow)]
    struct HistoryRow {
        id:             String,
        tier:           String,
        price_paid:     bigdecimal::BigDecimal,
        duration_days:  i32,
        started_at:     chrono::NaiveDateTime,
        expires_at:     chrono::NaiveDateTime,
        status:         String,
        payment_method: Option<String>,
    }

    use bigdecimal::ToPrimitive;

    let history: Vec<HistoryRow> = sqlx::query_as(
        r#"SELECT id, tier, price_paid, duration_days, started_at, expires_at, status, payment_method
           FROM memberships WHERE user_id = ? ORDER BY created_at DESC LIMIT 10"#
    )
    .bind(&user_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(json!({
        "tier":      row.membership_tier,
        "expiresAt": row.membership_expires_at.map(|d| d.format("%Y-%m-%d %H:%M").to_string()),
        "isActive":  !is_expired && row.membership_tier != "free",
        "discount":  discount,
        "history":   history.iter().map(|h| json!({
            "id":            h.id,
            "tier":          h.tier,
            "pricePaid":     h.price_paid.to_f64().unwrap_or(0.0),
            "durationDays":  h.duration_days,
            "startedAt":     h.started_at.format("%Y-%m-%d").to_string(),
            "expiresAt":     h.expires_at.format("%Y-%m-%d").to_string(),
            "status":        h.status,
            "paymentMethod": h.payment_method,
        })).collect::<Vec<_>>(),
    })))
}

// ─── POST /membership/subscribe ───────────────────────────────────────────────

pub async fn subscribe(
    State(state): State<AppState>,
    Json(body): Json<SubscribeRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    // Validate tier
    let price = match body.tier.as_str() {
        "pro"  => PRO_PRICE_VND,
        "team" => TEAM_PRICE_VND,
        _      => return Err(AppError::Validation("Invalid tier. Must be 'pro' or 'team'".into())),
    };

    let duration_days = body.duration_days.unwrap_or(30).clamp(1, 365);
    let now      = Utc::now().naive_utc();
    let expires  = now + Duration::days(duration_days);

    // Kiểm tra nếu đang có membership còn hạn → gia hạn thêm từ ngày hết hạn
    let current_expires: Option<(Option<chrono::NaiveDateTime>, String)> = sqlx::query_as(
        "SELECT membership_expires_at, membership_tier FROM users WHERE id = ?"
    )
    .bind(&body.user_id)
    .fetch_optional(&state.db)
    .await?;

    let final_expires = match current_expires {
        Some((Some(exp), tier)) if exp > now && tier == body.tier => {
            // Cùng tier, còn hạn → gia hạn thêm
            exp + Duration::days(duration_days)
        }
        _ => expires,
    };

    // Cập nhật user
    sqlx::query(
        "UPDATE users SET membership_tier = ?, membership_expires_at = ? WHERE id = ?"
    )
    .bind(&body.tier)
    .bind(final_expires)
    .bind(&body.user_id)
    .execute(&state.db)
    .await?;

    // Lưu lịch sử
    let membership_id = Uuid::new_v4().to_string();
    sqlx::query(
        r#"INSERT INTO memberships
           (id, user_id, tier, price_paid, duration_days, started_at, expires_at, payment_method)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)"#
    )
    .bind(&membership_id)
    .bind(&body.user_id)
    .bind(&body.tier)
    .bind(price)
    .bind(duration_days as i32)
    .bind(now)
    .bind(final_expires)
    .bind(&body.payment_method)
    .execute(&state.db)
    .await?;

    // Gửi notification
    let notif_id = Uuid::new_v4().to_string();
    let tier_label = if body.tier == "pro" { "Pro" } else { "Team" };
    let discount   = if body.tier == "pro" { PRO_DISCOUNT_PCT } else { TEAM_DISCOUNT_PCT };
    let _ = sqlx::query(
        "INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?, ?, 'system', ?, ?, ?)"
    )
    .bind(&notif_id)
    .bind(&body.user_id)
    .bind(format!("🎉 Welcome to {} Membership!", tier_label))
    .bind(format!(
        "You now enjoy {}% off all courses automatically at checkout! Your membership is valid until {}.",
        discount as i64,
        final_expires.format("%d/%m/%Y")
    ))
    .bind("/my-courses")
    .execute(&state.db)
    .await;

    Ok((StatusCode::CREATED, Json(json!({
        "message":    format!("{} membership activated!", tier_label),
        "tier":       body.tier,
        "expiresAt":  final_expires.format("%Y-%m-%d %H:%M").to_string(),
        "discount":   discount,
        "membershipId": membership_id,
    }))))
}

// ─── GET /membership/discount/:user_id ───────────────────────────────────────
// Dùng khi checkout để lấy discount % của user

pub async fn get_discount(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> AppResult<Json<Value>> {
    let row: Option<(String, Option<chrono::NaiveDateTime>)> = sqlx::query_as(
        "SELECT membership_tier, membership_expires_at FROM users WHERE id = ?"
    )
    .bind(&user_id)
    .fetch_optional(&state.db)
    .await?;

    let (tier, expires) = row.unwrap_or(("free".into(), None));
    let now = Utc::now().naive_utc();

    let is_active = match expires {
        Some(exp) => exp > now && tier != "free",
        None      => false,
    };

    let discount_pct = if is_active {
        match tier.as_str() {
            "pro"  => PRO_DISCOUNT_PCT,
            "team" => TEAM_DISCOUNT_PCT,
            _      => 0.0,
        }
    } else {
        0.0
    };

    Ok(Json(json!({
        "tier":        tier,
        "isActive":    is_active,
        "discountPct": discount_pct,
        "expiresAt":   expires.map(|d| d.format("%Y-%m-%d").to_string()),
    })))
}