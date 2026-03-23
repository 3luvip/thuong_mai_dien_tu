use axum::{
    Json,
    extract::{Path, State},
};
use bigdecimal::ToPrimitive;
use serde_json::{Value, json};
use uuid::Uuid;


use crate::{errors::AppError, models::cart::{AddToCartRequest, CartItemSimple, RemoveFromCartRequest}, state::AppState};
use crate::{
    errors::{AppResult},
};

use crate::models::cart::CartCourseRow;

pub async fn get_cart(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> AppResult<Json<Value>> {
    let cart: Option<(String,)> = sqlx::query_as("SELECT id FROM carts WHERE user_id = ?")
        .bind(&user_id)
        .fetch_optional(&state.db)
        .await?;

    let cart_id = match cart {
        Some((id,)) => id,
        None => return Ok(Json(json!({ "message": "Cart fetched successfully", "courses": [] }))),
    };

    let courses: Vec<CartCourseRow> = sqlx::query_as(
        r#"SELECT
               c.id,
               c.title,
               c.author,
               c.price,
               cc.current_price,
               c.level,
               c.category,
               c.path
           FROM cart_courses cc2
           JOIN courses c        ON c.id  = cc2.course_id
           LEFT JOIN course_cards cc ON cc.course_detail_id = c.id
           WHERE cc2.cart_id = ?"#,
    )
    .bind(&cart_id)
    .fetch_all(&state.db)
    .await?;

    let items: Vec<Value> = courses
        .into_iter()
        .map(|r| {
            let price = r.price.to_f64().unwrap_or(0.0);
            // Nếu current_price tồn tại và < price thì dùng, ngược lại dùng price gốc
            let current_price = r
                .current_price
                .as_ref()
                .and_then(|v| v.to_f64())
                .unwrap_or(price);

            json!({
                "id":           r.id,
                "title":        r.title,
                "author":       r.author,
                "price":        price,
                "currentPrice": current_price,   
                "level":        r.level,
                "category":     r.category,
                "path":         r.path
            })
        })
        .collect();

    Ok(Json(
        json!({ "message": "Cart fetched successfully", "courses": items }),
    ))
}



pub async fn add_to_cart(
    State(state): State<AppState>,
    Json(body): Json<AddToCartRequest>,
) -> AppResult<Json<Value>> {
    // Chuẩn hóa course_id (có thể gửi id khóa học hoặc id course_card)
    let (course_id, instructor_id): (String, String) =
        if let Some(row) =
            sqlx::query_as::<_, (String, String)>("SELECT id, instructor_id FROM courses WHERE id = ?")
                .bind(&body.course_id)
                .fetch_optional(&state.db)
                .await?
        {
            row
        } else if let Some((detail_id,)) = sqlx::query_as::<_, (String,)>(
            "SELECT course_detail_id FROM course_cards WHERE id = ?",
        )
        .bind(&body.course_id)
        .fetch_optional(&state.db)
        .await?
        {
            sqlx::query_as::<_, (String, String)>(
                "SELECT id, instructor_id FROM courses WHERE id = ?",
            )
            .bind(&detail_id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Không tìm thấy khóa học".into()))?
        } else {
            return Err(AppError::NotFound("Không tìm thấy khóa học".into()));
        };

    if instructor_id == body.user_id {
        return Err(AppError::Validation(
            "Bạn không thể thêm khóa học do chính mình giảng dạy vào giỏ hàng.".into(),
        ));
    }

    let (paid_cnt,): (i64,) = sqlx::query_as(
        r#"SELECT COUNT(*) FROM order_items oi
           INNER JOIN orders o ON o.id = oi.order_id
           WHERE oi.course_id = ? AND o.user_id = ? AND o.status = 'paid'"#,
    )
    .bind(&course_id)
    .bind(&body.user_id)
    .fetch_one(&state.db)
    .await?;

    if paid_cnt > 0 {
        return Err(AppError::Validation(
            "Bạn đã mua khóa học này rồi.".into(),
        ));
    }

    let cart: Option<(String,)> = sqlx::query_as("SELECT id FROM carts WHERE user_id = ?")
        .bind(&body.user_id)
        .fetch_optional(&state.db)
        .await?;

    let cart_id = if let Some((id,)) = cart {
        id
    } else {
        let new_id = Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO carts (id, user_id) VALUES (?, ?)")
            .bind(&new_id)
            .bind(&body.user_id)
            .execute(&state.db)
            .await?;
        new_id
    };

    let exists: Option<(String,)> =
        sqlx::query_as("SELECT cart_id FROM cart_courses WHERE cart_id = ? AND course_id = ?")
            .bind(&cart_id)
            .bind(&course_id)
            .fetch_optional(&state.db)
            .await?;

    if exists.is_some() {
        return Ok(Json(json!({ "message": "Course already in cart" })));
    }

    sqlx::query("INSERT INTO cart_courses (cart_id, course_id) VALUES (?, ?)")
        .bind(&cart_id)
        .bind(&course_id)
        .execute(&state.db)
        .await?;

    let courses: Vec<CartItemSimple> = sqlx::query_as(
        r#"SELECT c.id, c.title, c.level, c.category, c.path
        FROM cart_courses cc
        JOIN courses c ON c.id = cc.course_id
        WHERE cc.cart_id = ?"#,
    )
    .bind(&cart_id)
    .fetch_all(&state.db)
    .await?;

    let items: Vec<Value> = courses
        .into_iter()
        .map(|r| {
            json!({
                "id": r.id, "title": r.title,
                "level": r.level, "category": r.category, "path": r.path
            })
        })
        .collect();

    Ok(Json(
        json!({ "message": "Course added to cart", "courses": items }),
    ))
}



pub async fn remove_from_cart(
    State(state): State<AppState>,
    Json(body): Json<RemoveFromCartRequest>,
) -> AppResult<Json<Value>> {
    // Tìm cart của user
    let cart: Option<(String,)> = sqlx::query_as("SELECT id FROM carts WHERE user_id = ?")
        .bind(&body.user_id)
        .fetch_optional(&state.db)
        .await?;

    let (cart_id,) = cart.ok_or_else(|| AppError::NotFound("Cart not found".into()))?;

    // Xóa khóa học khỏi cart
    sqlx::query("DELETE FROM cart_courses WHERE cart_id = ? AND course_id = ?")
        .bind(&cart_id)
        .bind(&body.course_id)
        .execute(&state.db)
        .await?;

    Ok(Json(json!({ "message": "Course removed from cart" })))
}



pub async fn clear_cart(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> AppResult<Json<Value>> {
    let cart: Option<(String,)> = sqlx::query_as("SELECT id FROM carts WHERE user_id = ?")
        .bind(&user_id)
        .fetch_optional(&state.db)
        .await?;

    let (cart_id,) = cart.ok_or_else(|| AppError::NotFound("Cart not found".into()))?;

    sqlx::query("DELETE FROM cart_courses WHERE cart_id = ?")
        .bind(&cart_id)
        .execute(&state.db)
        .await?;

    Ok(Json(json!({ "message": "Cart cleared successfully" })))
}
