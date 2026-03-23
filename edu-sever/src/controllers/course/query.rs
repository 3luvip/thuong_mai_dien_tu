use axum::{
    Json,
    extract::{Path, Query, State}
};
use bigdecimal::ToPrimitive;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use crate::{models::course::{AllCourseRow, CourseCardRow, CourseRow}, state::AppState};
use crate::{
    errors::{AppError, AppResult}
};

const FOOTER_ROW1: [&str; 4] = [
    "In-demand Careers",
    "Web Development",
    "IT Certifications",
    "Leadership",
];

const FOOTER_ROW2: [&str; 4] = [
    "Certifications by Skill",
    "Data Science",
    "Communication",
    "Business Analytics",
];

pub async fn get_course(
    State(state): State<AppState>,
    Path(course_card_id): Path<String>,
) -> AppResult<Json<Value>> {
    let card: Option<(String,)> =
        sqlx::query_as("SELECT course_detail_id FROM course_cards WHERE id = ?")
            .bind(&course_card_id)
            .fetch_optional(&state.db)
            .await?;

    let (course_id,) = card.ok_or_else(|| AppError::NotFound("Course card not found".into()))?;

    let row: CourseRow = sqlx::query_as(
        r#"SELECT c.id, c.title, c.course_sub, c.description, c.price, c.language,
               c.level, c.category, c.path, c.filename,
               c.instructor_id, c.course_instruction_id,
               u.name AS instructor_name, u.email AS instructor_email
        FROM courses c
        LEFT JOIN users u ON u.id = c.instructor_id
        WHERE c.id = ?"#,
    )
    .bind(&course_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Course not found".into()))?;

    Ok(Json(json!({
        "message": "Course data fetched successfully",
        "course": {
            "id": row.id,
            "title": row.title,
            "courseSub": row.course_sub,
            "description": row.description,
            "price": row.price.to_f64().unwrap_or(0.0),
            "language": row.language,
            "level": row.level,
            "category": row.category,
            "instructorId": row.instructor_id,
            "instructorName": row.instructor_name,
            "instructorEmail": row.instructor_email,
            "filename": row.filename,
            "courseInstructionId": row.course_instruction_id
        }
    })))
}

// ─── Query params cho all-courses ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CourseListParams {
    pub page:     Option<u64>,
    pub limit:    Option<u64>,
    pub category: Option<String>,
    pub keyword:  Option<String>,
    pub level:    Option<String>,
}

