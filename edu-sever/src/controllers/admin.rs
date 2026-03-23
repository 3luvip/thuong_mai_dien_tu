// src/controllers/admin.rs
// All endpoints require role == "admin" (checked via JWT claims)

use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use bigdecimal::ToPrimitive;
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::errors::{AppError, AppResult};
use crate::middleware::auth::AuthUser;
use crate::state::AppState;

// ─── Guard ────────────────────────────────────────────────────────────────────

fn require_admin(claims: &crate::models::user::Claims) -> AppResult<()> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin access required".into()));
    }
    Ok(())
}

#[derive(Deserialize)]
pub struct ListQuery {
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub q: Option<String>,
    pub role: Option<String>,
    pub status: Option<String>,
}

// ── STATS ─────────────────────────────────────────────────────────────────────

pub async fn get_platform_stats(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
) -> AppResult<Json<Value>> {
    require_admin(&claims)?;

    #[derive(sqlx::FromRow)]
    struct RoleCount {
        role: String,
        count: i64,
    }
    let role_rows: Vec<RoleCount> =
        sqlx::query_as("SELECT role, COUNT(*) AS count FROM users GROUP BY role")
            .fetch_all(&state.db)
            .await?;

    let total_users = role_rows.iter().map(|r| r.count).sum::<i64>();
    let total_instructors = role_rows
        .iter()
        .find(|r| r.role == "instructor")
        .map(|r| r.count)
        .unwrap_or(0);
    let total_students = role_rows
        .iter()
        .find(|r| r.role == "user")
        .map(|r| r.count)
        .unwrap_or(0);

    let (banned_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users WHERE is_banned=1")
        .fetch_one(&state.db)
        .await?;
    let (new_users_30d,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL 30 DAY")
            .fetch_one(&state.db)
            .await?;
    let (total_courses,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM courses")
        .fetch_one(&state.db)
        .await?;
    let (total_orders,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM orders WHERE status='paid'")
        .fetch_one(&state.db)
        .await?;
    let (orders_30d,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM orders WHERE status='paid' AND created_at >= NOW() - INTERVAL 30 DAY",
    )
    .fetch_one(&state.db)
    .await?;

    let (gross_rev,): (Option<bigdecimal::BigDecimal>,) = sqlx::query_as(
        "SELECT CAST(SUM(final_amount) AS DECIMAL(14,2)) FROM orders WHERE status='paid'",
    )
    .fetch_one(&state.db)
    .await?;
    let gross = gross_rev.and_then(|v| v.to_f64()).unwrap_or(0.0);

    let (rev_30d,): (Option<bigdecimal::BigDecimal>,) = sqlx::query_as("SELECT CAST(SUM(final_amount) AS DECIMAL(14,2)) FROM orders WHERE status='paid' AND created_at >= NOW() - INTERVAL 30 DAY").fetch_one(&state.db).await?;

    #[derive(sqlx::FromRow)]
    struct MonthRow {
        month: String,
        revenue: bigdecimal::BigDecimal,
        orders: i64,
    }
    let monthly: Vec<MonthRow> = sqlx::query_as(
        "SELECT DATE_FORMAT(created_at,'%Y-%m') AS month, CAST(SUM(final_amount) AS DECIMAL(14,2)) AS revenue, COUNT(*) AS orders FROM orders WHERE status='paid' AND created_at >= NOW() - INTERVAL 6 MONTH GROUP BY month ORDER BY month ASC"
    ).fetch_all(&state.db).await?;

    let (pending_w,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM withdrawal_requests WHERE status='pending'")
            .fetch_one(&state.db)
            .await?;
    let (pending_amt,): (Option<bigdecimal::BigDecimal>,) = sqlx::query_as(
        "SELECT CAST(SUM(amount) AS DECIMAL(14,2)) FROM withdrawal_requests WHERE status='pending'",
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(json!({
        "users": { "total": total_users, "instructors": total_instructors, "students": total_students, "banned": banned_count, "new30d": new_users_30d },
        "courses": total_courses,
        "orders": { "total": total_orders, "new30d": orders_30d },
        "revenue": {
            "gross": gross, "platform": gross * 0.30,
            "last30d": rev_30d.and_then(|v| v.to_f64()).unwrap_or(0.0),
            "monthly": monthly.iter().map(|m| json!({ "month": m.month, "revenue": m.revenue.to_f64().unwrap_or(0.0), "orders": m.orders })).collect::<Vec<_>>(),
        },
        "withdrawals": { "pending": pending_w, "pendingAmount": pending_amt.and_then(|v| v.to_f64()).unwrap_or(0.0) },
    })))
}

// ── USERS ─────────────────────────────────────────────────────────────────────

pub async fn list_users(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Query(p): Query<ListQuery>,
) -> AppResult<Json<Value>> {
    require_admin(&claims)?;

    let page = p.page.unwrap_or(1).max(1);
    let limit = p.limit.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * limit;

    let search = match p.q.as_deref() {
        Some(q) if !q.trim().is_empty() => format!(
            "AND (name LIKE '%{}%' OR email LIKE '%{}%')",
            q.trim(),
            q.trim()
        ),
        _ => String::new(),
    };
    let role_f = match p.role.as_deref() {
        Some(r) if r != "all" && ["instructor", "user", "admin"].contains(&r) => {
            format!("AND role='{}'", r)
        }
        _ => String::new(),
    };

    let wc = format!("1=1 {} {}", search, role_f);
    let (total,): (i64,) = sqlx::query_as(&format!("SELECT COUNT(*) FROM users WHERE {}", wc))
        .fetch_one(&state.db)
        .await?;

    #[derive(sqlx::FromRow)]
    struct UserRow {
        id: String,
        email: String,
        name: String,
        role: String,
        status: String,
        is_banned: i8,
        ban_reason: Option<String>,
        created_at: chrono::NaiveDateTime,
    }

    let rows: Vec<UserRow> = sqlx::query_as(&format!(
        "SELECT id, email, name, role, status, is_banned, ban_reason, created_at FROM users WHERE {} ORDER BY created_at DESC LIMIT {} OFFSET {}", wc, limit, offset
    )).fetch_all(&state.db).await?;

    Ok(Json(json!({
        "users": rows.iter().map(|u| json!({
            "id": u.id, "email": u.email, "name": u.name, "role": u.role,
            "status": u.status, "isBanned": u.is_banned==1, "banReason": u.ban_reason,
            "createdAt": u.created_at.format("%Y-%m-%d %H:%M").to_string(),
        })).collect::<Vec<_>>(),
        "total": total, "page": page,
        "totalPages": (total as f64 / limit as f64).ceil() as i64,
    })))
}

#[derive(Deserialize)]
pub struct ChangeRoleBody {
    pub role: String,
}
#[derive(Deserialize)]
pub struct BanBody {
    pub reason: Option<String>,
}

pub async fn change_user_role(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Path(uid): Path<String>,
    Json(body): Json<ChangeRoleBody>,
) -> AppResult<Json<Value>> {
    require_admin(&claims)?;
    if uid == claims.sub {
        return Err(AppError::Validation("Cannot change own role".into()));
    }
    if !["instructor", "user", "admin"].contains(&body.role.as_str()) {
        return Err(AppError::Validation("Invalid role".into()));
    }
    sqlx::query("UPDATE users SET role=? WHERE id=?")
        .bind(&body.role)
        .bind(&uid)
        .execute(&state.db)
        .await?;
    Ok(Json(json!({ "message": "Role updated" })))
}

pub async fn ban_user(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Path(uid): Path<String>,
    Json(body): Json<BanBody>,
) -> AppResult<Json<Value>> {
    require_admin(&claims)?;
    if uid == claims.sub {
        return Err(AppError::Validation("Cannot ban yourself".into()));
    }
    sqlx::query("UPDATE users SET is_banned=1, ban_reason=? WHERE id=? AND role!='admin'")
        .bind(&body.reason)
        .bind(&uid)
        .execute(&state.db)
        .await?;
    Ok(Json(json!({ "message": "User banned" })))
}

pub async fn unban_user(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Path(uid): Path<String>,
) -> AppResult<Json<Value>> {
    require_admin(&claims)?;
    sqlx::query("UPDATE users SET is_banned=0, ban_reason=NULL WHERE id=?")
        .bind(&uid)
        .execute(&state.db)
        .await?;
    Ok(Json(json!({ "message": "User unbanned" })))
}

pub async fn delete_user(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Path(uid): Path<String>,
) -> AppResult<StatusCode> {
    require_admin(&claims)?;
    if uid == claims.sub {
        return Err(AppError::Validation("Cannot delete yourself".into()));
    }
    sqlx::query("DELETE FROM users WHERE id=? AND role!='admin'")
        .bind(&uid)
        .execute(&state.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── COURSES ───────────────────────────────────────────────────────────────────

pub async fn list_courses(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Query(p): Query<ListQuery>,
) -> AppResult<Json<Value>> {
    require_admin(&claims)?;

    let page = p.page.unwrap_or(1).max(1);
    let limit = p.limit.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * limit;
    let search = match p.q.as_deref() {
        Some(q) if !q.trim().is_empty() => format!(
            "AND (c.title LIKE '%{}%' OR c.category LIKE '%{}%' OR u.name LIKE '%{}%')",
            q.trim(),
            q.trim(),
            q.trim()
        ),
        _ => String::new(),
    };

    let (total,): (i64,) = sqlx::query_as(&format!(
        "SELECT COUNT(*) FROM courses c LEFT JOIN users u ON u.id=c.instructor_id WHERE 1=1 {}",
        search
    ))
    .fetch_one(&state.db)
    .await?;

    #[derive(sqlx::FromRow)]
    struct CourseRow {
        id: String,
        title: String,
        category: String,
        level: String,
        price: bigdecimal::BigDecimal,
        instructor_name: Option<String>,
        student_count: i64,
        revenue: Option<bigdecimal::BigDecimal>,
        created_at: chrono::NaiveDateTime,
    }

    let rows: Vec<CourseRow> = sqlx::query_as(&format!(
        "SELECT c.id, c.title, c.category, c.level, c.price, u.name AS instructor_name, COUNT(DISTINCT oi.id) AS student_count, CAST(SUM(oi.price) AS DECIMAL(14,2)) AS revenue, c.created_at FROM courses c LEFT JOIN users u ON u.id=c.instructor_id LEFT JOIN order_items oi ON oi.course_id=c.id LEFT JOIN orders o ON o.id=oi.order_id AND o.status='paid' WHERE 1=1 {} GROUP BY c.id ORDER BY c.created_at DESC LIMIT {} OFFSET {}", search, limit, offset
    )).fetch_all(&state.db).await?;

    Ok(Json(json!({
        "courses": rows.iter().map(|c| json!({ "id": c.id, "title": c.title, "category": c.category, "level": c.level, "price": c.price.to_f64().unwrap_or(0.0), "instructorName": c.instructor_name, "studentCount": c.student_count, "revenue": c.revenue.as_ref().and_then(|v| v.to_f64()).unwrap_or(0.0), "createdAt": c.created_at.format("%Y-%m-%d").to_string() })).collect::<Vec<_>>(),
        "total": total, "page": page,
        "totalPages": (total as f64 / limit as f64).ceil() as i64,
    })))
}

pub async fn delete_course(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Path(cid): Path<String>,
) -> AppResult<StatusCode> {
    require_admin(&claims)?;
    sqlx::query("DELETE FROM courses WHERE id=?")
        .bind(&cid)
        .execute(&state.db)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── WITHDRAWALS ───────────────────────────────────────────────────────────────

pub async fn list_withdrawals(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Query(p): Query<ListQuery>,
) -> AppResult<Json<Value>> {
    require_admin(&claims)?;

    let page = p.page.unwrap_or(1).max(1);
    let limit = p.limit.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * limit;
    let status_f = match p.status.as_deref() {
        Some(s) if s != "all" && !s.is_empty() => format!("AND wr.status='{}'", s),
        _ => String::new(),
    };

    let (total,): (i64,) = sqlx::query_as(&format!(
        "SELECT COUNT(*) FROM withdrawal_requests wr WHERE 1=1 {}",
        status_f
    ))
    .fetch_one(&state.db)
    .await?;

    #[derive(sqlx::FromRow)]
    struct WRow {
        id: String,
        instructor_id: String,
        instructor_name: Option<String>,
        instructor_email: Option<String>,
        amount: bigdecimal::BigDecimal,
        platform_fee: bigdecimal::BigDecimal,
        net_amount: bigdecimal::BigDecimal,
        status: String,
        note: Option<String>,
        bank_snapshot: String,
        created_at: chrono::NaiveDateTime,
        updated_at: chrono::NaiveDateTime,
    }

    let rows: Vec<WRow> = sqlx::query_as(&format!(
    "SELECT wr.id, wr.instructor_id, u.name AS instructor_name, u.email AS instructor_email, wr.amount, wr.platform_fee, wr.net_amount, wr.status, wr.note, CAST(wr.bank_snapshot AS CHAR) AS bank_snapshot, wr.created_at, wr.updated_at FROM withdrawal_requests wr JOIN users u ON u.id=wr.instructor_id WHERE 1=1 {} ORDER BY wr.created_at DESC LIMIT {} OFFSET {}", status_f, limit, offset
)).fetch_all(&state.db).await?;

    Ok(Json(json!({
        "requests": rows.iter().map(|r| { let snap: Value = serde_json::from_str(&r.bank_snapshot).unwrap_or(Value::Null); json!({ "id": r.id, "instructorId": r.instructor_id, "instructorName": r.instructor_name, "instructorEmail": r.instructor_email, "amount": r.amount.to_f64().unwrap_or(0.0), "platformFee": r.platform_fee.to_f64().unwrap_or(0.0), "netAmount": r.net_amount.to_f64().unwrap_or(0.0), "status": r.status, "note": r.note, "bankSnapshot": snap, "createdAt": r.created_at.format("%Y-%m-%d %H:%M").to_string(), "updatedAt": r.updated_at.format("%Y-%m-%d %H:%M").to_string() }) }).collect::<Vec<_>>(),
        "total": total, "page": page,
        "totalPages": (total as f64 / limit as f64).ceil() as i64,
    })))
}

#[derive(Deserialize)]
pub struct ReviewBody {
    pub note: Option<String>,
}

pub async fn approve_withdrawal(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Path(id): Path<String>,
    Json(body): Json<ReviewBody>,
) -> AppResult<Json<Value>> {
    require_admin(&claims)?;
    let (status, instructor_id): (String, String) =
        sqlx::query_as("SELECT status, instructor_id FROM withdrawal_requests WHERE id=?")
            .bind(&id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Not found".into()))?;
    if status != "pending" {
        return Err(AppError::Validation("Not pending".into()));
    }
    sqlx::query(
        "UPDATE withdrawal_requests SET status='approved', note=?, updated_at=NOW() WHERE id=?",
    )
    .bind(&body.note)
    .bind(&id)
    .execute(&state.db)
    .await?;
    let nid = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO notifications (id,user_id,type,title,body) VALUES (?,?,'system',?,?)")
        .bind(&nid)
        .bind(&instructor_id)
        .bind("Withdrawal Approved ✅")
        .bind(
            body.note
                .as_deref()
                .unwrap_or("Your withdrawal has been approved. Funds will be transferred shortly."),
        )
        .execute(&state.db)
        .await?;
    Ok(Json(json!({ "message": "Approved — instructor notified" })))
}

pub async fn reject_withdrawal(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Path(id): Path<String>,
    Json(body): Json<ReviewBody>,
) -> AppResult<Json<Value>> {
    require_admin(&claims)?;
    let (status, instructor_id): (String, String) =
        sqlx::query_as("SELECT status, instructor_id FROM withdrawal_requests WHERE id=?")
            .bind(&id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Not found".into()))?;
    if status != "pending" {
        return Err(AppError::Validation("Not pending".into()));
    }
    sqlx::query(
        "UPDATE withdrawal_requests SET status='rejected', note=?, updated_at=NOW() WHERE id=?",
    )
    .bind(&body.note)
    .bind(&id)
    .execute(&state.db)
    .await?;
    let nid = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO notifications (id,user_id,type,title,body) VALUES (?,?,'system',?,?)")
        .bind(&nid)
        .bind(&instructor_id)
        .bind("Withdrawal Rejected ❌")
        .bind(
            body.note
                .as_deref()
                .unwrap_or("Your withdrawal request was rejected. Please contact support."),
        )
        .execute(&state.db)
        .await?;
    Ok(Json(json!({ "message": "Rejected — instructor notified" })))
}

// ── BROADCAST ─────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct BroadcastBody {
    pub title: String,
    pub body: String,
    pub link: Option<String>,
    pub target: String, // "all" | "users" | "instructors"
}

pub async fn broadcast_notification(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Json(body): Json<BroadcastBody>,
) -> AppResult<Json<Value>> {
    require_admin(&claims)?;
    if body.title.trim().is_empty() {
        return Err(AppError::Validation("Title required".into()));
    }
    if body.body.trim().is_empty() {
        return Err(AppError::Validation("Body required".into()));
    }

    let role_filter = match body.target.as_str() {
        "users" => "AND role='user'",
        "instructors" => "AND role='instructor'",
        _ => "",
    };

    let user_ids: Vec<(String,)> = sqlx::query_as(&format!(
        "SELECT id FROM users WHERE role!='admin' {}",
        role_filter
    ))
    .fetch_all(&state.db)
    .await?;

    let count = user_ids.len() as i64;
    if count == 0 {
        return Ok(Json(json!({ "message": "No users matched", "sent": 0 })));
    }

    // Batch insert
    let parts: Vec<String> = user_ids
        .iter()
        .map(|(uid,)| {
            let nid = Uuid::new_v4().to_string();
            let link_val = match &body.link {
                Some(l) if !l.is_empty() => format!("'{}'", l.replace('\'', "\\'")),
                _ => "NULL".to_string(),
            };
            format!(
                "('{}','{}','broadcast','{}','{}',{})",
                nid,
                uid,
                body.title.trim().replace('\'', "\\'"),
                body.body.trim().replace('\'', "\\'"),
                link_val
            )
        })
        .collect();

    sqlx::query(&format!(
        "INSERT INTO notifications (id,user_id,type,title,body,link) VALUES {}",
        parts.join(",")
    ))
    .execute(&state.db)
    .await?;

    Ok(Json(
        json!({ "message": format!("Broadcast sent to {} users", count), "sent": count, "target": body.target }),
    ))
}

pub async fn list_broadcasts(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
) -> AppResult<Json<Value>> {
    require_admin(&claims)?;

    #[derive(sqlx::FromRow)]
    struct BRow {
        title: String,
        body: String,
        link: Option<String>,
        recipient_count: i64,
        created_at: chrono::NaiveDateTime,
    }

    let rows: Vec<BRow> = sqlx::query_as(
        "SELECT title, body, link, COUNT(DISTINCT user_id) AS recipient_count, MIN(created_at) AS created_at FROM notifications WHERE type='broadcast' GROUP BY title, body, link ORDER BY created_at DESC LIMIT 30"
    ).fetch_all(&state.db).await?;

    Ok(Json(
        json!({ "broadcasts": rows.iter().map(|r| json!({ "title": r.title, "body": r.body, "link": r.link, "recipientCount": r.recipient_count, "sentAt": r.created_at.format("%Y-%m-%d %H:%M").to_string() })).collect::<Vec<_>>() }),
    ))
}
