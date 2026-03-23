
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use bigdecimal::ToPrimitive;
use chrono::Utc;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::errors::{AppError, AppResult};
use crate::middleware::auth::AuthUser;
use crate::models::coupon::{
    ApplyCouponRequest, ConfirmCouponRequest, CreateCouponRequest,
    CouponListRow, CouponRow, UpdateCouponRequest,
};
use crate::state::AppState;
use crate::utils;

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

fn coupon_row_to_json(r: &CouponListRow) -> Value {
    json!({
        "id":              r.id,
        "code":            r.code,
        "scope":           r.scope,
        "type":            r.r#type,
        "value":           r.value.to_f64().unwrap_or(0.0),
        "totalLimit":      r.total_limit,
        "perUserLimit":    r.per_user_limit,
        "minOrder":        r.min_order.to_f64().unwrap_or(0.0),
        "maxDiscount":     r.max_discount.as_ref().and_then(|v| v.to_f64()),
        "isActive":        r.is_active == 1,
        "expiresAt":       r.expires_at.map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string()),
        "createdAt":       r.created_at.format("%Y-%m-%d %H:%M").to_string(),
        "usedCount":       r.used_count,
        "createdByName":   r.created_by_name,
    })
}

async fn fetch_coupon_courses(db: &sqlx::MySqlPool, coupon_id: &str) -> Result<Vec<String>, sqlx::Error> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT course_id FROM coupon_courses WHERE coupon_id = ?"
    )
    .bind(coupon_id)
    .fetch_all(db)
    .await?;
    Ok(rows.into_iter().map(|(id,)| id).collect())
}

// ═══════════════════════════════════════════════════════════
// CREATE COUPON  (POST /coupons)
// Admin → scope=platform; Instructor → scope=instructor
// ═══════════════════════════════════════════════════════════
pub async fn create_coupon(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Json(body): Json<CreateCouponRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    // Xác định scope theo role
    let scope = match claims.role.as_str() {
        "admin"      => "platform",
        "instructor" => "instructor",
        _            => return Err(AppError::Forbidden("Chỉ admin hoặc instructor mới tạo được coupon".into())),
    };

    // Validate type
    if !["percent", "fixed"].contains(&body.r#type.as_str()) {
        return Err(AppError::Validation("type phải là 'percent' hoặc 'fixed'".into()));
    }
    if body.value <= 0.0 {
        return Err(AppError::Validation("value phải > 0".into()));
    }
    if body.r#type == "percent" && body.value > 100.0 {
        return Err(AppError::Validation("percent không được > 100".into()));
    }
    if body.code.trim().is_empty() || body.code.len() > 50 {
        return Err(AppError::Validation("code phải từ 1–50 ký tự".into()));
    }

    // Kiểm tra code trùng
    let exists: Option<(String,)> = sqlx::query_as("SELECT id FROM coupons WHERE UPPER(code)=UPPER(?)")
        .bind(body.code.trim())
        .fetch_optional(&state.db)
        .await?;
    if exists.is_some() {
        return Err(AppError::Validation("Mã coupon này đã tồn tại".into()));
    }

    // Parse expires_at
    let expires_at: Option<chrono::NaiveDateTime> = match body.expires_at.as_deref() {
        Some(s) if !s.is_empty() => {
            chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S")
                .or_else(|_| chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S"))
                .ok()
        }
        _ => None,
    };

    // Với instructor: phải cung cấp course_ids và tất cả phải là của mình
    let course_ids: Vec<String> = if scope == "instructor" {
        let ids = body.course_ids.unwrap_or_default();
        if ids.is_empty() {
            return Err(AppError::Validation("Instructor coupon phải gắn ít nhất 1 khóa học".into()));
        }
        // Kiểm tra tất cả thuộc instructor này
        let ph = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT id FROM courses WHERE id IN ({}) AND instructor_id = ?", ph
        );
        let mut q = sqlx::query_as::<_, (String,)>(&sql);
        for id in &ids { q = q.bind(id); }
        q = q.bind(&claims.sub);
        let owned: Vec<(String,)> = q.fetch_all(&state.db).await?;
        if owned.len() != ids.len() {
            return Err(AppError::Validation("Một số khóa học không thuộc về bạn".into()));
        }
        ids
    } else {
        // platform coupon không cần course_ids
        vec![]
    };

    let coupon_id = Uuid::new_v4().to_string();

    sqlx::query(
        r#"INSERT INTO coupons
            (id, code, scope, created_by_user_id, type, value, total_limit, per_user_limit,
             min_order, max_discount, is_active, expires_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,1,?)"#,
    )
    .bind(&coupon_id)
    .bind(body.code.trim().to_uppercase())
    .bind(scope)
    .bind(&claims.sub)
    .bind(&body.r#type)
    .bind(body.value)
    .bind(body.total_limit)
    .bind(body.per_user_limit)
    .bind(body.min_order)
    .bind(body.max_discount)
    .bind(expires_at)
    .execute(&state.db)
    .await?;

    // Gắn courses nếu là instructor coupon
    for cid in &course_ids {
        sqlx::query("INSERT IGNORE INTO coupon_courses (coupon_id, course_id) VALUES (?,?)")
            .bind(&coupon_id)
            .bind(cid)
            .execute(&state.db)
            .await?;
    }

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "message":  "Coupon created successfully",
            "couponId": coupon_id,
            "scope":    scope,
        })),
    ))
}