pub async fn get_all_courses(
    State(state): State<AppState>,
    Query(params): Query<CourseListParams>,
) -> AppResult<Json<Value>> {
    let page  = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * limit;

    // Build WHERE clause
    let mut conditions: Vec<String> = Vec::new();
    let mut bind_category = false;
    let mut bind_keyword  = false;
    let mut bind_level    = false;

    if let Some(ref cat) = params.category {
        if !cat.is_empty() {
            conditions.push("c.category = ?".to_string());
            bind_category = true;
        }
    }

    if let Some(ref kw) = params.keyword {
        if !kw.is_empty() {
            conditions.push("(c.title LIKE ? OR c.author LIKE ? OR c.course_sub LIKE ?)".to_string());
            bind_keyword = true;
        }
    }

    if let Some(ref lv) = params.level {
        if !lv.is_empty() {
            conditions.push("c.level = ?".to_string());
            bind_level = true;
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    // Tạo owned strings trước để tránh borrow checker lỗi "does not live long enough"
    let category_val = params.category.as_deref().unwrap_or("").to_string();
    let level_val    = params.level.as_deref().unwrap_or("").to_string();
    let like_val     = if bind_keyword {
        format!("%{}%", params.keyword.as_deref().unwrap_or(""))
    } else {
        String::new()
    };

    // Count total
    let count_sql = format!(
        r#"SELECT COUNT(DISTINCT c.id)
           FROM courses c
           LEFT JOIN users u         ON u.id  = c.instructor_id
           LEFT JOIN course_cards cc ON cc.course_detail_id = c.id
           {where_clause}"#
    );

    let mut count_q = sqlx::query_as::<_, (i64,)>(&count_sql);
    if bind_category { count_q = count_q.bind(&category_val); }
    if bind_keyword  { count_q = count_q.bind(&like_val).bind(&like_val).bind(&like_val); }
    if bind_level    { count_q = count_q.bind(&level_val); }

    let (total,): (i64,) = count_q.fetch_one(&state.db).await?;

    // Fetch page
    let data_sql = format!(
        r#"SELECT
               c.id, c.title, c.author, c.course_sub, c.price,
               c.language, c.level, c.category, c.path, c.filename,
               c.instructor_id,
               u.name  AS instructor_name,
               cc.current_price,
               cc.id   AS card_id,
               rev.avg_rating,
               rev.review_count
           FROM courses c
           LEFT JOIN users u         ON u.id  = c.instructor_id
           LEFT JOIN course_cards cc ON cc.course_detail_id = c.id
           LEFT JOIN (
               SELECT course_id,
                      AVG(CAST(rating AS DECIMAL(4,2))) AS avg_rating,
                      COUNT(*) AS review_count
               FROM reviews
               GROUP BY course_id
           ) rev ON rev.course_id = c.id
           {where_clause}
           ORDER BY c.created_at DESC
           LIMIT ? OFFSET ?"#
    );

    let mut data_q = sqlx::query_as::<_, AllCourseRow>(&data_sql);
    if bind_category { data_q = data_q.bind(&category_val); }
    if bind_keyword  { data_q = data_q.bind(&like_val).bind(&like_val).bind(&like_val); }
    if bind_level    { data_q = data_q.bind(&level_val); }
    data_q = data_q.bind(limit as i64).bind(offset as i64);

    let rows: Vec<AllCourseRow> = data_q.fetch_all(&state.db).await?;

    let courses: Vec<Value> = rows
        .into_iter()
        .map(|r| {
            let price = r.price.to_f64().unwrap_or(0.0);
            let current_price = r
                .current_price
                .as_ref()
                .and_then(|v| v.to_f64())
                .unwrap_or(price);

            json!({
                "id":             r.id,
                "cardId":         r.card_id,
                "title":          r.title,
                "author":         r.author,
                "courseSub":      r.course_sub,
                "price":          price,
                "currentPrice":   current_price,
                "language":       r.language,
                "level":          r.level,
                "category":       r.category,
                "path":           r.path,
                "filename":       r.filename,
                "instructorId":   r.instructor_id,
                "instructorName": r.instructor_name,
                "avgRating":      r.avg_rating
                    .as_ref()
                    .and_then(|v| v.to_f64())
                    .map(|x| (x * 10.0).round() / 10.0)
                    .unwrap_or(0.0),
                "totalReviews":   r.review_count.unwrap_or(0),
            })
        })
        .collect();

    let total_pages = ((total as f64) / (limit as f64)).ceil() as u64;

    Ok(Json(json!({
        "message":    "Fetched all courses",
        "courses":    courses,
        "pagination": {
            "page":       page,
            "limit":      limit,
            "total":      total,
            "totalPages": total_pages,
        }
    })))
}

pub async fn get_course_cards(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let rows: Vec<CourseCardRow> = sqlx::query_as(
        r#"SELECT cc.id, cc.title, cc.author, cc.price, cc.current_price,
               cc.path, cc.filename, cc.instructor_id, cc.course_detail_id,
               u.name AS instructor_name, u.email AS instructor_email
        FROM course_cards cc
        LEFT JOIN users u ON u.id = cc.instructor_id"#,
    )
    .fetch_all(&state.db)
    .await?;

    let cards: Vec<Value> = rows
        .into_iter()
        .map(|r| {
            json!({
                "id": r.id,
                "title": r.title,
                "author": r.author,
                "price": r.price.to_f64().unwrap_or(0.0),
                "currentPrice": r.current_price.to_f64().unwrap_or(0.0),
                "path": r.path,
                "filename": r.filename,
                "instructorId": r.instructor_id,
                "instructorName": r.instructor_name,
                "instructorEmail": r.instructor_email,
                "courseDetailId": r.course_detail_id
            })
        })
        .collect();

    Ok(Json(
        json!({ "message": "Fetched course cards", "courseCards": cards }),
    ))
}

async fn fetch_footer_links(
    db: &sqlx::MySqlPool,
    category: &str,
) -> Result<Vec<Value>, sqlx::Error> {
    #[derive(sqlx::FromRow)]
    struct Row {
        course_id: String,
        card_id: Option<String>,
        title: String,
    }

    let rows: Vec<Row> = sqlx::query_as(
        r#"SELECT
               c.id          AS course_id,
               cc.id         AS card_id,
               c.title
           FROM courses c
           LEFT JOIN course_cards cc ON cc.course_detail_id = c.id
           WHERE c.category = ?
           ORDER BY c.created_at DESC
           LIMIT 5"#,
    )
    .bind(category)
    .fetch_all(db)
    .await?;

    let mut links: Vec<Value> = rows
        .into_iter()
        .map(|r| {
            let url = match &r.card_id {
                Some(id) => format!("/course-detail/{}", id),
                None => format!("/courses?category={}", category),
            };
            json!({ "id": r.course_id, "label": r.title, "url": url })
        })
        .collect();

    links.push(json!({
        "id":       format!("see-all-{}", category.to_lowercase().replace([' ', '/'], "-")),
        "label":    format!("See all {} courses", category),
        "url":      format!("/courses?category={}", category),
        "isSeeAll": true,
    }));

    Ok(links)
}

pub async fn get_footer(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let mut row1: Vec<Value> = Vec::new();
    for cat in FOOTER_ROW1 {
        let links = fetch_footer_links(&state.db, cat).await?;
        row1.push(json!({ "category": cat, "links": links }));
    }

    let mut row2: Vec<Value> = Vec::new();
    for cat in FOOTER_ROW2 {
        let links = fetch_footer_links(&state.db, cat).await?;
        row2.push(json!({ "category": cat, "links": links }));
    }

    Ok(Json(json!({
        "message": "Footer fetched successfully",
        "row1": row1,
        "row2": row2,
    })))
}

#[derive(Debug, Serialize)]
pub struct CategoryItem {
    pub category: String,
    pub subcategories: Vec<String>,
}

pub async fn get_categories(
    State(state): State<AppState>,
) -> Result<Json<Vec<CategoryItem>>, AppError> {
    let rows = sqlx::query!(
        r#"
        SELECT DISTINCT category, course_sub
        FROM courses
        ORDER BY category, course_sub
        "#
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| AppError::Validation(e.to_string()))?;

    let mut map: std::collections::BTreeMap<String, Vec<String>> =
        std::collections::BTreeMap::new();

    for row in rows {
        map.entry(row.category)
            .or_default()
            .push(row.course_sub);
    }

    let result: Vec<CategoryItem> = map
        .into_iter()
        .map(|(category, subcategories)| CategoryItem {
            category,
            subcategories,
        })
        .collect();

    Ok(Json(result))
}