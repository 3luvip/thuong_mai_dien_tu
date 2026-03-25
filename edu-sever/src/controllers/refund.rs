// src/controllers/refund.rs
// Chính sách hoàn tiền:
//   - Khóa học: học < 30% → hoàn 50%, 30-70% → hoàn 25%, > 70% → không hoàn
//   - Window: chỉ trong 30 ngày kể từ ngày mua
//   - Subscription: hoàn tỷ lệ theo ngày còn lại (pro min 7 ngày dùng mới hoàn)

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use bigdecimal::ToPrimitive;
use chrono::{Duration, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{errors::{AppError, AppResult}, state::AppState};

// ─── Constants ────────────────────────────────────────────────────────────────

const REFUND_WINDOW_DAYS:   i64 = 30;    // cửa sổ hoàn tiền (ngày)
const REFUND_PCT_LOW:       f64 = 0.50;  // tiến độ < 30% → hoàn 50%
const REFUND_PCT_MID:       f64 = 0.25;  // tiến độ 30-70% → hoàn 25%
const PROGRESS_THRESHOLD_LOW: f64 = 30.0;
const PROGRESS_THRESHOLD_HIGH: f64 = 70.0;
const SUB_MIN_DAYS_USED:    i64 = 3;     // phải dùng tối thiểu 3 ngày mới đủ điều kiện hoàn sub
const SUB_MIN_DAYS_REMAINING: i64 = 1;   // phải còn tối thiểu 1 ngày

// ─── Request types ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RefundRequest {
    pub user_id:       String,
    pub r#type:        String,  // "course" | "subscription"
    // Course fields
    pub order_id:      Option<String>,
    pub order_item_id: Option<String>,
    // Subscription fields
    pub membership_id: Option<String>,
    // Common
    pub reason:        String,
}

// ─── GET /refunds/eligible-courses/:user_id ───────────────────────────────────
// Trả về danh sách khóa học đã mua kèm thông tin hoàn tiền

