// ─────────────────────────────────────────────────────────────────────────────
// src/controllers/instructor.rs
// Instructor Dashboard — quản lý course, section, lecture, video upload
// ─────────────────────────────────────────────────────────────────────────────

use axum::{
    Json,
    extract::{Multipart, Path, State},
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

// ─── Helper: lưu file upload ─────────────────────────────────────────────────

async fn save_file(
    upload_dir: &str,
    data: Vec<u8>,
    original_name: &str,
) -> Result<(String, String), AppError> {
    let now = chrono::Utc::now()
        .format("%Y-%m-%dT%H-%M-%S%.3fZ")
        .to_string();
    let filename = format!("{}-{}", now, original_name);
    let filepath = format!("{}/{}", upload_dir, filename);
    tokio::fs::write(&filepath, &data).await?;
    Ok((filepath, filename))
}

// ─── GET /instructor/my-courses/:instructor_id ────────────────────────────────
// Trả về tất cả khóa học của giảng viên kèm thống kê cơ bản

pub async fn get_my_courses(
    State(state): State<AppState>,
    Path(instructor_id): Path<String>,
) -> AppResult<Json<Value>> {
    #[derive(sqlx::FromRow)]
    struct CourseRow {
        id: String,
        title: String,
        course_sub: String,
        description: String,
        price: bigdecimal::BigDecimal,
        language: String,
        level: String,
        category: String,
        path: String,
        created_at: chrono::NaiveDateTime,
    }

    let courses: Vec<CourseRow> = sqlx::query_as(
        r#"SELECT id, title, course_sub, description, price,
                  language, level, category, path, created_at
           FROM courses
           WHERE instructor_id = ?
           ORDER BY created_at DESC"#,
    )
    .bind(&instructor_id)
    .fetch_all(&state.db)
    .await?;

    let mut result: Vec<Value> = Vec::new();
    for c in &courses {
        // Đếm số học viên
        let (students,): (i64,) = sqlx::query_as(
            r#"SELECT COUNT(DISTINCT o.user_id) FROM order_items oi
               JOIN orders o ON o.id = oi.order_id
               WHERE oi.course_id = ? AND o.status = 'paid'"#,
        )
        .bind(&c.id)
        .fetch_one(&state.db)
        .await?;

        // Đếm sections + lectures
        let (section_count,): (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM sections WHERE course_id = ?")
                .bind(&c.id)
                .fetch_one(&state.db)
                .await?;

        let (lecture_count,): (i64,) = sqlx::query_as(
            r#"SELECT COUNT(*) FROM lectures l
               JOIN sections s ON s.id = l.section_id
               WHERE s.course_id = ?"#,
        )
        .bind(&c.id)
        .fetch_one(&state.db)
        .await?;

        // Rating trung bình
        let (avg_rating,): (Option<f64>,) =
            sqlx::query_as("SELECT CAST(AVG(rating) AS DOUBLE) FROM reviews WHERE course_id = ?")
                .bind(&c.id)
                .fetch_one(&state.db)
                .await?;

        result.push(json!({
            "id":           c.id,
            "title":        c.title,
            "courseSub":    c.course_sub,
            "description":  c.description,
            "price":        c.price.to_f64().unwrap_or(0.0),
            "language":     c.language,
            "level":        c.level,
            "category":     c.category,
            "filename":     c.path,
            "createdAt":    c.created_at.format("%Y-%m-%d").to_string(),
            "stats": {
                "students":     students,
                "sections":     section_count,
                "lectures":     lecture_count,
                "avgRating":    avg_rating.unwrap_or(0.0),
            }
        }));
    }

    Ok(Json(json!({ "courses": result })))
}

// ─── GET /instructor/course-curriculum/:course_id ─────────────────────────────
// Trả về toàn bộ sections + lectures của một course

pub async fn get_course_curriculum(
    State(state): State<AppState>,
    Path(course_id): Path<String>,
) -> AppResult<Json<Value>> {
    #[derive(sqlx::FromRow)]
    struct SectionRow {
        id: String,
        title: String,
        position: i32,
    }

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

    let sections: Vec<SectionRow> = sqlx::query_as(
        "SELECT id, title, position FROM sections WHERE course_id = ? ORDER BY position ASC",
    )
    .bind(&course_id)
    .fetch_all(&state.db)
    .await?;

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

    let curriculum: Vec<Value> = sections
        .iter()
        .map(|sec| {
            let sec_lectures: Vec<Value> = lectures
                .iter()
                .filter(|l| l.section_id == sec.id)
                .map(|l| {
                    json!({
                        "id":          l.id,
                        "title":       l.title,
                        "position":    l.position,
                        "durationSec": l.duration_sec,
                        "isPreview":   l.is_preview == 1,
                        "videoUrl":    l.video_url,
                        "hasVideo":    l.video_url.is_some(),
                    })
                })
                .collect();

            let total_sec: i32 = lectures
                .iter()
                .filter(|l| l.section_id == sec.id)
                .map(|l| l.duration_sec)
                .sum();

            json!({
                "id":               sec.id,
                "title":            sec.title,
                "position":         sec.position,
                "totalDurationSec": total_sec,
                "lectureCount":     sec_lectures.len(),
                "lectures":         sec_lectures,
            })
        })
        .collect();

    Ok(Json(json!({ "curriculum": curriculum })))
}

// ─── POST /instructor/sections ────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CreateSectionRequest {
    pub course_id: String,
    pub title: String,
}

pub async fn create_section(
    State(state): State<AppState>,
    Json(body): Json<CreateSectionRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    if body.title.trim().is_empty() {
        return Err(AppError::Validation("Tiêu đề section không được trống".into()));
    }

    // Lấy position tiếp theo
    let (max_pos,): (Option<i32>,) =
        sqlx::query_as("SELECT MAX(position) FROM sections WHERE course_id = ?")
            .bind(&body.course_id)
            .fetch_one(&state.db)
            .await?;
    let position = max_pos.unwrap_or(0) + 1;

    let section_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO sections (id, course_id, title, position) VALUES (?, ?, ?, ?)",
    )
    .bind(&section_id)
    .bind(&body.course_id)
    .bind(body.title.trim())
    .bind(position)
    .execute(&state.db)
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "message": "Section created",
            "section": { "id": section_id, "title": body.title, "position": position }
        })),
    ))
}

