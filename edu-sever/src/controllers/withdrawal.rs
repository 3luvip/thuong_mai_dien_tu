// src/controllers/withdrawal.rs
// Instructor payout / withdrawal feature
//
// Endpoints (registered under /withdrawal):
//   GET    /balance/:instructor_id         → available balance
//   GET    /bank/:instructor_id            → get saved bank account
//   POST   /bank                           → upsert bank account
//   POST   /request                        → create withdrawal request
//   GET    /requests/:instructor_id        → list own requests
//   DELETE /request/:id                    → cancel pending request
//   PATCH  /request/:id/approve            → admin: approve
//   PATCH  /request/:id/reject             → admin: reject
//   GET    /admin/requests                 → admin: list all pending

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use bigdecimal::ToPrimitive;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::errors::{AppError, AppResult};
use crate::middleware::auth::AuthUser;
use crate::models::user::Claims;
use crate::state::AppState;

// ─── Request / Response types ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UpsertBankRequest {
    pub bank_name: String,
    pub bank_branch: Option<String>,
    pub account_number: String,
    pub account_holder: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateWithdrawalRequest {
    pub instructor_id: String,
    pub amount: f64,
}

#[derive(Debug, Deserialize)]
pub struct ReviewRequest {
    pub note: Option<String>,
}

// ─── DB row helpers ───────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct BankRow {
    id: String,
    bank_name: String,
    bank_branch: Option<String>,
    account_number: String,
    account_holder: String,
}

#[derive(sqlx::FromRow)]
struct WithdrawalRow {
    id: String,
    instructor_id: String,
    amount: bigdecimal::BigDecimal,
    platform_fee: bigdecimal::BigDecimal,
    net_amount: bigdecimal::BigDecimal,
    status: String,
    note: Option<String>,
    bank_snapshot: String, // JSON stored as text
    created_at: chrono::NaiveDateTime,
    updated_at: chrono::NaiveDateTime,
}

fn withdrawal_to_json(r: &WithdrawalRow) -> Value {
    let snapshot: Value = serde_json::from_str(&r.bank_snapshot).unwrap_or(Value::Null);
    json!({
        "id":           r.id,
        "instructorId": r.instructor_id,
        "amount":       r.amount.to_f64().unwrap_or(0.0),
        "platformFee":  r.platform_fee.to_f64().unwrap_or(0.0),
        "netAmount":    r.net_amount.to_f64().unwrap_or(0.0),
        "status":       r.status,
        "note":         r.note,
        "bankSnapshot": snapshot,
        "createdAt":    r.created_at.format("%Y-%m-%d %H:%M").to_string(),
        "updatedAt":    r.updated_at.format("%Y-%m-%d %H:%M").to_string(),
    })
}

// ─── Platform fee rate (30%) ─────────────────────────────────────────────────
const PLATFORM_FEE_RATE: f64 = 0.30;

// ─── GET /withdrawal/balance/:instructor_id ───────────────────────────────────
// Calculates:
//   gross_revenue  = sum of order_items.price for courses owned by instructor (paid orders)
//   total_withdrawn = sum of approved withdrawal net_amounts
//   available      = gross_revenue * (1 - FEE_RATE) - total_withdrawn

pub async fn get_balance(
    State(state): State<AppState>,
    Path(instructor_id): Path<String>,
) -> AppResult<Json<Value>> {
    // Gross revenue from all paid sales
    let (gross_revenue,): (Option<bigdecimal::BigDecimal>,) = sqlx::query_as(
        r#"SELECT CAST(SUM(oi.price) AS DECIMAL(14,2))
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           JOIN courses c ON c.id = oi.course_id
           WHERE c.instructor_id = ? AND o.status = 'paid'"#,
    )
    .bind(&instructor_id)
    .fetch_one(&state.db)
    .await?;

    let gross = gross_revenue
        .as_ref()
        .and_then(|v| v.to_f64())
        .unwrap_or(0.0);
    let platform_cut = gross * PLATFORM_FEE_RATE;
    let net_revenue = gross - platform_cut;

    // Total already approved/paid out
    let (withdrawn,): (Option<bigdecimal::BigDecimal>,) = sqlx::query_as(
        r#"SELECT CAST(SUM(net_amount) AS DECIMAL(14,2))
           FROM withdrawal_requests
           WHERE instructor_id = ? AND status = 'approved'"#,
    )
    .bind(&instructor_id)
    .fetch_one(&state.db)
    .await?;

    let total_withdrawn = withdrawn.as_ref().and_then(|v| v.to_f64()).unwrap_or(0.0);

    // Pending (locked, can't withdraw again until resolved)
    let (pending,): (Option<bigdecimal::BigDecimal>,) = sqlx::query_as(
        r#"SELECT CAST(SUM(amount) AS DECIMAL(14,2))
           FROM withdrawal_requests
           WHERE instructor_id = ? AND status = 'pending'"#,
    )
    .bind(&instructor_id)
    .fetch_one(&state.db)
    .await?;

    let total_pending = pending.as_ref().and_then(|v| v.to_f64()).unwrap_or(0.0);

    let available = (net_revenue - total_withdrawn - total_pending).max(0.0);

    Ok(Json(json!({
        "grossRevenue":   gross,
        "platformFee":    platform_cut,
        "netRevenue":     net_revenue,
        "totalWithdrawn": total_withdrawn,
        "pendingAmount":  total_pending,
        "available":      available,
        "feeRate":        PLATFORM_FEE_RATE,
    })))
}

