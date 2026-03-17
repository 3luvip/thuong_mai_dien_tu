// src/controllers/learning.rs
// Đặt file này tại: src/controllers/learning.rs

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use serde::Deserialize;
use serde_json::{Value, json};
use std::collections::HashMap;
use uuid::Uuid;

use crate::{
    errors::{AppError, AppResult},
    state::AppState,
};

// ─── GET /learning/my-courses/:user_id ───────────────────────────────────────

pub async fn get_my_courses(
    State(state): State<AppState>,
    Path(user_id): Path<String>,
) -> AppResult<Json<Value>> {
    // 1. Lấy danh sách course đã mua (status = 'paid')
    #[derive(sqlx::FromRow)]
    struct PurchasedRow {
        course_id: String,
        purchased_at: chrono::NaiveDateTime,
    }

    let purchased: Vec<PurchasedRow> = sqlx::query_as(
        r#"SELECT 
           oi.course_id,
           MAX(o.created_at) AS purchased_at
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.user_id = ? AND o.status = 'paid'
       GROUP BY oi.course_id
       ORDER BY purchased_at DESC"#,
    )
    .bind(&user_id)
    .fetch_all(&state.db)
    .await?;

    if purchased.is_empty() {
        return Ok(Json(json!({ "courses": [] })));
    }

    let mut courses: Vec<Value> = Vec::new();

    for p in &purchased {
        // 2. Lấy thông tin course + instructor
        #[derive(sqlx::FromRow)]
        struct CourseRow {
            id: String,
            title: String,
            course_sub: String,
            path: String,
            level: String,
            category: String,
            instructor_name: Option<String>,
        }

        let course: Option<CourseRow> = sqlx::query_as(
            r#"SELECT c.id, c.title, c.course_sub, c.path, c.level, c.category,
                      u.name AS instructor_name
               FROM courses c
               LEFT JOIN users u ON u.id = c.instructor_id
               WHERE c.id = ?"#,
        )
        .bind(&p.course_id)
        .fetch_optional(&state.db)
        .await?;

        let course = match course {
            Some(c) => c,
            None => continue,
        };

        // 3. Tổng số lectures
        let (total_lectures,): (i64,) = sqlx::query_as(
            r#"SELECT COUNT(l.id) FROM lectures l
               JOIN sections s ON s.id = l.section_id
               WHERE s.course_id = ?"#,
        )
        .bind(&p.course_id)
        .fetch_one(&state.db)
        .await?;

        // 4. Số lectures đã hoàn thành
        let (completed_lectures,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM lecture_progress WHERE user_id = ? AND course_id = ? AND is_completed = 1",
        )
        .bind(&user_id)
        .bind(&p.course_id)
        .fetch_one(&state.db)
        .await?;

        let progress_pct = if total_lectures > 0 {
            (completed_lectures as f64 / total_lectures as f64 * 100.0).round() as i64
        } else {
            0
        };

        // 5. Bài học đang học dở gần nhất
        #[derive(sqlx::FromRow)]
        struct LastLectureRow {
            id: String,
            title: String,
        }

        let last_lecture: Option<LastLectureRow> = sqlx::query_as(
            r#"SELECT lp.lecture_id AS id, l.title
               FROM lecture_progress lp
               JOIN lectures l ON l.id = lp.lecture_id
               WHERE lp.user_id = ? AND lp.course_id = ? AND lp.is_completed = 0
               ORDER BY lp.last_watched_at DESC LIMIT 1"#,
        )
        .bind(&user_id)
        .bind(&p.course_id)
        .fetch_optional(&state.db)
        .await?;

        courses.push(json!({
            "courseId":          course.id,
            "title":             course.title,
            "courseSub":         course.course_sub,
            "path":              course.path,
            "level":             course.level,
            "category":          course.category,
            "instructorName":    course.instructor_name,
            "purchasedAt":       p.purchased_at.format("%Y-%m-%d").to_string(),
            "totalLectures":     total_lectures,
            "completedLectures": completed_lectures,
            "progressPct":       progress_pct,
            "lastLecture": last_lecture.map(|l| json!({ "id": l.id, "title": l.title })),
        }));
    }

    Ok(Json(json!({ "courses": courses })))
}

// ─── GET /learning/learn/:user_id/:course_id ─────────────────────────────────