// ─── PUT /instructor/sections/:section_id ────────────────────────────────────

#[derive(Deserialize)]
pub struct UpdateSectionRequest {
    pub title: String,
}

pub async fn update_section(
    State(state): State<AppState>,
    Path(section_id): Path<String>,
    Json(body): Json<UpdateSectionRequest>,
) -> AppResult<Json<Value>> {
    sqlx::query("UPDATE sections SET title = ? WHERE id = ?")
        .bind(body.title.trim())
        .bind(&section_id)
        .execute(&state.db)
        .await?;

    Ok(Json(json!({ "message": "Section updated" })))
}

// ─── DELETE /instructor/sections/:section_id ─────────────────────────────────

pub async fn delete_section(
    State(state): State<AppState>,
    Path(section_id): Path<String>,
) -> AppResult<Json<Value>> {
    sqlx::query("DELETE FROM sections WHERE id = ?")
        .bind(&section_id)
        .execute(&state.db)
        .await?;

    Ok(Json(json!({ "message": "Section deleted" })))
}

// ─── POST /instructor/lectures ────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CreateLectureRequest {
    pub section_id: String,
    pub title: String,
    pub is_preview: Option<bool>,
}

pub async fn create_lecture(
    State(state): State<AppState>,
    Json(body): Json<CreateLectureRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    if body.title.trim().is_empty() {
        return Err(AppError::Validation("Tiêu đề lecture không được trống".into()));
    }

    let (max_pos,): (Option<i32>,) =
        sqlx::query_as("SELECT MAX(position) FROM lectures WHERE section_id = ?")
            .bind(&body.section_id)
            .fetch_one(&state.db)
            .await?;
    let position = max_pos.unwrap_or(0) + 1;
    let is_preview = body.is_preview.unwrap_or(false) as i8;

    let lecture_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO lectures (id, section_id, title, position, is_preview) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&lecture_id)
    .bind(&body.section_id)
    .bind(body.title.trim())
    .bind(position)
    .bind(is_preview)
    .execute(&state.db)
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "message": "Lecture created",
            "lecture": {
                "id":        lecture_id,
                "title":     body.title,
                "position":  position,
                "isPreview": is_preview == 1,
            }
        })),
    ))
}

// ─── PUT /instructor/lectures/:lecture_id ────────────────────────────────────

#[derive(Deserialize)]
pub struct UpdateLectureRequest {
    pub title: Option<String>,
    pub is_preview: Option<bool>,
    pub duration_sec: Option<i32>,
}

