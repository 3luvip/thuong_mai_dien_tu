use axum::{
    Json,
    extract::{Path, State}
};
use bigdecimal::ToPrimitive;
use serde_json::{Value, json};
use crate::{models::course::{AllCourseRow, CourseCardRow, CourseRow}, state::AppState};
use crate::{
    errors::{AppError, AppResult}
};

const FOOTER_ROW1: [&str; 4] = [
    "In-demand Careers", // sẽ bị override bằng static data ở frontend
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

pub async fn get_all_courses(State(state): State<AppState>) -> AppResult<Json<Value>> {
    // JOIN với course_cards để lấy current_price (giá sau giảm giá) và card_id
    let rows: Vec<AllCourseRow> = sqlx::query_as(
        r#"SELECT
               c.id, c.title, c.author, c.course_sub, c.price,
               c.language, c.level, c.category, c.path, c.filename,
               c.instructor_id,
               u.name  AS instructor_name,
               cc.current_price,
               cc.id   AS card_id
           FROM courses c
           LEFT JOIN users u        ON u.id  = c.instructor_id
           LEFT JOIN course_cards cc ON cc.course_detail_id = c.id
           ORDER BY c.created_at DESC"#,
    )
    .fetch_all(&state.db)
    .await?;

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
            })
        })
        .collect();

    Ok(Json(json!({
        "message": "Fetched all courses",
        "courses": courses
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

    // "See all" link cuối mỗi cột
    links.push(json!({
        "id":       format!("see-all-{}", category.to_lowercase().replace([' ', '/'], "-")),
        "label":    format!("See all {} courses", category),
        "url":      format!("/courses?category={}", category),
        "isSeeAll": true,
    }));

    Ok(links)
}

pub async fn get_footer(State(state): State<AppState>) -> AppResult<Json<Value>> {
    // Xây row1
    let mut row1: Vec<Value> = Vec::new();
    for cat in FOOTER_ROW1 {
        let links = fetch_footer_links(&state.db, cat).await?;
        row1.push(json!({ "category": cat, "links": links }));
    }

    // Xây row2
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