// ═══════════════════════════════════════════════════════════
// LIST COUPONS
// Admin: GET /coupons         → tất cả
// Instructor: GET /coupons/my → chỉ của mình
// ═══════════════════════════════════════════════════════════
pub async fn list_all_coupons(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
) -> AppResult<Json<Value>> {
    if claims.role != "admin" {
        return Err(AppError::Forbidden("Admin only".into()));
    }

    let rows: Vec<CouponListRow> = sqlx::query_as(
        r#"SELECT
               c.id, c.code, c.scope, c.type, c.value,
               c.total_limit, c.per_user_limit, c.min_order, c.max_discount,
               c.is_active, c.expires_at, c.created_at,
               COUNT(cu.id) AS used_count,
               u.name AS created_by_name
           FROM coupons c
           LEFT JOIN coupon_usages cu ON cu.coupon_id = c.id
           LEFT JOIN users u ON u.id = c.created_by_user_id
           GROUP BY c.id
           ORDER BY c.created_at DESC"#,
    )
    .fetch_all(&state.db)
    .await?;

    // Fetch courses gắn với mỗi coupon (instructor scope)
    let mut list: Vec<Value> = Vec::new();
    for r in &rows {
        let mut item = coupon_row_to_json(r);
        if r.scope == "instructor" {
            let courses = fetch_coupon_courses(&state.db, &r.id).await?;
            item["courseIds"] = json!(courses);
        }
        list.push(item);
    }

    Ok(Json(json!({ "coupons": list })))
}

pub async fn list_my_coupons(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
) -> AppResult<Json<Value>> {
    if claims.role != "instructor" {
        return Err(AppError::Forbidden("Instructor only".into()));
    }

    let rows: Vec<CouponListRow> = sqlx::query_as(
        r#"SELECT
               c.id, c.code, c.scope, c.type, c.value,
               c.total_limit, c.per_user_limit, c.min_order, c.max_discount,
               c.is_active, c.expires_at, c.created_at,
               COUNT(cu.id) AS used_count,
               u.name AS created_by_name
           FROM coupons c
           LEFT JOIN coupon_usages cu ON cu.coupon_id = c.id
           LEFT JOIN users u ON u.id = c.created_by_user_id
           WHERE c.created_by_user_id = ? AND c.scope = 'instructor'
           GROUP BY c.id
           ORDER BY c.created_at DESC"#,
    )
    .bind(&claims.sub)
    .fetch_all(&state.db)
    .await?;

    let mut list: Vec<Value> = Vec::new();
    for r in &rows {
        let mut item = coupon_row_to_json(r);
        let courses = fetch_coupon_courses(&state.db, &r.id).await?;
        item["courseIds"] = json!(courses);
        // Kèm thêm course titles cho UI
        let ph = courses.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        if !courses.is_empty() {
            let sql = format!("SELECT id, title FROM courses WHERE id IN ({})", ph);
            let mut q = sqlx::query_as::<_, (String, String)>(&sql);
            for id in &courses { q = q.bind(id); }
            let titles: Vec<(String, String)> = q.fetch_all(&state.db).await?;
            item["courses"] = json!(titles.into_iter().map(|(id, title)| json!({ "id": id, "title": title })).collect::<Vec<_>>());
        } else {
            item["courses"] = json!([]);
        }
        list.push(item);
    }

    Ok(Json(json!({ "coupons": list })))
}