pub async fn get_learn_data(
    State(state): State<AppState>,
    Path((user_id, course_id)): Path<(String, String)>,
) -> AppResult<Json<Value>> {
    // 1. Kiểm tra đã mua chưa
    let purchased: Option<(String,)> = sqlx::query_as(
        r#"SELECT oi.id FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE oi.course_id = ? AND o.user_id = ? AND o.status = 'paid'
           LIMIT 1"#,
    )
    .bind(&course_id)
    .bind(&user_id)
    .fetch_optional(&state.db)
    .await?;

    if purchased.is_none() {
        return Err(AppError::Forbidden("Bạn chưa mua khóa học này".into()));
    }

    // 2. Thông tin course
    #[derive(sqlx::FromRow)]
    struct CourseRow {
        id: String,
        title: String,
        course_sub: String,
        path: String,
        instructor_name: Option<String>,
    }

    let course: CourseRow = sqlx::query_as(
        r#"SELECT c.id, c.title, c.course_sub, c.path, u.name AS instructor_name
           FROM courses c LEFT JOIN users u ON u.id = c.instructor_id
           WHERE c.id = ?"#,
    )
    .bind(&course_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Course not found".into()))?;

    // 3. Sections
    #[derive(sqlx::FromRow)]
    struct SectionRow {
        id: String,
        title: String,
        position: i32,
    }

    let sections: Vec<SectionRow> = sqlx::query_as(
        "SELECT id, title, position FROM sections WHERE course_id = ? ORDER BY position ASC",
    )
    .bind(&course_id)
    .fetch_all(&state.db)
    .await?;

    // 4. Lectures (kèm video_url)
    #[derive(sqlx::FromRow)]
    struct LectureRow {
        id: String,
        section_id: String,
        title: String,
        position: i32,
        duration_sec: i32,
        is_preview: i8,
        video_url: Option<String>,
    }

    let lectures: Vec<LectureRow> = sqlx::query_as(
        r#"SELECT l.id, l.section_id, l.title, l.position,
                  l.duration_sec, l.is_preview, l.video_url
           FROM lectures l
           JOIN sections s ON s.id = l.section_id
           WHERE s.course_id = ?
           ORDER BY s.position ASC, l.position ASC"#,
    )
    .bind(&course_id)
    .fetch_all(&state.db)
    .await?;

    // 5. Tiến độ user
    #[derive(sqlx::FromRow)]
    struct ProgressRow {
        lecture_id: String,
        is_completed: i8,
        watched_sec: i32,
    }

    let progress_rows: Vec<ProgressRow> = sqlx::query_as(
        "SELECT lecture_id, is_completed, watched_sec FROM lecture_progress WHERE user_id = ? AND course_id = ?",
    )
    .bind(&user_id)
    .bind(&course_id)
    .fetch_all(&state.db)
    .await?;

    let progress_map: HashMap<String, (bool, i32)> = progress_rows
        .iter()
        .map(|p| (p.lecture_id.clone(), (p.is_completed == 1, p.watched_sec)))
        .collect();

    // 6. Build curriculum JSON
    let curriculum: Vec<Value> = sections.iter().map(|sec| {
        let sec_lectures: Vec<Value> = lectures.iter()
            .filter(|l| l.section_id == sec.id)
            .map(|l| {
                let (is_completed, watched_sec) = progress_map.get(&l.id).copied().unwrap_or((false, 0));
                json!({
                    "id":          l.id,
                    "title":       l.title,
                    "position":    l.position,
                    "durationSec": l.duration_sec,
                    "isPreview":   l.is_preview == 1,
                    "videoUrl":    l.video_url,
                    "isCompleted": is_completed,
                    "watchedSec":  watched_sec,
                })
            })
            .collect();

        json!({ "id": sec.id, "title": sec.title, "position": sec.position, "lectures": sec_lectures })
    }).collect();

    let total_lectures = lectures.len() as i64;
    let completed_lectures = progress_map.values().filter(|(done, _)| *done).count() as i64;
    let progress_pct = if total_lectures > 0 {
        (completed_lectures as f64 / total_lectures as f64 * 100.0).round() as i64
    } else {
        0
    };

    Ok(Json(json!({
        "course": {
            "id":             course.id,
            "title":          course.title,
            "courseSub":      course.course_sub,
            "path":           course.path,
            "instructorName": course.instructor_name,
        },
        "curriculum":        curriculum,
        "totalLectures":     total_lectures,
        "completedLectures": completed_lectures,
        "progressPct":       progress_pct,
    })))
}

// ─── POST /learning/progress ─────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct UpdateProgressRequest {
    pub user_id: String,
    pub lecture_id: String,
    pub course_id: String,
    pub watched_sec: i32,
    pub is_completed: bool,
}

pub async fn update_progress(
    State(state): State<AppState>,
    Json(body): Json<UpdateProgressRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    // Kiểm tra đã mua
    let purchased: Option<(String,)> = sqlx::query_as(
        r#"SELECT oi.id FROM order_items oi JOIN orders o ON o.id = oi.order_id
           WHERE oi.course_id = ? AND o.user_id = ? AND o.status = 'paid' LIMIT 1"#,
    )
    .bind(&body.course_id)
    .bind(&body.user_id)
    .fetch_optional(&state.db)
    .await?;

    if purchased.is_none() {
        return Err(AppError::Forbidden("Bạn chưa mua khóa học này".into()));
    }

    let id = Uuid::new_v4().to_string();

    sqlx::query(
        r#"INSERT INTO lecture_progress
               (id, user_id, lecture_id, course_id, is_completed, watched_sec)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
               is_completed    = IF(VALUES(is_completed) = 1, 1, is_completed),
               watched_sec     = GREATEST(watched_sec, VALUES(watched_sec)),
               last_watched_at = NOW()"#,
    )
    .bind(&id)
    .bind(&body.user_id)
    .bind(&body.lecture_id)
    .bind(&body.course_id)
    .bind(body.is_completed as i8)
    .bind(body.watched_sec)
    .execute(&state.db)
    .await?;

    Ok((
        StatusCode::OK,
        Json(json!({ "message": "Tiến độ đã được cập nhật" })),
    ))
}