pub async fn get_eligible_courses(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> AppResult<Json<Value>> {
    #[derive(sqlx::FromRow)]
    struct OrderItemRow {
        order_id:    String,
        item_id:     String,
        course_id:   String,
        course_title: String,
        course_path: String,
        price_paid:  bigdecimal::BigDecimal,
        purchased_at: chrono::NaiveDateTime,
    }

    let window_date = (Utc::now() - Duration::days(REFUND_WINDOW_DAYS)).naive_utc();

    // Lấy tất cả đơn hàng paid trong 30 ngày
    let items: Vec<OrderItemRow> = sqlx::query_as(
        r#"SELECT
               o.id       AS order_id,
               oi.id      AS item_id,
               oi.course_id,
               c.title    AS course_title,
               c.path     AS course_path,
               oi.price   AS price_paid,
               o.created_at AS purchased_at
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           JOIN courses c ON c.id = oi.course_id
           WHERE o.user_id = ?
             AND o.status  = 'paid'
             AND o.created_at >= ?
           ORDER BY o.created_at DESC"#,
    )
    .bind(&user_id)
    .bind(window_date)
    .fetch_all(&state.db)
    .await?;

    let mut result: Vec<Value> = Vec::new();
    let now = Utc::now().naive_utc();

    for item in &items {
        let price_paid = item.price_paid.to_f64().unwrap_or(0.0);

        // Tiến độ học
        let (total_lectures,): (i64,) = sqlx::query_as(
            r#"SELECT COUNT(l.id) FROM lectures l
               JOIN sections s ON s.id = l.section_id
               WHERE s.course_id = ?"#,
        )
        .bind(&item.course_id)
        .fetch_one(&state.db)
        .await?;

        let (completed,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM lecture_progress WHERE user_id = ? AND course_id = ? AND is_completed = 1",
        )
        .bind(&user_id)
        .bind(&item.course_id)
        .fetch_one(&state.db)
        .await?;

        let progress_pct = if total_lectures > 0 {
            (completed as f64 / total_lectures as f64) * 100.0
        } else {
            0.0
        };

        // Tính % hoàn tiền
        let (refund_pct, eligible, reason) = if progress_pct < PROGRESS_THRESHOLD_LOW {
            (REFUND_PCT_LOW, true, String::new())
        } else if progress_pct < PROGRESS_THRESHOLD_HIGH {
            (REFUND_PCT_MID, true, String::new())
        } else {
            (0.0, false, format!(
                "Đã học {}% khóa học (vượt ngưỡng 70%)",
                progress_pct.round() as i64
            ))
        };

        let days_since_purchase = (now - item.purchased_at).num_days();
        let days_remaining_in_window = REFUND_WINDOW_DAYS - days_since_purchase;

        // Kiểm tra đã có yêu cầu hoàn tiền chưa
        let (existing,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM refund_requests WHERE user_id = ? AND order_item_id = ? AND status != 'rejected'",
        )
        .bind(&user_id)
        .bind(&item.item_id)
        .fetch_one(&state.db)
        .await?;

        let (final_eligible, final_reason) = if existing > 0 {
            (false, "Đã có yêu cầu hoàn tiền cho khóa học này.".to_string())
        } else if !eligible {
            (false, reason)
        } else if days_remaining_in_window <= 0 {
            (false, format!("Quá thời hạn {REFUND_WINDOW_DAYS} ngày để yêu cầu hoàn tiền."))
        } else {
            (true, String::new())
        };

        let refund_amount = if final_eligible { (price_paid * refund_pct).round() } else { 0.0 };

        result.push(json!({
            "orderId":           item.order_id,
            "orderItemId":       item.item_id,
            "courseId":          item.course_id,
            "courseTitle":       item.course_title,
            "coursePath":        item.course_path,
            "pricePaid":         price_paid,
            "purchasedAt":       item.purchased_at.format("%Y-%m-%d").to_string(),
            "progressPct":       (progress_pct * 10.0).round() / 10.0,
            "completedLectures": completed,
            "totalLectures":     total_lectures,
            "refundPct":         (refund_pct * 100.0) as i64,
            "refundAmount":      refund_amount,
            "eligibleDays":      days_remaining_in_window.max(0),
            "isEligible":        final_eligible,
            "reason":            final_reason,
        }));
    }

    Ok(Json(json!({ "courses": result })))
}

// ─── GET /refunds/subscription/:user_id ──────────────────────────────────────

pub async fn get_subscription_refund_info(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> AppResult<Json<Value>> {
    #[derive(sqlx::FromRow)]
    struct MembershipRow {
        id:            String,
        tier:          String,
        price_paid:    bigdecimal::BigDecimal,
        duration_days: i32,
        started_at:    chrono::NaiveDateTime,
        expires_at:    chrono::NaiveDateTime,
    }

    let now = Utc::now().naive_utc();

    // Lấy membership đang hoạt động gần nhất
    let membership: Option<MembershipRow> = sqlx::query_as(
        r#"SELECT id, tier, price_paid, duration_days, started_at, expires_at
           FROM memberships
           WHERE user_id = ? AND expires_at > ? AND status = 'active'
           ORDER BY started_at DESC LIMIT 1"#,
    )
    .bind(&user_id)
    .bind(now)
    .fetch_optional(&state.db)
    .await?;

    let membership = match membership {
        None => return Ok(Json(json!({ "subscription": null }))),
        Some(m) => m,
    };

    let price_paid    = membership.price_paid.to_f64().unwrap_or(0.0);
    let days_used     = (now - membership.started_at).num_days().max(0);
    let days_remaining = (membership.expires_at - now).num_days().max(0);
    let total_days    = membership.duration_days as i64;

    // Tính tiền hoàn: tỷ lệ ngày còn lại
    let refund_amount = if total_days > 0 {
        (price_paid * (days_remaining as f64 / total_days as f64)).round()
    } else { 0.0 };

    // Kiểm tra điều kiện
    let (is_eligible, reason) = if days_used < SUB_MIN_DAYS_USED {
        (false, format!("Phải sử dụng ít nhất {SUB_MIN_DAYS_USED} ngày trước khi yêu cầu hoàn tiền."))
    } else if days_remaining < SUB_MIN_DAYS_REMAINING {
        (false, "Không còn đủ ngày để hoàn tiền.".to_string())
    } else {
        // Kiểm tra đã có yêu cầu chưa
        let (existing,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM refund_requests WHERE user_id = ? AND membership_id = ? AND status != 'rejected'",
        )
        .bind(&user_id)
        .bind(&membership.id)
        .fetch_one(&state.db)
        .await?;

        if existing > 0 {
            (false, "Đã có yêu cầu hoàn tiền cho gói membership này.".to_string())
        } else {
            (true, String::new())
        }
    };

    Ok(Json(json!({ "subscription": {
        "membershipId":   membership.id,
        "tier":           membership.tier,
        "pricePaid":      price_paid,
        "startedAt":      membership.started_at.format("%Y-%m-%d").to_string(),
        "expiresAt":      membership.expires_at.format("%Y-%m-%d").to_string(),
        "daysUsed":       days_used,
        "daysRemaining":  days_remaining,
        "totalDays":      total_days,
        "refundAmount":   refund_amount,
        "isEligible":     is_eligible,
        "reason":         reason,
    } })))
}

// ─── POST /refunds/request ────────────────────────────────────────────────────

pub async fn create_refund_request(
    State(state): State<AppState>,
    Json(body): Json<RefundRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    if body.reason.trim().is_empty() {
        return Err(AppError::Validation("Lý do hoàn tiền không được để trống".into()));
    }

    let refund_id = Uuid::new_v4().to_string();
    let now       = Utc::now().naive_utc();
    let window    = (Utc::now() - Duration::days(REFUND_WINDOW_DAYS)).naive_utc();

    match body.r#type.as_str() {
        // ── Course refund ──────────────────────────────────────────────────────
        "course" => {
            let order_id      = body.order_id.ok_or_else(|| AppError::Validation("order_id required".into()))?;
            let order_item_id = body.order_item_id.ok_or_else(|| AppError::Validation("order_item_id required".into()))?;

            // Xác minh order
            let row: Option<(bigdecimal::BigDecimal, chrono::NaiveDateTime, String)> = sqlx::query_as(
                "SELECT oi.price, o.created_at, oi.course_id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = ? AND o.user_id = ? AND o.status = 'paid'",
            )
            .bind(&order_item_id)
            .bind(&body.user_id)
            .fetch_optional(&state.db)
            .await?;

            let (price_paid, purchased_at, course_id) = row
                .ok_or_else(|| AppError::NotFound("Không tìm thấy đơn hàng.".into()))?;

            // Kiểm tra window
            if purchased_at < window {
                return Err(AppError::Validation(format!("Quá {REFUND_WINDOW_DAYS} ngày kể từ khi mua.")));
            }

            // Kiểm tra duplicate
            let (dup,): (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM refund_requests WHERE user_id = ? AND order_item_id = ? AND status != 'rejected'",
            )
            .bind(&body.user_id)
            .bind(&order_item_id)
            .fetch_one(&state.db)
            .await?;
            if dup > 0 {
                return Err(AppError::Validation("Đã có yêu cầu hoàn tiền cho khóa học này.".into()));
            }

            // Tính tiến độ
            let (total,): (i64,) = sqlx::query_as(
                "SELECT COUNT(l.id) FROM lectures l JOIN sections s ON s.id = l.section_id WHERE s.course_id = ?",
            ).bind(&course_id).fetch_one(&state.db).await?;

            let (done,): (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM lecture_progress WHERE user_id = ? AND course_id = ? AND is_completed = 1",
            ).bind(&body.user_id).bind(&course_id).fetch_one(&state.db).await?;

            let progress = if total > 0 { (done as f64 / total as f64) * 100.0 } else { 0.0 };

            let refund_pct = if progress < PROGRESS_THRESHOLD_LOW { REFUND_PCT_LOW }
                else if progress < PROGRESS_THRESHOLD_HIGH { REFUND_PCT_MID }
                else { return Err(AppError::Validation(format!("Đã học {}% — không đủ điều kiện hoàn tiền.", progress.round()))); };

            let price = price_paid.to_f64().unwrap_or(0.0);
            let refund_amount = (price * refund_pct).round();

            sqlx::query(
                r#"INSERT INTO refund_requests
                   (id, user_id, type, order_id, order_item_id, amount, reason, status, created_at)
                   VALUES (?, ?, 'course', ?, ?, ?, ?, 'pending', ?)"#,
            )
            .bind(&refund_id)
            .bind(&body.user_id)
            .bind(&order_id)
            .bind(&order_item_id)
            .bind(refund_amount)
            .bind(body.reason.trim())
            .bind(now)
            .execute(&state.db)
            .await?;

            // Notification
            let nid = Uuid::new_v4().to_string();
            let _ = sqlx::query(
                "INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?, ?, 'system', ?, ?, ?)",
            )
            .bind(&nid)
            .bind(&body.user_id)
            .bind("📩 Yêu cầu hoàn tiền đã được ghi nhận")
            .bind(format!("Yêu cầu hoàn {} ₫ đang được xem xét. Chúng tôi sẽ phản hồi trong 1–3 ngày làm việc.",
                crate::utils::format_vnd(refund_amount)))
            .bind("/refunds")
            .execute(&state.db)
            .await;

            Ok((StatusCode::CREATED, Json(json!({
                "message":      "Yêu cầu hoàn tiền đã được ghi nhận!",
                "refundId":     refund_id,
                "refundAmount": refund_amount,
                "status":       "pending",
            }))))
        }

        // ── Subscription refund ────────────────────────────────────────────────
        "subscription" => {
            let membership_id = body.membership_id
                .ok_or_else(|| AppError::Validation("membership_id required".into()))?;

            #[derive(sqlx::FromRow)]
            struct MemRow {
                id:            String,
                tier:          String,
                price_paid:    bigdecimal::BigDecimal,
                duration_days: i32,
                started_at:    chrono::NaiveDateTime,
                expires_at:    chrono::NaiveDateTime,
            }

            let mem: MemRow = sqlx::query_as(
                "SELECT id, tier, price_paid, duration_days, started_at, expires_at FROM memberships WHERE id = ? AND user_id = ? AND status = 'active'",
            )
            .bind(&membership_id)
            .bind(&body.user_id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Không tìm thấy membership đang hoạt động.".into()))?;

            let days_used      = (now - mem.started_at).num_days().max(0);
            let days_remaining = (mem.expires_at - now).num_days().max(0);

            if days_used < SUB_MIN_DAYS_USED {
                return Err(AppError::Validation(format!(
                    "Phải sử dụng ít nhất {SUB_MIN_DAYS_USED} ngày trước khi yêu cầu hoàn tiền (đã dùng {days_used} ngày)."
                )));
            }
            if days_remaining < SUB_MIN_DAYS_REMAINING {
                return Err(AppError::Validation("Không còn đủ ngày để hoàn tiền.".into()));
            }

            let (dup,): (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM refund_requests WHERE user_id = ? AND membership_id = ? AND status != 'rejected'",
            )
            .bind(&body.user_id)
            .bind(&membership_id)
            .fetch_one(&state.db)
            .await?;
            if dup > 0 {
                return Err(AppError::Validation("Đã có yêu cầu hoàn tiền cho gói membership này.".into()));
            }

            let price      = mem.price_paid.to_f64().unwrap_or(0.0);
            let total_days = mem.duration_days as f64;
            let refund_amt = (price * (days_remaining as f64 / total_days)).round();

            sqlx::query(
                r#"INSERT INTO refund_requests
                   (id, user_id, type, membership_id, amount, reason, status, created_at)
                   VALUES (?, ?, 'subscription', ?, ?, ?, 'pending', ?)"#,
            )
            .bind(&refund_id)
            .bind(&body.user_id)
            .bind(&membership_id)
            .bind(refund_amt)
            .bind(body.reason.trim())
            .bind(now)
            .execute(&state.db)
            .await?;

            // Freeze membership (đánh dấu hủy chờ admin duyệt)
            sqlx::query("UPDATE memberships SET status = 'cancelled' WHERE id = ?")
                .bind(&membership_id)
                .execute(&state.db)
                .await?;

            let nid = Uuid::new_v4().to_string();
            let _ = sqlx::query(
                "INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?, ?, 'system', ?, ?, ?)",
            )
            .bind(&nid)
            .bind(&body.user_id)
            .bind("📩 Yêu cầu hủy Membership đã được ghi nhận")
            .bind(format!(
                "Yêu cầu hoàn {} ₫ ({} ngày còn lại) đang được xem xét.",
                crate::utils::format_vnd(refund_amt), days_remaining
            ))
            .bind("/refunds")
            .execute(&state.db)
            .await;

            Ok((StatusCode::CREATED, Json(json!({
                "message":      "Yêu cầu hủy membership và hoàn tiền đã được ghi nhận!",
                "refundId":     refund_id,
                "refundAmount": refund_amt,
                "daysRefunded": days_remaining,
                "status":       "pending",
            }))))
        }

        _ => Err(AppError::Validation("type phải là 'course' hoặc 'subscription'".into())),
    }
}

// ─── GET /refunds/history/:user_id ───────────────────────────────────────────

pub async fn get_refund_history(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> AppResult<Json<Value>> {
    #[derive(sqlx::FromRow)]
    struct HistRow {
        id:          String,
        r#type:      String,
        course_title: Option<String>,
        tier:        Option<String>,
        amount:      bigdecimal::BigDecimal,
        status:      String,
        reason:      String,
        admin_note:  Option<String>,
        created_at:  chrono::NaiveDateTime,
    }

    let rows: Vec<HistRow> = sqlx::query_as(
        r#"SELECT
               r.id,
               r.type,
               c.title AS course_title,
               m.tier,
               r.amount,
               r.status,
               r.reason,
               r.admin_note,
               r.created_at
           FROM refund_requests r
           LEFT JOIN order_items oi ON oi.id = r.order_item_id
           LEFT JOIN courses c      ON c.id  = oi.course_id
           LEFT JOIN memberships m  ON m.id  = r.membership_id
           WHERE r.user_id = ?
           ORDER BY r.created_at DESC
           LIMIT 30"#,
    )
    .bind(&user_id)
    .fetch_all(&state.db)
    .await?;

    let requests: Vec<Value> = rows.into_iter().map(|r| json!({
        "id":          r.id,
        "type":        r.r#type,
        "courseTitle": r.course_title,
        "tier":        r.tier,
        "amount":      r.amount.to_f64().unwrap_or(0.0),
        "status":      r.status,
        "reason":      r.reason,
        "adminNote":   r.admin_note,
        "createdAt":   r.created_at.format("%Y-%m-%d %H:%M").to_string(),
    })).collect();

    Ok(Json(json!({ "requests": requests })))
}

// ─── Admin: GET /refunds/admin/requests ──────────────────────────────────────

pub async fn admin_list_refunds(
    State(state): State<AppState>,
) -> AppResult<Json<Value>> {
    #[derive(sqlx::FromRow)]
    struct AdminRow {
        id:           String,
        user_id:      String,
        user_name:    Option<String>,
        user_email:   Option<String>,
        r#type:       String,
        course_title: Option<String>,
        tier:         Option<String>,
        amount:       bigdecimal::BigDecimal,
        status:       String,
        reason:       String,
        admin_note:   Option<String>,
        created_at:   chrono::NaiveDateTime,
    }

    let rows: Vec<AdminRow> = sqlx::query_as(
        r#"SELECT
               r.id, r.user_id,
               u.name  AS user_name,
               u.email AS user_email,
               r.type,
               c.title AS course_title,
               m.tier,
               r.amount, r.status, r.reason, r.admin_note, r.created_at
           FROM refund_requests r
           JOIN users u ON u.id = r.user_id
           LEFT JOIN order_items oi ON oi.id = r.order_item_id
           LEFT JOIN courses c      ON c.id  = oi.course_id
           LEFT JOIN memberships m  ON m.id  = r.membership_id
           WHERE r.status = 'pending'
           ORDER BY r.created_at ASC"#,
    )
    .fetch_all(&state.db)
    .await?;

    let requests: Vec<Value> = rows.into_iter().map(|r| json!({
        "id":          r.id,
        "userId":      r.user_id,
        "userName":    r.user_name,
        "userEmail":   r.user_email,
        "type":        r.r#type,
        "courseTitle": r.course_title,
        "tier":        r.tier,
        "amount":      r.amount.to_f64().unwrap_or(0.0),
        "status":      r.status,
        "reason":      r.reason,
        "adminNote":   r.admin_note,
        "createdAt":   r.created_at.format("%Y-%m-%d %H:%M").to_string(),
    })).collect();

    Ok(Json(json!({ "requests": requests })))
}

// ─── Admin: PATCH /refunds/admin/:id/approve ─────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct AdminReviewBody {
    pub note: Option<String>,
}

pub async fn admin_approve_refund(
    State(state): State<AppState>,
    axum::extract::Path(refund_id): axum::extract::Path<String>,
    Json(body): Json<AdminReviewBody>,
) -> AppResult<Json<Value>> {
    let now = Utc::now().naive_utc();

    #[derive(sqlx::FromRow)]
    struct RefRow {
        user_id:       String,
        r#type:        String,
        amount:        bigdecimal::BigDecimal,
        membership_id: Option<String>,
        order_item_id: Option<String>,
        status:        String,
    }

    let row: RefRow = sqlx::query_as(
        "SELECT user_id, type, amount, membership_id, order_item_id, status FROM refund_requests WHERE id = ?",
    )
    .bind(&refund_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Refund request not found".into()))?;

    if row.status != "pending" {
        return Err(AppError::Validation("Yêu cầu đã được xử lý.".into()));
    }

    sqlx::query(
        "UPDATE refund_requests SET status = 'approved', admin_note = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&body.note)
    .bind(now)
    .bind(&refund_id)
    .execute(&state.db)
    .await?;

    // Nếu là subscription: cập nhật membership_tier về free
    if row.r#type == "subscription" {
        if let Some(ref mid) = row.membership_id {
            sqlx::query(
                "UPDATE users SET membership_tier = 'free', membership_expires_at = NULL WHERE id = (SELECT user_id FROM memberships WHERE id = ?)",
            )
            .bind(mid)
            .execute(&state.db)
            .await?;
        }
    }

    // Nếu là course: thu hồi quyền truy cập
    // 1. Lấy course_id từ order_item
    // 2. Xóa order_item → user không còn "paid" record → không vào /learn được
    // 3. Xóa lecture_progress của user cho course đó → reset tiến độ
    if row.r#type == "course" {
        if let Some(ref oi_id) = row.order_item_id {
            // Lấy course_id trước khi xóa
            let course_id_row: Option<(String,)> = sqlx::query_as(
                "SELECT course_id FROM order_items WHERE id = ?",
            )
            .bind(oi_id)
            .fetch_optional(&state.db)
            .await?;

            // Xóa order_item → thu hồi quyền truy cập
            let _ = sqlx::query("DELETE FROM order_items WHERE id = ?")
                .bind(oi_id)
                .execute(&state.db)
                .await;

            // Xóa lecture_progress → reset tiến độ học
            if let Some((course_id,)) = course_id_row {
                let _ = sqlx::query(
                    "DELETE FROM lecture_progress WHERE user_id = ? AND course_id = ?",
                )
                .bind(&row.user_id)
                .bind(&course_id)
                .execute(&state.db)
                .await;
            }
        }
    }

    let amount = row.amount.to_f64().unwrap_or(0.0);
    let nid    = Uuid::new_v4().to_string();
    let _ = sqlx::query(
        "INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?, ?, 'system', ?, ?, ?)",
    )
    .bind(&nid)
    .bind(&row.user_id)
    .bind("✅ Yêu cầu hoàn tiền đã được duyệt!")
    .bind(format!(
        "Số tiền {} ₫ sẽ được hoàn vào phương thức thanh toán ban đầu trong 3–5 ngày làm việc. {}",
        crate::utils::format_vnd(amount),
        body.note.as_deref().unwrap_or("")
    ))
    .bind("/refunds")
    .execute(&state.db)
    .await;

    Ok(Json(json!({ "message": "Refund approved", "refundId": refund_id, "amount": amount })))
}

// ─── Admin: PATCH /refunds/admin/:id/reject ──────────────────────────────────

pub async fn admin_reject_refund(
    State(state): State<AppState>,
    axum::extract::Path(refund_id): axum::extract::Path<String>,
    Json(body): Json<AdminReviewBody>,
) -> AppResult<Json<Value>> {
    let now = Utc::now().naive_utc();

    let row: Option<(String, String, Option<String>)> = sqlx::query_as(
        "SELECT user_id, type, membership_id FROM refund_requests WHERE id = ? AND status = 'pending'",
    )
    .bind(&refund_id)
    .fetch_optional(&state.db)
    .await?;

    let (user_id, req_type, membership_id) =
        row.ok_or_else(|| AppError::NotFound("Không tìm thấy hoặc đã xử lý.".into()))?;

    sqlx::query(
        "UPDATE refund_requests SET status = 'rejected', admin_note = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&body.note)
    .bind(now)
    .bind(&refund_id)
    .execute(&state.db)
    .await?;

    // Nếu là subscription bị reject → khôi phục membership về active
    if req_type == "subscription" {
        if let Some(mid) = membership_id {
            sqlx::query("UPDATE memberships SET status = 'active' WHERE id = ?")
                .bind(&mid)
                .execute(&state.db)
                .await?;
            // Khôi phục tier user
            let tier_row: Option<(String,)> = sqlx::query_as(
                "SELECT tier FROM memberships WHERE id = ?",
            )
            .bind(&mid)
            .fetch_optional(&state.db)
            .await?;

            if let Some((tier,)) = tier_row {
                let exp_row: Option<(chrono::NaiveDateTime,)> = sqlx::query_as(
                    "SELECT expires_at FROM memberships WHERE id = ?",
                ).bind(&mid).fetch_optional(&state.db).await?;

                if let Some((exp,)) = exp_row {
                    sqlx::query(
                        "UPDATE users SET membership_tier = ?, membership_expires_at = ? WHERE id = ?",
                    )
                    .bind(&tier)
                    .bind(exp)
                    .bind(&user_id)
                    .execute(&state.db)
                    .await?;
                }
            }
        }
    }

    let nid = Uuid::new_v4().to_string();
    let _ = sqlx::query(
        "INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?, ?, 'system', ?, ?, ?)",
    )
    .bind(&nid)
    .bind(&user_id)
    .bind("❌ Yêu cầu hoàn tiền bị từ chối")
    .bind(format!(
        "Yêu cầu của bạn không được chấp thuận. Lý do: {}",
        body.note.as_deref().unwrap_or("Không đáp ứng điều kiện hoàn tiền.")
    ))
    .bind("/refunds")
    .execute(&state.db)
    .await;

    Ok(Json(json!({ "message": "Refund rejected", "refundId": refund_id })))
}