pub async fn update_lecture(
    State(state): State<AppState>,
    Path(lecture_id): Path<String>,
    Json(body): Json<UpdateLectureRequest>,
) -> AppResult<Json<Value>> {
    if let Some(title) = &body.title {
        sqlx::query("UPDATE lectures SET title = ? WHERE id = ?")
            .bind(title.trim())
            .bind(&lecture_id)
            .execute(&state.db)
            .await?;
    }
    if let Some(is_preview) = body.is_preview {
        sqlx::query("UPDATE lectures SET is_preview = ? WHERE id = ?")
            .bind(is_preview as i8)
            .bind(&lecture_id)
            .execute(&state.db)
            .await?;
    }
    if let Some(duration) = body.duration_sec {
        sqlx::query("UPDATE lectures SET duration_sec = ? WHERE id = ?")
            .bind(duration)
            .bind(&lecture_id)
            .execute(&state.db)
            .await?;
    }

    Ok(Json(json!({ "message": "Lecture updated" })))
}

// ─── DELETE /instructor/lectures/:lecture_id ─────────────────────────────────

pub async fn delete_lecture(
    State(state): State<AppState>,
    Path(lecture_id): Path<String>,
) -> AppResult<Json<Value>> {
    sqlx::query("DELETE FROM lectures WHERE id = ?")
        .bind(&lecture_id)
        .execute(&state.db)
        .await?;

    Ok(Json(json!({ "message": "Lecture deleted" })))
}

// ─── POST /instructor/lectures/:lecture_id/upload-video ──────────────────────
// Upload video cho lecture — lưu file + cập nhật video_url + duration_sec

use tokio::io::AsyncWriteExt;

pub async fn upload_lecture_video(
    State(state): State<AppState>,
    Path(lecture_id): Path<String>,
    mut multipart: Multipart,
) -> AppResult<Json<Value>> {

    let mut video_filename: Option<String> = None;
    let mut duration_sec: i32 = 0;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::Validation(e.to_string()))?
    {
        let name = field.name().unwrap_or("").to_string();

        match name.as_str() {

            // ── VIDEO FILE ─────────────────────────
            "video" => {

                let orig_name = field
                    .file_name()
                    .unwrap_or("lecture.mp4")
                    .to_string();

                // validate extension
                let ext = orig_name
                    .rsplit('.')
                    .next()
                    .unwrap_or("")
                    .to_lowercase();

                if !["mp4", "webm", "mov", "avi", "mkv"].contains(&ext.as_str()) {
                    return Err(AppError::Validation(
                        "Chỉ chấp nhận mp4, webm, mov, avi, mkv".into(),
                    ));
                }

                // generate filename
                let now = chrono::Utc::now()
                    .format("%Y-%m-%dT%H-%M-%S%.3fZ")
                    .to_string();

                let filename = format!("{}-{}", now, orig_name);

                let filepath = format!("{}/{}", state.upload_dir, filename);

                // create file
                let mut file = tokio::fs::File::create(&filepath).await?;

                let mut field = field;

                // stream video chunks to disk
                while let Some(chunk) = field
                    .chunk()
                    .await
                    .map_err(|e| AppError::Validation(e.to_string()))?
                {
                    file.write_all(&chunk).await?;
                }

                video_filename = Some(filename);
            }

            // ── DURATION ─────────────────────────
            "durationSec" => {
                let val = field.text().await.unwrap_or_default();
                duration_sec = val.parse().unwrap_or(0);
            }

            _ => {}
        }
    }

    // kiểm tra video tồn tại
    let filename = video_filename
        .ok_or_else(|| AppError::Validation("Video file is required".into()))?;

    // URL để frontend load
    let video_url = format!("/uploads/{}", filename);

    // update DB
    sqlx::query(
        "UPDATE lectures SET video_url = ?, duration_sec = ? WHERE id = ?",
    )
    .bind(&video_url)
    .bind(duration_sec)
    .bind(&lecture_id)
    .execute(&state.db)
    .await?;

    Ok(Json(json!({
        "message": "Video uploaded successfully",
        "videoUrl": video_url,
        "durationSec": duration_sec
    })))
}
// ─── DELETE /instructor/lectures/:lecture_id/video ───────────────────────────

pub async fn delete_lecture_video(
    State(state): State<AppState>,
    Path(lecture_id): Path<String>,
) -> AppResult<Json<Value>> {
    // Lấy tên file cũ để xóa
    let row: Option<(Option<String>,)> =
        sqlx::query_as("SELECT video_url FROM lectures WHERE id = ?")
            .bind(&lecture_id)
            .fetch_optional(&state.db)
            .await?;

    if let Some((Some(url),)) = row {
        // Xóa file vật lý
        let filename = url.trim_start_matches("/images/");
        let path = format!("images/{}", filename);
        let _ = tokio::fs::remove_file(&path).await;
    }

    sqlx::query("UPDATE lectures SET video_url = NULL, duration_sec = 0 WHERE id = ?")
        .bind(&lecture_id)
        .execute(&state.db)
        .await?;

    Ok(Json(json!({ "message": "Video deleted" })))
}