// ═══════════════════════════════════════════════════════════
// TOGGLE ACTIVE  PATCH /coupons/:id/toggle
// ═══════════════════════════════════════════════════════════
pub async fn toggle_coupon(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Path(coupon_id): Path<String>,
) -> AppResult<Json<Value>> {
    let row: Option<(i8, String, Option<String>)> = sqlx::query_as(
        "SELECT is_active, scope, created_by_user_id FROM coupons WHERE id = ?"
    )
    .bind(&coupon_id)
    .fetch_optional(&state.db)
    .await?;

    let (is_active, scope, owner) =
        row.ok_or_else(|| AppError::NotFound("Coupon not found".into()))?;

    // Admin: quản lý tất cả. Instructor: chỉ của mình
    if claims.role == "instructor" {
        if scope != "instructor" || owner.as_deref() != Some(&claims.sub) {
            return Err(AppError::Forbidden("Không có quyền chỉnh sửa coupon này".into()));
        }
    } else if claims.role != "admin" {
        return Err(AppError::Forbidden("Forbidden".into()));
    }

    let new_state = if is_active == 1 { 0_i8 } else { 1_i8 };
    sqlx::query("UPDATE coupons SET is_active = ? WHERE id = ?")
        .bind(new_state)
        .bind(&coupon_id)
        .execute(&state.db)
        .await?;

    Ok(Json(json!({
        "message":  if new_state == 1 { "Coupon activated" } else { "Coupon deactivated" },
        "isActive": new_state == 1,
    })))
}

