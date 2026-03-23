// src/controllers/order/handler.rs

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use bigdecimal::ToPrimitive;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{
    errors::{AppError, AppResult},
    models::order::{CheckoutRequest, ItemRow, OrderRow},
    state::AppState,
};

// ─── Membership discount constants (sync với membership.rs) ──────────────────
const PRO_DISCOUNT_PCT:  f64 = 15.0;
const TEAM_DISCOUNT_PCT: f64 = 25.0;

// ─── POST /orders/checkout ────────────────────────────────────────────────────

pub async fn checkout(
    State(state): State<AppState>,
    Json(body): Json<CheckoutRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    if body.course_ids.is_empty() {
        return Err(AppError::Validation(
            "Không có khóa học nào để thanh toán".into(),
        ));
    }

    let placeholders = body
        .course_ids
        .iter()
        .map(|_| "?")
        .collect::<Vec<_>>()
        .join(", ");

    let direct_sql = format!("SELECT id FROM courses WHERE id IN ({placeholders})");
    let mut direct_q = sqlx::query_as::<_, (String,)>(&direct_sql);
    for id in &body.course_ids {
        direct_q = direct_q.bind(id);
    }
    let direct_rows: Vec<(String,)> = direct_q.fetch_all(&state.db).await?;
    let direct_ids: std::collections::HashSet<String> =
        direct_rows.into_iter().map(|(id,)| id).collect();

    let unresolved: Vec<&String> = body
        .course_ids
        .iter()
        .filter(|id| !direct_ids.contains(*id))
        .collect();

    let mut via_card_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    if !unresolved.is_empty() {
        let card_placeholders = unresolved
            .iter()
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(", ");
        let card_sql =
            format!("SELECT course_detail_id FROM course_cards WHERE id IN ({card_placeholders})");
        let mut card_q = sqlx::query_as::<_, (String,)>(&card_sql);
        for id in &unresolved {
            card_q = card_q.bind(id);
        }
        let card_rows: Vec<(String,)> = card_q.fetch_all(&state.db).await?;
        via_card_ids = card_rows.into_iter().map(|(id,)| id).collect();
    }

    let resolved: Vec<String> = direct_ids
        .into_iter()
        .chain(via_card_ids)
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    if resolved.is_empty() {
        return Err(AppError::Validation(
            "Không tìm thấy khóa học hợp lệ".into(),
        ));
    }

    let own_ph = resolved.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let own_sql =
        format!("SELECT COUNT(*) FROM courses WHERE id IN ({own_ph}) AND instructor_id = ?");
    let mut own_q = sqlx::query_as::<_, (i64,)>(&own_sql);
    for id in &resolved {
        own_q = own_q.bind(id);
    }
    let (own_courses,): (i64,) = own_q.bind(&body.user_id).fetch_one(&state.db).await?;
    if own_courses > 0 {
        return Err(AppError::Validation(
            "Không thể thanh toán khóa học do chính bạn giảng dạy.".into(),
        ));
    }

    // ── Membership discount (chỉ áp nếu không có coupon) ─────────────────
    let membership_discount = if body.coupon_id.is_none() {
        let row: Option<(String, Option<chrono::NaiveDateTime>)> =
            sqlx::query_as(
                "SELECT membership_tier, membership_expires_at FROM users WHERE id = ?"
            )
            .bind(&body.user_id)
            .fetch_optional(&state.db)
            .await?;

        match row {
            Some((tier, Some(exp))) if exp > chrono::Utc::now().naive_utc() => {
                match tier.as_str() {
                    "pro"  => body.total_amount * PRO_DISCOUNT_PCT / 100.0,
                    "team" => body.total_amount * TEAM_DISCOUNT_PCT / 100.0,
                    _      => 0.0,
                }
            }
            _ => 0.0,
        }
    } else {
        0.0
    };

    // Dùng mức giảm cao nhất giữa frontend gửi lên và membership tính được
    let effective_discount = body.discount_amount.max(membership_discount);
    let effective_final    = (body.total_amount - effective_discount).max(0.0);

    // ── Tạo order ─────────────────────────────────────────────────────────
    let order_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO orders
            (id, user_id, status, total_amount, discount_amount, final_amount, coupon_id)
         VALUES (?, ?, 'paid', ?, ?, ?, ?)",
    )
    .bind(&order_id)
    .bind(&body.user_id)
    .bind(body.total_amount)
    .bind(effective_discount)
    .bind(effective_final)
    .bind(&body.coupon_id)
    .execute(&state.db)
    .await?;

    // ── Lấy giá courses ───────────────────────────────────────────────────
    let price_placeholders = resolved.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let price_sql = format!("SELECT id, price FROM courses WHERE id IN ({price_placeholders})");
    let mut price_q = sqlx::query_as::<_, (String, bigdecimal::BigDecimal)>(&price_sql);
    for id in &resolved {
        price_q = price_q.bind(id);
    }
    let price_rows: Vec<(String, bigdecimal::BigDecimal)> = price_q.fetch_all(&state.db).await?;
    let price_map: std::collections::HashMap<String, f64> = price_rows
        .into_iter()
        .map(|(id, p)| (id, p.to_f64().unwrap_or(0.0)))
        .collect();

    let already_sql = format!(
        r#"SELECT DISTINCT oi.course_id
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE oi.course_id IN ({price_placeholders})
             AND o.user_id = ?
             AND o.status  = 'paid'
             AND o.id      != ?"#
    );
    let mut already_q = sqlx::query_as::<_, (String,)>(&already_sql);
    for id in &resolved {
        already_q = already_q.bind(id);
    }
    already_q = already_q.bind(&body.user_id).bind(&order_id);
    let already_rows: Vec<(String,)> = already_q.fetch_all(&state.db).await?;
    let already_bought: std::collections::HashSet<String> =
        already_rows.into_iter().map(|(id,)| id).collect();

    // ── Insert order items ────────────────────────────────────────────────
    let mut purchased_titles: Vec<String> = Vec::new();

    for course_id in &resolved {
        if already_bought.contains(course_id) {
            tracing::info!(
                "checkout: user {} đã sở hữu {}, bỏ qua",
                body.user_id,
                course_id
            );
            continue;
        }
        let price_val = price_map.get(course_id).copied().unwrap_or(0.0);
        let item_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO order_items (id, order_id, course_id, price) VALUES (?, ?, ?, ?)"
        )
        .bind(&item_id)
        .bind(&order_id)
        .bind(course_id)
        .bind(price_val)
        .execute(&state.db)
        .await?;

        if let Ok(Some((title,))) =
            sqlx::query_as::<_, (String,)>("SELECT title FROM courses WHERE id = ?")
                .bind(course_id)
                .fetch_optional(&state.db)
                .await
        {
            purchased_titles.push(title);
        }
    }

    // ── Xóa cart ──────────────────────────────────────────────────────────
    sqlx::query(
        r#"DELETE cc FROM cart_courses cc
           JOIN carts c ON c.id = cc.cart_id
           WHERE c.user_id = ?"#,
    )
    .bind(&body.user_id)
    .execute(&state.db)
    .await?;

    // ── Notification mua hàng ──────────────────────────────────────────────
    if !purchased_titles.is_empty() {
        let course_count = purchased_titles.len();
        let notif_title = if course_count == 1 {
            "🎉 Purchase successful!".to_string()
        } else {
            format!("🎉 Purchase successful — {} courses unlocked!", course_count)
        };

        let preview: Vec<&str> = purchased_titles.iter().take(3).map(|s| s.as_str()).collect();
        let notif_body = if course_count == 1 {
            format!("You now have access to \"{}\" — happy learning! 🚀", preview[0])
        } else if purchased_titles.len() <= 3 {
            format!("You now have access to: {}. Let's start learning! 🚀", preview.join(", "))
        } else {
            let others = course_count - 3;
            format!(
                "You now have access to: {} and {} more course{}. Let's start learning! 🚀",
                preview.join(", "),
                others,
                if others > 1 { "s" } else { "" }
            )
        };

        let notif_id = Uuid::new_v4().to_string();
        let _ = sqlx::query(
            r#"INSERT INTO notifications (id, user_id, type, title, body, link)
               VALUES (?, ?, 'course_added', ?, ?, ?)"#,
        )
        .bind(&notif_id)
        .bind(&body.user_id)
        .bind(&notif_title)
        .bind(&notif_body)
        .bind("/my-courses")
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::warn!(
                "checkout: failed to insert notification for user {}: {}",
                body.user_id,
                e
            );
        });
    }

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "message":          "Thanh toán thành công!",
            "orderId":          order_id,
            "membershipDiscount": membership_discount,
            "effectiveDiscount":  effective_discount,
            "effectiveFinal":     effective_final,
        })),
    ))
}