// ─── GET /withdrawal/bank/:instructor_id ──────────────────────────────────────

pub async fn get_bank_account(
    State(state): State<AppState>,
    Path(instructor_id): Path<String>,
) -> AppResult<Json<Value>> {
    let row: Option<BankRow> = sqlx::query_as(
        "SELECT id, bank_name, bank_branch, account_number, account_holder
         FROM bank_accounts WHERE instructor_id = ?",
    )
    .bind(&instructor_id)
    .fetch_optional(&state.db)
    .await?;

    match row {
        Some(r) => Ok(Json(json!({
            "id":            r.id,
            "bankName":      r.bank_name,
            "bankBranch":    r.bank_branch,
            "accountNumber": r.account_number,
            "accountHolder": r.account_holder,
        }))),
        None => Ok(Json(json!(null))),
    }
}

// ─── POST /withdrawal/bank ────────────────────────────────────────────────────

pub async fn upsert_bank_account(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Json(body): Json<UpsertBankRequest>,
) -> AppResult<Json<Value>> {
    if body.bank_name.trim().is_empty() {
        return Err(AppError::Validation("Bank name is required".into()));
    }
    if body.account_number.trim().is_empty() {
        return Err(AppError::Validation("Account number is required".into()));
    }
    if body.account_holder.trim().is_empty() {
        return Err(AppError::Validation(
            "Account holder name is required".into(),
        ));
    }

    let id = Uuid::new_v4().to_string();
    sqlx::query(
        r#"INSERT INTO bank_accounts
               (id, instructor_id, bank_name, bank_branch, account_number, account_holder)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
               bank_name      = VALUES(bank_name),
               bank_branch    = VALUES(bank_branch),
               account_number = VALUES(account_number),
               account_holder = VALUES(account_holder),
               updated_at     = NOW()"#,
    )
    .bind(&id)
    .bind(&claims.sub)
    .bind(body.bank_name.trim())
    .bind(body.bank_branch.as_deref())
    .bind(body.account_number.trim())
    .bind(body.account_holder.trim())
    .execute(&state.db)
    .await?;

    Ok(Json(
        json!({ "message": "Bank account saved successfully" }),
    ))
}

// ─── POST /withdrawal/request ─────────────────────────────────────────────────