// ═══════════════════════════════════════════════════════════
// DELETE  DELETE /coupons/:id
// ═══════════════════════════════════════════════════════════
pub async fn delete_coupon(
    State(state): State<AppState>,
    AuthUser(claims): AuthUser,
    Path(coupon_id): Path<String>,
) -> AppResult<StatusCode> {
    let row: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT scope, created_by_user_id FROM coupons WHERE id = ?"
    )
    .bind(&coupon_id)
    .fetch_optional(&state.db)
    .await?;

    let (scope, owner) = row.ok_or_else(|| AppError::NotFound("Coupon not found".into()))?;

    if claims.role == "instructor" {
        if scope != "instructor" || owner.as_deref() != Some(&claims.sub) {
            return Err(AppError::Forbidden("Không có quyền xóa coupon này".into()));
        }
    } else if claims.role != "admin" {
        return Err(AppError::Forbidden("Forbidden".into()));
    }

    // Kiểm tra đã dùng chưa
    let (used,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM coupon_usages WHERE coupon_id = ?")
        .bind(&coupon_id)
        .fetch_one(&state.db)
        .await?;

    if used > 0 {
        return Err(AppError::Validation(
            "Không thể xóa coupon đã được sử dụng. Hãy deactivate thay vì xóa.".into(),
        ));
    }

    sqlx::query("DELETE FROM coupons WHERE id = ?")
        .bind(&coupon_id)
        .execute(&state.db)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

// ═══════════════════════════════════════════════════════════
// APPLY COUPON  (scope-aware)
// POST /courseCreation/apply-coupon
// ═══════════════════════════════════════════════════════════
pub async fn apply_coupon(
    State(state): State<AppState>,
    Json(body): Json<ApplyCouponRequest>,
) -> AppResult<Json<Value>> {
    // ── 1. Tìm coupon ────────────────────────────────────────────────────────
    let coupon: Option<CouponRow> = sqlx::query_as(
        r#"SELECT id, code, scope, created_by_user_id, type, value,
                  total_limit, per_user_limit, min_order, max_discount,
                  is_active, expires_at, created_at
           FROM coupons
           WHERE UPPER(code) = UPPER(?)"#,
    )
    .bind(&body.code)
    .fetch_optional(&state.db)
    .await?;

    let c = coupon.ok_or_else(|| AppError::NotFound("Mã giảm giá không tồn tại.".into()))?;

    // ── 2. Kiểm tra trạng thái ───────────────────────────────────────────────
    if c.is_active == 0 {
        return Err(AppError::Validation("Mã giảm giá đã bị vô hiệu hóa.".into()));
    }
    if let Some(exp) = c.expires_at {
        if exp < Utc::now().naive_utc() {
            return Err(AppError::Validation("Mã giảm giá đã hết hạn.".into()));
        }
    }

    // ── 3. Kiểm tra phạm vi (scope) ──────────────────────────────────────────
    let eligible_course_ids: Vec<String>;
    let eligible_total: f64;

    if c.scope == "instructor" {
        // Lấy danh sách course_id được gắn với coupon này
        let linked = fetch_coupon_courses(&state.db, &c.id).await?;
        if linked.is_empty() {
            return Err(AppError::Validation("Coupon này chưa được gắn với khóa học nào.".into()));
        }

        // Giao giữa linked và course_ids trong giỏ
        let matched: Vec<String> = body.course_ids.iter()
            .filter(|id| linked.contains(id))
            .cloned()
            .collect();

        if matched.is_empty() {
            return Err(AppError::Validation(
                "Mã giảm giá này không áp dụng cho các khóa học trong giỏ của bạn.".into(),
            ));
        }

        // Tính lại subtotal chỉ từ các khóa học hợp lệ
        let ph = matched.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            r#"SELECT COALESCE(SUM(
                   CASE WHEN cc.current_price IS NOT NULL AND cc.current_price < c.price
                        THEN cc.current_price
                        ELSE c.price
                   END
               ), 0)
               FROM courses c
               LEFT JOIN course_cards cc ON cc.course_detail_id = c.id
               WHERE c.id IN ({})"#,
            ph
        );
        let mut q = sqlx::query_as::<_, (bigdecimal::BigDecimal,)>(&sql);
        for id in &matched { q = q.bind(id); }
        let (subtotal,): (bigdecimal::BigDecimal,) = q.fetch_one(&state.db).await?;

        eligible_course_ids = matched;
        eligible_total       = subtotal.to_f64().unwrap_or(0.0);
    } else {
        // platform coupon: áp cho toàn bộ giỏ
        eligible_course_ids = body.course_ids.clone();
        eligible_total       = body.order_total;
    }

    // ── 4. Tổng lượt dùng toàn hệ thống ─────────────────────────────────────
    let (total_used,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM coupon_usages WHERE coupon_id = ?")
            .bind(&c.id)
            .fetch_one(&state.db)
            .await?;

    if total_used >= c.total_limit as i64 {
        return Err(AppError::Validation("Mã giảm giá đã hết lượt sử dụng.".into()));
    }

    // ── 5. Per-user limit ────────────────────────────────────────────────────
    let (user_used,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM coupon_usages WHERE coupon_id = ? AND user_id = ?")
            .bind(&c.id)
            .bind(&body.user_id)
            .fetch_one(&state.db)
            .await?;

    if user_used >= c.per_user_limit as i64 {
        return Err(AppError::Validation(if c.per_user_limit == 1 {
            "Bạn đã sử dụng mã này rồi.".into()
        } else {
            format!(
                "Bạn đã dùng mã này {} lần (tối đa {} lần).",
                user_used, c.per_user_limit
            )
        }));
    }

    // ── 6. Min order trên eligible_total ─────────────────────────────────────
    let min_order = c.min_order.to_f64().unwrap_or(0.0);
    if eligible_total < min_order {
        let scope_note = if c.scope == "instructor" {
            " (tính trên các khóa học áp dụng được)"
        } else {
            ""
        };
        return Err(AppError::Validation(format!(
            "Đơn hàng tối thiểu {} ₫{} mới được dùng mã này.",
            utils::format_vnd(min_order),
            scope_note,
        )));
    }

    // ── 7. Tính discount ─────────────────────────────────────────────────────
    let coupon_value = c.value.to_f64().unwrap_or(0.0);
    let discount = if c.r#type == "percent" {
        let raw = eligible_total * coupon_value / 100.0;
        if let Some(max) = &c.max_discount {
            raw.min(max.to_f64().unwrap_or(f64::MAX))
        } else {
            raw
        }
    } else {
        coupon_value.min(eligible_total)
    };

    // final_total = giỏ đầy đủ trừ discount trên phần eligible
    let final_total = (body.order_total - discount).max(0.0);

    Ok(Json(json!({
        "message":    "Áp dụng mã giảm giá thành công!",
        "couponId":   c.id,
        "coupon": {
            "code":  body.code.to_uppercase(),
            "scope": c.scope,
            "type":  c.r#type,
            "value": coupon_value,
        },
        "eligibleCourseIds": eligible_course_ids,
        "eligibleTotal":     eligible_total,
        "discount":          discount,
        "finalTotal":        final_total,
        "orderTotal":        body.order_total,
        "usageInfo": {
            "userUsed":     user_used,
            "perUserLimit": c.per_user_limit,
            "remaining":    c.per_user_limit as i64 - user_used - 1,
        }
    })))
}

// ═══════════════════════════════════════════════════════════
// CONFIRM COUPON  (không đổi nhiều)
// ═══════════════════════════════════════════════════════════
pub async fn confirm_coupon(
    State(state): State<AppState>,
    Json(body): Json<ConfirmCouponRequest>,
) -> AppResult<Json<Value>> {
    let exists: Option<(String,)> =
        sqlx::query_as("SELECT id FROM coupons WHERE id = ? AND is_active = 1")
            .bind(&body.coupon_id)
            .fetch_optional(&state.db)
            .await?;

    exists.ok_or_else(|| AppError::NotFound("Coupon không hợp lệ.".into()))?;

    let usage_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO coupon_usages (id, coupon_id, user_id, discount_amount) VALUES (?, ?, ?, ?)",
    )
    .bind(&usage_id)
    .bind(&body.coupon_id)
    .bind(&body.user_id)
    .bind(body.discount_amount)
    .execute(&state.db)
    .await?;

    Ok(Json(json!({ "message": "Coupon confirmed", "usageId": usage_id })))
}