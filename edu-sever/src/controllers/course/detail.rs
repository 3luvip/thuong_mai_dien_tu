// src/controllers/course/detail.rs

use crate::errors::{AppError, AppResult};
use crate::state::AppState;
use axum::Json;
use axum::extract::{Path, State};
use bigdecimal::ToPrimitive;
use serde_json::{Value, json};
use std::collections::HashMap;
use crate::models::detail::CourseInfoRow;

pub async fn get_course_detail_full(
    State(state): State<AppState>,
    Path(input_id): Path<String>,
) -> AppResult<Json<Value>> {

    // Resolve: input can be course_id or course_card_id
    let mut course_id = input_id.clone();
    let mut card_id: Option<String> = None;

    if let Some((course_detail_id,)) = sqlx::query_as::<_, (String,)>(
        "SELECT course_detail_id FROM course_cards WHERE id = ?",
    )
    .bind(&input_id)
    .fetch_optional(&state.db)
    .await?
    {
        course_id = course_detail_id;
        card_id = Some(input_id);
    }
    // ── 1. Giá: course_cards trước, fallback courses.price ────────────────
    let card: Option<(bigdecimal::BigDecimal, bigdecimal::BigDecimal)> = if let Some(ref cid) = card_id {
        sqlx::query_as("SELECT price, current_price FROM course_cards WHERE id = ? LIMIT 1")
            .bind(cid)
            .fetch_optional(&state.db)
            .await?
    } else {
        sqlx::query_as(
            "SELECT price, current_price FROM course_cards WHERE course_detail_id = ? LIMIT 1",
        )
        .bind(&course_id)
        .fetch_optional(&state.db)
        .await?
    };let (card_price, card_current_price) = match card {
        Some(c) => c,
        None => {
            let (p,): (bigdecimal::BigDecimal,) =
                sqlx::query_as("SELECT price FROM courses WHERE id = ?")
                    .bind(&course_id)
                    .fetch_optional(&state.db)
                    .await?
                    .ok_or_else(|| AppError::NotFound("Course not found".into()))?;
            (p.clone(), p)
        }
    };

    // ── 2. Course + instructor ─────────────────────────────────────────────

    let course: CourseInfoRow = sqlx::query_as(
        r#"SELECT c.id, c.title, c.course_sub, c.description, c.language,
                  c.level, c.category, c.filename, c.instructor_id,
                  u.name   AS instructor_name,
                  u.email  AS instructor_email,
                  u.status AS instructor_status
           FROM courses c
           LEFT JOIN users u ON u.id = c.instructor_id
           WHERE c.id = ?"#,
    )
    .bind(&course_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Course not found".into()))?;

    // ── 3. Learnings ──────────────────────────────────────────────────────
    #[derive(sqlx::FromRow)]
    struct LearningRow { content: String }

    let learnings: Vec<LearningRow> = sqlx::query_as(
        "SELECT content FROM course_learnings WHERE course_id = ? ORDER BY position ASC",
    )
    .bind(&course_id)
    .fetch_all(&state.db)
    .await?;

    // ── 4. Tags ───────────────────────────────────────────────────────────
    #[derive(sqlx::FromRow)]
    struct TagRow { tag: String }

    let tags: Vec<TagRow> =
        sqlx::query_as("SELECT tag FROM course_tags WHERE course_id = ?")
            .bind(&course_id)
            .fetch_all(&state.db)
            .await?;

    // ── 5. Curriculum: sections + lectures (2 queries, buid in-memory) ────
    #[derive(sqlx::FromRow)]
    struct SectionRow {
        id:       String,
        title:    String,
        position: i32,
    }

    let sections: Vec<SectionRow> = sqlx::query_as(
        "SELECT id, title, position FROM sections WHERE course_id = ? ORDER BY position ASC",
    )
    .bind(&course_id)
    .fetch_all(&state.db)
    .await?;

    #[derive(sqlx::FromRow)]
    struct LectureRow {
        id:           String,
        section_id:   String,
        title:        String,
        position:     i32,
        duration_sec: i32,
        is_preview:   i8,
        video_url:    Option<String>,
    }

    let lectures: Vec<LectureRow> = sqlx::query_as(
        r#"SELECT l.id, l.section_id, l.title, l.position, l.duration_sec, l.is_preview, l.video_url
           FROM lectures l
           JOIN sections s ON s.id = l.section_id
           WHERE s.course_id = ?
           ORDER BY s.position ASC, l.position ASC"#,
    )
    .bind(&course_id)
    .fetch_all(&state.db)
    .await?;

    // Group lectures theo section_id để tránh filter lặp O(n²)
    let mut lectures_by_section: HashMap<&str, Vec<&LectureRow>> = HashMap::new();
    for lec in &lectures {
        lectures_by_section
            .entry(lec.section_id.as_str())
            .or_default()
            .push(lec);
    }

    let curriculum: Vec<Value> = sections
        .iter()
        .map(|sec| {
            let sec_lectures = lectures_by_section
                .get(sec.id.as_str())
                .map(|list| list.as_slice())
                .unwrap_or(&[]);

            let total_sec: i32 = sec_lectures.iter().map(|l| l.duration_sec).sum();

            let lectures_json: Vec<Value> = sec_lectures
                .iter()
                .map(|l| json!({
                    "id":          l.id,
                    "title":       l.title,
                    "position":    l.position,
                    "durationSec": l.duration_sec,
                    "isPreview":   l.is_preview == 1,
                    "videoUrl":    l.video_url,
                }))
                .collect();

            json!({
                "id":               sec.id,
                "title":            sec.title,
                "position":         sec.position,
                "totalDurationSec": total_sec,
                "lectureCount":     sec_lectures.len(),
                "lectures":         lectures_json,
            })
        })
        .collect();

    // ── 6. Reviews: stats + distribution + recent ─────────────────────────
    #[derive(sqlx::FromRow)]
    struct RatingDistRow {
        star:  i8,
        count: i64,
    }

    let dist_rows: Vec<RatingDistRow> = sqlx::query_as(
        "SELECT rating AS star, COUNT(*) AS count
         FROM reviews
         WHERE course_id = ?
         GROUP BY rating",
    )
    .bind(&course_id)
    .fetch_all(&state.db)
    .await?;

    // Tính tổng review + avg từ distribution — không cần query thêm
    let total_reviews: i64 = dist_rows.iter().map(|r| r.count).sum();
    let avg_rating: f64 = if total_reviews > 0 {
        let weighted: f64 = dist_rows
            .iter()
            .map(|r| r.star as f64 * r.count as f64)
            .sum();
        (weighted / total_reviews as f64 * 10.0).round() / 10.0 // làm tròn 1 chữ số
    } else {
        0.0
    };

    // Build distribution map để lookup O(1)
    let dist_map: HashMap<i8, i64> = dist_rows
        .into_iter()
        .map(|r| (r.star, r.count))
        .collect();

    let rating_dist: Vec<Value> = (1i8..=5)
        .rev()
        .map(|star| {
            let count = dist_map.get(&star).copied().unwrap_or(0);
            let pct = if total_reviews > 0 {
                (count as f64 / total_reviews as f64) * 100.0
            } else {
                0.0
            };
            json!({ "star": star, "count": count, "percent": pct })
        })
        .collect();

    #[derive(sqlx::FromRow)]
    struct ReviewRow {
        id:         String,
        user_name:  Option<String>,
        rating:     i8,
        comment:    Option<String>,
        created_at: chrono::NaiveDateTime,
    }

    let recent_reviews: Vec<ReviewRow> = sqlx::query_as(
        r#"SELECT r.id, u.name AS user_name, r.rating, r.comment, r.created_at
           FROM reviews r
           LEFT JOIN users u ON u.id = r.user_id
           WHERE r.course_id = ?
           ORDER BY r.created_at DESC
           LIMIT 4"#,
    )
    .bind(&course_id)
    .fetch_all(&state.db)
    .await?;

    // ── 7. Tổng học viên + tổng thời lượng ───────────────────────────────
    let (total_students,): (i64,) = sqlx::query_as(
        r#"SELECT COUNT(DISTINCT o.user_id)
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE oi.course_id = ? AND o.status = 'paid'"#,
    )
    .bind(&course_id)
    .fetch_one(&state.db)
    .await?;

    let (total_duration_sec,): (Option<i64>,) = sqlx::query_as(
        r#"SELECT CAST(SUM(l.duration_sec) AS SIGNED)
           FROM lectures l
           JOIN sections s ON s.id = l.section_id
           WHERE s.course_id = ?"#,
    )
    .bind(&course_id)
    .fetch_one(&state.db)
    .await?;

    // ── 8. Build response ─────────────────────────────────────────────────
    Ok(Json(json!({
        "message":      "Course detail fetched successfully",
        "courseId":     course_id,
        "price":        card_price.to_f64().unwrap_or(0.0),
        "currentPrice": card_current_price.to_f64().unwrap_or(0.0),
        "course": {
            "id":               course.id,
            "title":            course.title,
            "courseSub":        course.course_sub,
            "description":      course.description,
            "language":         course.language,
            "level":            course.level,
            "category":         course.category,
            "filename":         course.filename,
            "totalStudents":    total_students,
            "totalDurationSec": total_duration_sec.unwrap_or(0),
            "totalLectures":    lectures.len(),
            "totalSections":    sections.len(),
        },
        "instructor": {
            "id":    course.instructor_id,
            "name":  course.instructor_name,
            "email": course.instructor_email,
            "bio":   course.instructor_status,
        },
        "learnings":  learnings.iter().map(|l| l.content.clone()).collect::<Vec<_>>(),
        "tags":       tags.iter().map(|t| t.tag.clone()).collect::<Vec<_>>(),
        "curriculum": curriculum,
        "reviews": {
            "avgRating":    avg_rating,
            "totalReviews": total_reviews,
            "distribution": rating_dist,
            "recent": recent_reviews.iter().map(|r| json!({
                "id":        r.id,
                "userName":  r.user_name,
                "rating":    r.rating,
                "comment":   r.comment,
                "createdAt": r.created_at.format("%Y-%m-%d").to_string(),
            })).collect::<Vec<_>>(),
        },
    })))
}