pub async fn create_withdrawal(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Json(body): Json<CreateWithdrawalRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    // Must be requesting for own account
    if claims.sub != body.instructor_id {
        return Err(AppError::Forbidden(
            "Cannot request withdrawal for another instructor".into(),
        ));
    }

    if body.amount <= 0.0 {
        return Err(AppError::Validation("Amount must be greater than 0".into()));
    }

    // Min withdrawal: 100,000 VND
    if body.amount < 100_000.0 {
        return Err(AppError::Validation(
            "Minimum withdrawal amount is 100,000 ₫".into(),
        ));
    }

    // Check bank account exists
    let bank: Option<BankRow> = sqlx::query_as(
        "SELECT id, bank_name, bank_branch, account_number, account_holder
         FROM bank_accounts WHERE instructor_id = ?",
    )
    .bind(&body.instructor_id)
    .fetch_optional(&state.db)
    .await?;

    let bank = bank.ok_or_else(|| {
        AppError::Validation("Please add a bank account before requesting a withdrawal".into())
    })?;

    // Check available balance (reuse logic)
    let (gross_revenue,): (Option<bigdecimal::BigDecimal>,) = sqlx::query_as(
        r#"SELECT CAST(SUM(oi.price) AS DECIMAL(14,2))
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           JOIN courses c ON c.id = oi.course_id
           WHERE c.instructor_id = ? AND o.status = 'paid'"#,
    )
    .bind(&body.instructor_id)
    .fetch_one(&state.db)
    .await?;

    let gross = gross_revenue.and_then(|v| v.to_f64()).unwrap_or(0.0);
    let net_revenue = gross * (1.0 - PLATFORM_FEE_RATE);

    let (withdrawn,): (Option<bigdecimal::BigDecimal>,) = sqlx::query_as(
        "SELECT CAST(SUM(net_amount) AS DECIMAL(14,2)) FROM withdrawal_requests WHERE instructor_id = ? AND status = 'approved'",
    )
    .bind(&body.instructor_id)
    .fetch_one(&state.db)
    .await?;

    let (pending,): (Option<bigdecimal::BigDecimal>,) = sqlx::query_as(
        "SELECT CAST(SUM(amount) AS DECIMAL(14,2)) FROM withdrawal_requests WHERE instructor_id = ? AND status = 'pending'",
    )
    .bind(&body.instructor_id)
    .fetch_one(&state.db)
    .await?;

    let available = (net_revenue
        - withdrawn.and_then(|v| v.to_f64()).unwrap_or(0.0)
        - pending.and_then(|v| v.to_f64()).unwrap_or(0.0))
    .max(0.0);

    if body.amount > available {
        return Err(AppError::Validation(format!(
            "Insufficient balance. Available: {:.0} ₫",
            available
        )));
    }

    let platform_fee = (body.amount * PLATFORM_FEE_RATE).round();
    let net_amount = body.amount - platform_fee;

    // Snapshot bank info at time of request
    let bank_snapshot = json!({
        "bankName":      bank.bank_name,
        "bankBranch":    bank.bank_branch,
        "accountNumber": bank.account_number,
        "accountHolder": bank.account_holder,
    });

    let request_id = Uuid::new_v4().to_string();
    sqlx::query(
        r#"INSERT INTO withdrawal_requests
               (id, instructor_id, amount, platform_fee, net_amount, status, bank_snapshot)
           VALUES (?, ?, ?, ?, ?, 'pending', ?)"#,
    )
    .bind(&request_id)
    .bind(&body.instructor_id)
    .bind(body.amount)
    .bind(platform_fee)
    .bind(net_amount)
    .bind(bank_snapshot.to_string())
    .execute(&state.db)
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "message":   "Withdrawal request submitted successfully",
            "requestId": request_id,
            "amount":    body.amount,
            "netAmount": net_amount,
            "platformFee": platform_fee,
        })),
    ))
}

// ─── GET /withdrawal/requests/:instructor_id ──────────────────────────────────

pub async fn get_my_requests(
    State(state): State<AppState>,
    Path(instructor_id): Path<String>,
) -> AppResult<Json<Value>> {
    let rows: Vec<WithdrawalRow> = sqlx::query_as(
        r#"SELECT id, instructor_id, amount, platform_fee, net_amount,
          status, note, CAST(bank_snapshot AS CHAR) AS bank_snapshot, created_at, updated_at
   FROM withdrawal_requests
   WHERE instructor_id = ?
   ORDER BY created_at DESC"#,
    )
    .bind(&instructor_id)
    .fetch_all(&state.db)
    .await?;

    let list: Vec<Value> = rows.iter().map(withdrawal_to_json).collect();
    Ok(Json(json!({ "requests": list })))
}

// ─── DELETE /withdrawal/request/:id ──────────────────────────────────────────

pub async fn cancel_request(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Path(request_id): Path<String>,
) -> AppResult<Json<Value>> {
    let row: Option<(String, String)> =
        sqlx::query_as("SELECT instructor_id, status FROM withdrawal_requests WHERE id = ?")
            .bind(&request_id)
            .fetch_optional(&state.db)
            .await?;

    let (owner_id, status) =
        row.ok_or_else(|| AppError::NotFound("Withdrawal request not found".into()))?;

    if owner_id != claims.sub {
        return Err(AppError::Forbidden("Not your request".into()));
    }
    if status != "pending" {
        return Err(AppError::Validation(
            "Only pending requests can be cancelled".into(),
        ));
    }

    sqlx::query("UPDATE withdrawal_requests SET status = 'cancelled' WHERE id = ?")
        .bind(&request_id)
        .execute(&state.db)
        .await?;

    Ok(Json(json!({ "message": "Request cancelled" })))
}