// ─── GET /orders/user/:user_id ────────────────────────────────────────────────

pub async fn get_my_orders(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> AppResult<Json<Value>> {
    let orders: Vec<OrderRow> = sqlx::query_as(
        "SELECT id, status, final_amount, created_at
         FROM orders
         WHERE user_id = ?
         ORDER BY created_at DESC",
    )
    .bind(&user_id)
    .fetch_all(&state.db)
    .await?;

    if orders.is_empty() {
        return Ok(Json(json!({ "orders": [] })));
    }

    let order_ids: Vec<&str> = orders.iter().map(|o| o.id.as_str()).collect();
    let placeholders = order_ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");

    let items_sql = format!(
        r#"SELECT oi.order_id, oi.course_id, c.title, c.filename, oi.price
           FROM order_items oi
           JOIN courses c ON c.id = oi.course_id
           WHERE oi.order_id IN ({placeholders})"#
    );

    let mut items_q = sqlx::query_as::<_, ItemRow>(&items_sql);
    for id in &order_ids {
        items_q = items_q.bind(id);
    }
    let all_items: Vec<ItemRow> = items_q.fetch_all(&state.db).await?;

    let mut items_by_order: std::collections::HashMap<&str, Vec<&ItemRow>> =
        std::collections::HashMap::new();
    for item in &all_items {
        items_by_order
            .entry(item.order_id.as_str())
            .or_default()
            .push(item);
    }

    let result: Vec<Value> = orders
        .iter()
        .map(|order| {
            let items = items_by_order
                .get(order.id.as_str())
                .map(|list| {
                    list.iter()
                        .map(|i| json!({
                            "courseId": i.course_id,
                            "title":    i.title,
                            "filename": i.filename,
                            "price":    i.price.to_f64().unwrap_or(0.0),
                        }))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();

            json!({
                "id":          order.id,
                "status":      order.status,
                "finalAmount": order.final_amount.to_f64().unwrap_or(0.0),
                "createdAt":   order.created_at.format("%Y-%m-%d %H:%M").to_string(),
                "items":       items,
            })
        })
        .collect();

    Ok(Json(json!({ "orders": result })))
}