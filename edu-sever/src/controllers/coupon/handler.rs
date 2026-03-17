use axum::{
    Json, body,
    extract::{Multipart, Path, State},
    http::StatusCode,
};
use bigdecimal::ToPrimitive;
use serde::{Deserialize, de::value};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{models::{coupon::ConfirmCouponRequest, course_instruction::CreateCourseInstructionRequest}, utils};
use crate::models::{cart::AddToCartRequest, coupon::ApplyCouponRequest};
use crate::state::AppState;
use crate::{
    errors::{AppError, AppResult},
    state,
};

pub async fn apply_coupon(
    State(state): State<AppState>,
    Json(body): Json<ApplyCouponRequest>,
) -> AppResult<Json<Value>> {
    use chrono::Utc;

    // ── 1. Tìm coupon ──────────────────────────────────────────────────────────
    #[derive(sqlx::FromRow)]
    struct CouponRow {
        id: String,
        r#type: String,
        value: bigdecimal::BigDecimal,
        total_limit: i32,
        per_user_limit: i32,
        min_order: bigdecimal::BigDecimal,
        max_discount: Option<bigdecimal::BigDecimal>,
        is_active: i8,
        expires_at: Option<chrono::NaiveDateTime>,
    }

    let coupon: Option<CouponRow> = sqlx::query_as(
        r#"SELECT id, type, value, total_limit, per_user_limit,
                  min_order, max_discount, is_active, expires_at
           FROM coupons
           WHERE UPPER(code) = UPPER(?)"#,
    )
    .bind(&body.code)
    .fetch_optional(&state.db)
    .await?;

    let c = coupon.ok_or_else(|| AppError::NotFound("Mã giảm giá không tồn tại.".into()))?;

    // ── 2. Kiểm tra trạng thái mã ─────────────────────────────────────────────
    if c.is_active == 0 {
        return Err(AppError::Validation(
            "Mã giảm giá đã bị vô hiệu hóa.".into(),
        ));
    }
    if let Some(exp) = c.expires_at {
        if exp < Utc::now().naive_utc() {
            return Err(AppError::Validation("Mã giảm giá đã hết hạn.".into()));
        }
    }

    // ── 3. Kiểm tra tổng lượt dùng toàn hệ thống ─────────────────────────────
    let (total_used,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM coupon_usages WHERE coupon_id = ?")
            .bind(&c.id)
            .fetch_one(&state.db)
            .await?;

    if total_used >= c.total_limit as i64 {
        return Err(AppError::Validation(
            "Mã giảm giá đã hết lượt sử dụng.".into(),
        ));
    }

    // ── 4. Kiểm tra per_user_limit: user này đã dùng mã này bao nhiêu lần? ───
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

    // ── 5. Kiểm tra đơn tối thiểu ─────────────────────────────────────────────
    let min_order = c.min_order.to_f64().unwrap_or(0.0);
    if body.order_total < min_order {
        return Err(AppError::Validation(format!(
            "Đơn hàng tối thiểu {} ₫ mới được dùng mã này.",
            utils::format_vnd(min_order)
        )));
    }

    // ── 6. Tính số tiền giảm ──────────────────────────────────────────────────
    let coupon_value = c.value.to_f64().unwrap_or(0.0);
    let discount = if c.r#type == "percent" {
        let raw = body.order_total * coupon_value / 100.0;
        if let Some(max) = &c.max_discount {
            raw.min(max.to_f64().unwrap_or(f64::MAX))
        } else {
            raw
        }
    } else {
        coupon_value.min(body.order_total)
    };

    let final_total = (body.order_total - discount).max(0.0);

    // Trả về coupon_id để frontend dùng khi confirm
    Ok(Json(json!({
        "message":     "Áp dụng mã giảm giá thành công!",
        "couponId":    c.id,
        "coupon": {
            "code":  body.code.to_uppercase(),
            "type":  c.r#type,
            "value": coupon_value,
        },
        "discount":   discount,
        "finalTotal": final_total,
        "orderTotal": body.order_total,
        // Thông tin lượt dùng để hiển thị cho user
        "usageInfo": {
            "userUsed":    user_used,
            "perUserLimit": c.per_user_limit,
            "remaining":   c.per_user_limit as i64 - user_used - 1,
        }
    })))
}


pub async fn confirm_coupon(
    State(state): State<AppState>,
    Json(body): Json<ConfirmCouponRequest>,
) -> AppResult<Json<Value>> {
    // Kiểm tra coupon còn tồn tại và active
    let exists: Option<(String,)> =
        sqlx::query_as("SELECT id FROM coupons WHERE id = ? AND is_active = 1")
            .bind(&body.coupon_id)
            .fetch_optional(&state.db)
            .await?;

    exists.ok_or_else(|| AppError::NotFound("Coupon không hợp lệ.".into()))?;

    // Ghi lịch sử sử dụng
    let usage_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO coupon_usages (id, coupon_id, user_id, discount_amount)
         VALUES (?, ?, ?, ?)",
    )
    .bind(&usage_id)
    .bind(&body.coupon_id)
    .bind(&body.user_id)
    .bind(body.discount_amount)
    .execute(&state.db)
    .await?;

    Ok(Json(
        json!({ "message": "Coupon confirmed", "usageId": usage_id }),
    ))
}