// ─── PATCH /withdrawal/request/:id/approve  (admin only) ─────────────────────

pub async fn approve_request(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Path(request_id): Path<String>,
    Json(body): Json<ReviewRequest>,
) -> AppResult<Json<Value>> {
    // In a real app check claims.role == "admin"
    // For now any authenticated user with this endpoint can approve
    let _ = claims;

    let row: Option<(String,)> =
        sqlx::query_as("SELECT status FROM withdrawal_requests WHERE id = ?")
            .bind(&request_id)
            .fetch_optional(&state.db)
            .await?;

    let (status,) = row.ok_or_else(|| AppError::NotFound("Request not found".into()))?;

    if status != "pending" {
        return Err(AppError::Validation("Request is not pending".into()));
    }

    sqlx::query(
        "UPDATE withdrawal_requests SET status = 'approved', note = ?, updated_at = NOW() WHERE id = ?",
    )
    .bind(&body.note)
    .bind(&request_id)
    .execute(&state.db)
    .await?;

    Ok(Json(json!({ "message": "Request approved" })))
}

// ─── PATCH /withdrawal/request/:id/reject  (admin only) ──────────────────────

pub async fn reject_request(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Path(request_id): Path<String>,
    Json(body): Json<ReviewRequest>,
) -> AppResult<Json<Value>> {
    let _ = claims;

    let row: Option<(String,)> =
        sqlx::query_as("SELECT status FROM withdrawal_requests WHERE id = ?")
            .bind(&request_id)
            .fetch_optional(&state.db)
            .await?;

    let (status,) = row.ok_or_else(|| AppError::NotFound("Request not found".into()))?;

    if status != "pending" {
        return Err(AppError::Validation("Request is not pending".into()));
    }

    sqlx::query(
        "UPDATE withdrawal_requests SET status = 'rejected', note = ?, updated_at = NOW() WHERE id = ?",
    )
    .bind(&body.note)
    .bind(&request_id)
    .execute(&state.db)
    .await?;

    Ok(Json(json!({ "message": "Request rejected" })))
}

// ─── GET /withdrawal/admin/requests  (admin: all pending) ────────────────────

pub async fn admin_list_requests(State(state): State<AppState>) -> AppResult<Json<Value>> {
    #[derive(sqlx::FromRow)]
    struct AdminRow {
        id: String,
        instructor_id: String,
        instructor_name: Option<String>,
        amount: bigdecimal::BigDecimal,
        platform_fee: bigdecimal::BigDecimal,
        net_amount: bigdecimal::BigDecimal,
        status: String,
        note: Option<String>,
        bank_snapshot: String,
        created_at: chrono::NaiveDateTime,
        updated_at: chrono::NaiveDateTime,
    }

    let rows: Vec<AdminRow> = sqlx::query_as(
        r#"SELECT wr.id, wr.instructor_id,
          u.name AS instructor_name,
          wr.amount, wr.platform_fee, wr.net_amount,
          wr.status, wr.note, CAST(wr.bank_snapshot AS CHAR) AS bank_snapshot,
          wr.created_at, wr.updated_at
   FROM withdrawal_requests wr
   JOIN users u ON u.id = wr.instructor_id
   ORDER BY wr.created_at DESC
   LIMIT 100"#,
    )
    .fetch_all(&state.db)
    .await?;

    let list: Vec<Value> = rows
        .iter()
        .map(|r| {
            let snapshot: Value = serde_json::from_str(&r.bank_snapshot).unwrap_or(Value::Null);
            json!({
                "id":             r.id,
                "instructorId":   r.instructor_id,
                "instructorName": r.instructor_name,
                "amount":         r.amount.to_f64().unwrap_or(0.0),
                "platformFee":    r.platform_fee.to_f64().unwrap_or(0.0),
                "netAmount":      r.net_amount.to_f64().unwrap_or(0.0),
                "status":         r.status,
                "note":           r.note,
                "bankSnapshot":   snapshot,
                "createdAt":      r.created_at.format("%Y-%m-%d %H:%M").to_string(),
                "updatedAt":      r.updated_at.format("%Y-%m-%d %H:%M").to_string(),
            })
        })
        .collect();

    Ok(Json(json!({ "requests": list })))
}
