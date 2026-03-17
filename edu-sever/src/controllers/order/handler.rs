use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use bigdecimal::ToPrimitive;
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{
    errors::{AppError, AppResult},
    state::AppState,
};

// ─── POST /orders/checkout ────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CheckoutRequest {
    pub user_id:         String,
    pub course_ids:      Vec<String>, // course_cards.id hoặc courses.id
    pub coupon_id:       Option<String>,
    pub total_amount:    f64,
    pub discount_amount: f64,
    pub final_amount:    f64,
}

pub async fn checkout(
    State(state): State<AppState>,
    Json(body): Json<CheckoutRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    if body.course_ids.is_empty() {
        return Err(AppError::Validation(
            "Không có khóa học nào để thanh toán".into(),
        ));
    }


    let placeholders = body.course_ids
        .iter()
        .map(|_| "?")
        .collect::<Vec<_>>()
        .join(", ");

    let direct_sql = format!(
        "SELECT id FROM courses WHERE id IN ({placeholders})"
    );
    let mut direct_q = sqlx::query_as::<_, (String,)>(&direct_sql);
    for id in &body.course_ids {
        direct_q = direct_q.bind(id);
    }
    let direct_rows: Vec<(String,)> = direct_q.fetch_all(&state.db).await?;
    let direct_ids: std::collections::HashSet<String> =
        direct_rows.into_iter().map(|(id,)| id).collect();

    let unresolved: Vec<&String> = body.course_ids
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
        let card_sql = format!(
            "SELECT course_detail_id FROM course_cards WHERE id IN ({card_placeholders})"
        );
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
        .collect::<std::collections::HashSet<_>>() // dedup
        .into_iter()
        .collect();

    if resolved.is_empty() {
        return Err(AppError::Validation(
            "Không tìm thấy khóa học hợp lệ".into(),
        ));
    }

    // ── Tạo order ────────────────────────────────────────────────────────
    let order_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO orders
            (id, user_id, status, total_amount, discount_amount, final_amount, coupon_id)
         VALUES (?, ?, 'paid', ?, ?, ?, ?)",
    )
    .bind(&order_id)
    .bind(&body.user_id)
    .bind(body.total_amount)
    .bind(body.discount_amount)
    .bind(body.final_amount)
    .bind(&body.coupon_id)
    .execute(&state.db)
    .await?;


    // Lấy giá tất cả courses trong 1 query
    let price_placeholders = resolved.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let price_sql = format!(
        "SELECT id, price FROM courses WHERE id IN ({price_placeholders})"
    );
    let mut price_q = sqlx::query_as::<_, (String, bigdecimal::BigDecimal)>(&price_sql);
    for id in &resolved {
        price_q = price_q.bind(id);
    }
    let price_rows: Vec<(String, bigdecimal::BigDecimal)> =
        price_q.fetch_all(&state.db).await?;
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


    for course_id in &resolved {
        if already_bought.contains(course_id) {
            tracing::info!("checkout: user {} đã sở hữu {}, bỏ qua", body.user_id, course_id);
            continue;
        }
        let price_val = price_map.get(course_id).copied().unwrap_or(0.0);
        let item_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO order_items (id, order_id, course_id, price) VALUES (?, ?, ?, ?)",
        )
        .bind(&item_id)
        .bind(&order_id)
        .bind(course_id)
        .bind(price_val)
        .execute(&state.db)
        .await?;
    }

    // ── Xóa cart ─────────────────────────────────────────────────────────
    sqlx::query(
        r#"DELETE cc FROM cart_courses cc
           JOIN carts c ON c.id = cc.cart_id
           WHERE c.user_id = ?"#,
    )
    .bind(&body.user_id)
    .execute(&state.db)
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "message": "Thanh toán thành công!",
            "orderId": order_id,
        })),
    ))
}

// ─── GET /orders/user/:user_id ────────────────────────────────────────────────

pub async fn get_my_orders(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> AppResult<Json<Value>> {
    // ── Bước 1: lấy tất cả orders của user ───────────────────────────────
    #[derive(sqlx::FromRow)]
    struct OrderRow {
        id:           String,
        status:       String,
        final_amount: bigdecimal::BigDecimal,
        created_at:   chrono::NaiveDateTime,
    }

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
        r#"SELECT oi.order_id, oi.course_id, c.title, c.filename,
                  oi.price
           FROM order_items oi
           JOIN courses c ON c.id = oi.course_id
           WHERE oi.order_id IN ({placeholders})"#
    );

    #[derive(sqlx::FromRow)]
    struct ItemRow {
        order_id:  String,
        course_id: String,
        title:     String,
        filename:  String,
        price:     bigdecimal::BigDecimal,
    }

    let mut items_q = sqlx::query_as::<_, ItemRow>(&items_sql);
    for id in &order_ids {
        items_q = items_q.bind(id);
    }
    let all_items: Vec<ItemRow> = items_q.fetch_all(&state.db).await?;

    // ── Bước 3: group items theo order_id bằng HashMap ───────────────────
    let mut items_by_order: std::collections::HashMap<&str, Vec<&ItemRow>> =
        std::collections::HashMap::new();
    for item in &all_items {
        items_by_order
            .entry(item.order_id.as_str())
            .or_default()
            .push(item);
    }

    // ── Bước 4: build JSON response ───────────────────────────────────────
    let result: Vec<Value> = orders
        .iter()
        .map(|order| {
            let items = items_by_order
                .get(order.id.as_str())
                .map(|list| {
                    list.iter()
                        .map(|i| {
                            json!({
                                "courseId": i.course_id,
                                "title":    i.title,
                                "filename": i.filename,
                                "price":    i.price.to_f64().unwrap_or(0.0),
                            })
                        })
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