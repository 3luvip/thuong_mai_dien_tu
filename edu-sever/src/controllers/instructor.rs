// src/controllers/instructor.rs

use crate::models::instructior::{
    CourseRow, CreateLectureRequest, CreateSectionRequest, LectureRow, SectionRow,
    UpdateLectureRequest, UpdateSectionRequest,
};
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

// ─── GET /instructor/my-courses/:instructor_id ────────────────────────────────

pub async fn get_my_courses(
    State(state): State<AppState>,
    Path(instructor_id): Path<String>,
) -> AppResult<Json<Value>> {

    #[derive(sqlx::FromRow)]
    struct CourseStatsRow {
        id:             String,
        title:          String,
        course_sub:     String,
        description:    String,
        price:          bigdecimal::BigDecimal,
        language:       String,
        level:          String,
        category:       String,
        path:           String,
        author:         String,      // ← thêm
        created_at:     chrono::NaiveDateTime,
        students:       Option<i64>,
        section_count:  Option<i64>,
        lecture_count:  Option<i64>,
        avg_rating:     Option<f64>,
        // Giá giảm từ course_cards (nếu có)
        current_price:  Option<bigdecimal::BigDecimal>,
        card_id:        Option<String>,
    }

    let courses: Vec<CourseStatsRow> = sqlx::query_as(
        r#"SELECT
               c.id,
               c.title,
               c.course_sub,
               c.description,
               c.price,
               c.language,
               c.level,
               c.category,
               c.path,
               c.author,
               c.created_at,
               (
                   SELECT COUNT(DISTINCT o.user_id)
                   FROM order_items oi
                   JOIN orders o ON o.id = oi.order_id
                   WHERE oi.course_id = c.id AND o.status = 'paid'
               ) AS students,
               (
                   SELECT COUNT(*)
                   FROM sections s
                   WHERE s.course_id = c.id
               ) AS section_count,
               (
                   SELECT COUNT(l.id)
                   FROM lectures l
                   JOIN sections s ON s.id = l.section_id
                   WHERE s.course_id = c.id
               ) AS lecture_count,
               (
                   SELECT AVG(CAST(r.rating AS DOUBLE))
                   FROM reviews r
                   WHERE r.course_id = c.id
               ) AS avg_rating,
               cc.current_price,
               cc.id AS card_id
           FROM courses c
           LEFT JOIN course_cards cc ON cc.course_detail_id = c.id
           WHERE c.instructor_id = ?
           ORDER BY c.created_at DESC"#,
    )
    .bind(&instructor_id)
    .fetch_all(&state.db)
    .await?;

    let result: Vec<Value> = courses
        .into_iter()
        .map(|c| {
            let price = c.price.to_f64().unwrap_or(0.0);
            let current_price = c.current_price.as_ref().and_then(|v| v.to_f64());
            json!({
                "id":           c.id,
                "title":        c.title,
                "author":       c.author,      // ← thêm
                "courseSub":    c.course_sub,
                "description":  c.description,
                "price":        price,
                "currentPrice": current_price,
                "cardId":       c.card_id,
                "language":     c.language,
                "level":        c.level,
                "category":     c.category,
                "filename":     c.path,
                "createdAt":    c.created_at.format("%Y-%m-%d").to_string(),
                "stats": {
                    "students":  c.students.unwrap_or(0),
                    "sections":  c.section_count.unwrap_or(0),
                    "lectures":  c.lecture_count.unwrap_or(0),
                    "avgRating": c.avg_rating.unwrap_or(0.0),
                }
            })
        })
        .collect();

    Ok(Json(json!({ "courses": result })))
}

// ─── DELETE /instructor/courses/:course_id ────────────────────────────────────
// Chỉ xóa được khóa học của chính mình và chưa có học viên mua

pub async fn delete_course(
    State(state): State<AppState>,
    Path(course_id): Path<String>,
) -> AppResult<StatusCode> {
    // Kiểm tra course tồn tại
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT instructor_id FROM courses WHERE id = ?"
    )
    .bind(&course_id)
    .fetch_optional(&state.db)
    .await?;

    row.ok_or_else(|| AppError::NotFound("Course not found".into()))?;

    // Kiểm tra đã có học viên mua chưa
    let (paid_count,): (i64,) = sqlx::query_as(
        r#"SELECT COUNT(*) FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           WHERE oi.course_id = ? AND o.status = 'paid'"#,
    )
    .bind(&course_id)
    .fetch_one(&state.db)
    .await?;

    if paid_count > 0 {
        return Err(AppError::Validation(
            format!(
                "Cannot delete: {} student(s) have already purchased this course.",
                paid_count
            )
        ));
    }

    // Xóa course (CASCADE sẽ xóa sections, lectures, course_cards, ...)
    sqlx::query("DELETE FROM courses WHERE id = ?")
        .bind(&course_id)
        .execute(&state.db)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

// ─── PATCH /instructor/courses/:course_id/discount ───────────────────────────
// Cập nhật current_price trên course_cards (giảm giá)

#[derive(Debug, Deserialize)]
pub struct SetDiscountRequest {
    /// None = xóa giảm giá (reset về giá gốc)
    pub discount_price: Option<f64>,
}

pub async fn set_course_discount(
    State(state): State<AppState>,
    Path(course_id): Path<String>,
    Json(body): Json<SetDiscountRequest>,
) -> AppResult<Json<Value>> {
    // Lấy giá gốc
    let row: Option<(bigdecimal::BigDecimal, Option<String>)> = sqlx::query_as(
        "SELECT c.price, cc.id FROM courses c LEFT JOIN course_cards cc ON cc.course_detail_id = c.id WHERE c.id = ?"
    )
    .bind(&course_id)
    .fetch_optional(&state.db)
    .await?;

    let (original_price, card_id) = row
        .ok_or_else(|| AppError::NotFound("Course not found".into()))?;

    let orig = original_price.to_f64().unwrap_or(0.0);

    // Validate discount price
    if let Some(dp) = body.discount_price {
        if dp <= 0.0 {
            return Err(AppError::Validation("Discount price must be > 0".into()));
        }
        if dp >= orig {
            return Err(AppError::Validation(
                format!("Discount price ({}) must be less than original price ({}).", dp, orig)
            ));
        }
    }

    let new_price = body.discount_price.unwrap_or(orig);

    // Cập nhật course_cards nếu có
    if let Some(cid) = card_id {
        sqlx::query("UPDATE course_cards SET current_price = ? WHERE id = ?")
            .bind(new_price)
            .bind(&cid)
            .execute(&state.db)
            .await?;
    } else {
        // Chưa có card → tạo mới card với current_price
        let new_card_id = Uuid::new_v4().to_string();
        // Lấy thêm thông tin cần thiết để tạo card
        #[derive(sqlx::FromRow)]
        struct CourseBasic {
            title: String,
            author: String,
            path: String,
            instructor_id: String,
        }
        let info: Option<CourseBasic> = sqlx::query_as(
            "SELECT title, author, path, instructor_id FROM courses WHERE id = ?"
        )
        .bind(&course_id)
        .fetch_optional(&state.db)
        .await?;

        if let Some(info) = info {
            sqlx::query(
                r#"INSERT INTO course_cards
                   (id, title, author, price, current_price, path, filename, instructor_id, course_detail_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
            )
            .bind(&new_card_id)
            .bind(&info.title)
            .bind(&info.author)
            .bind(orig)
            .bind(new_price)
            .bind(&info.path)
            .bind(&info.path)
            .bind(&info.instructor_id)
            .bind(&course_id)
            .execute(&state.db)
            .await?;
        }
    }

    let message = if body.discount_price.is_some() {
        format!("Discount set: {} ₫ (was {} ₫)", new_price as i64, orig as i64)
    } else {
        "Discount removed — price reset to original".to_string()
    };

    Ok(Json(json!({
        "message":      message,
        "originalPrice": orig,
        "currentPrice":  new_price,
        "discountPct":   if orig > 0.0 { ((orig - new_price) / orig * 100.0).round() } else { 0.0 },
    })))
}

// ─── GET /instructor/course-curriculum/:course_id ─────────────────────────────

pub async fn get_course_curriculum(
    State(state): State<AppState>,
    Path(course_id): Path<String>,
) -> AppResult<Json<Value>> {
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

pub async fn create_section(
    State(state): State<AppState>,
    Json(body): Json<CreateSectionRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    if body.title.trim().is_empty() {
        return Err(AppError::Validation("Section title cannot be empty".into()));
    }

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

pub async fn create_lecture(
    State(state): State<AppState>,
    Json(body): Json<CreateLectureRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    if body.title.trim().is_empty() {
        return Err(AppError::Validation("Lecture title cannot be empty".into()));
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
            "video" => {
                let orig_name = field
                    .file_name()
                    .unwrap_or("lecture.mp4")
                    .to_string();

                let ext = orig_name
                    .rsplit('.')
                    .next()
                    .unwrap_or("")
                    .to_lowercase();

                if !["mp4", "webm", "mov", "avi", "mkv"].contains(&ext.as_str()) {
                    return Err(AppError::Validation(
                        "Only mp4, webm, mov, avi, mkv accepted".into(),
                    ));
                }

                let now = chrono::Utc::now()
                    .format("%Y-%m-%dT%H-%M-%S%.3fZ")
                    .to_string();
                let filename = format!("{}-{}", now, orig_name);
                let filepath = format!("{}/{}", state.upload_dir, filename);

                let mut file = tokio::fs::File::create(&filepath).await?;
                let mut field = field;

                while let Some(chunk) = field
                    .chunk()
                    .await
                    .map_err(|e| AppError::Validation(e.to_string()))?
                {
                    file.write_all(&chunk).await?;
                }

                video_filename = Some(filename);
            }
            "durationSec" => {
                let val = field.text().await.unwrap_or_default();
                duration_sec = val.parse().unwrap_or(0);
            }
            _ => {}
        }
    }

    let filename = video_filename
        .ok_or_else(|| AppError::Validation("Video file is required".into()))?;

    let video_url = format!("/uploads/{}", filename);

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
    let row: Option<(Option<String>,)> =
        sqlx::query_as("SELECT video_url FROM lectures WHERE id = ?")
            .bind(&lecture_id)
            .fetch_optional(&state.db)
            .await?;

    if let Some((Some(url),)) = row {
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

// ─── PATCH /instructor/courses/:course_id ────────────────────────────────────
// Cập nhật thông tin khóa học (multipart — ảnh là optional)
// Thêm hàm này vào cuối file src/controllers/instructor.rs
// Và import thêm: use serde::Deserialize; (đã có ở đầu file)

pub async fn update_course(
    State(state): State<AppState>,
    Path(course_id): Path<String>,
    mut multipart: Multipart,
) -> AppResult<Json<Value>> {
    // Kiểm tra course tồn tại
    let exists: Option<(String,)> = sqlx::query_as(
        "SELECT instructor_id FROM courses WHERE id = ?"
    )
    .bind(&course_id)
    .fetch_optional(&state.db)
    .await?;

    exists.ok_or_else(|| AppError::NotFound("Course not found".into()))?;

    // Parse multipart fields
    let mut title:       Option<String> = None;
    let mut author:      Option<String> = None;
    let mut course_sub:  Option<String> = None;
    let mut description: Option<String> = None;
    let mut price_str:   Option<String> = None;
    let mut language:    Option<String> = None;
    let mut level:       Option<String> = None;
    let mut category:    Option<String> = None;
    let mut new_path:    Option<String> = None;
    let mut new_filename:Option<String> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::Validation(e.to_string()))?
    {
        let name = field.name().unwrap_or("").to_string();
        match name.as_str() {
            "image" => {
                let orig = field.file_name().unwrap_or("upload.jpg").to_string();
                let data = field
                    .bytes()
                    .await
                    .map_err(|e| AppError::Validation(e.to_string()))?
                    .to_vec();
                if !data.is_empty() {
                    let (p, f) = crate::utils::save_upload(&state.upload_dir, data, &orig).await?;
                    new_path     = Some(p);
                    new_filename = Some(f);
                }
            }
            "title"       => title       = Some(field.text().await.unwrap_or_default()),
            "author"      => author      = Some(field.text().await.unwrap_or_default()),
            "courseSub"   => course_sub  = Some(field.text().await.unwrap_or_default()),
            "description" => description = Some(field.text().await.unwrap_or_default()),
            "price"       => price_str   = Some(field.text().await.unwrap_or_default()),
            "language"    => language    = Some(field.text().await.unwrap_or_default()),
            "level"       => level       = Some(field.text().await.unwrap_or_default()),
            "catogory"    => category    = Some(field.text().await.unwrap_or_default()),
            _ => {}
        }
    }

    // Validate các field nếu được gửi lên
    if let Some(ref t) = title {
        if t.trim().is_empty() { return Err(AppError::Validation("Title cannot be empty".into())); }
        if t.len() > 56 { return Err(AppError::Validation("Title max 56 characters".into())); }
    }
    if let Some(ref a) = author {
        if a.len() > 78 { return Err(AppError::Validation("Author max 78 characters".into())); }
    }
    if let Some(ref s) = course_sub {
        if s.len() > 56 { return Err(AppError::Validation("Short description max 56 characters".into())); }
    }
    if let Some(ref d) = description {
        if d.len() > 5000 { return Err(AppError::Validation("Description max 5000 characters".into())); }
    }
    if let Some(ref lv) = level {
        let valid = ["Beginner Level", "Intermediate Level", "Expert", "All Level"];
        if !valid.contains(&lv.as_str()) {
            return Err(AppError::Validation("Invalid level".into()));
        }
    }
    if let Some(ref lang) = language {
        let valid = ["English", "Hindi", "French", "aymur"];
        if !valid.contains(&lang.as_str()) {
            return Err(AppError::Validation("Invalid language".into()));
        }
    }

    let price_val: Option<f64> = if let Some(ref ps) = price_str {
        let p: f64 = ps.parse().map_err(|_| AppError::Validation("Price must be a number".into()))?;
        if p < 0.0 { return Err(AppError::Validation("Price cannot be negative".into())); }
        Some(p)
    } else { None };

    // Build UPDATE — chỉ set những field được gửi lên
    // Dùng cách đơn giản: lấy row hiện tại rồi merge
    #[derive(sqlx::FromRow)]
    struct CurrentRow {
        title:       String,
        author:      String,
        course_sub:  String,
        description: String,
        price:       bigdecimal::BigDecimal,
        language:    String,
        level:       String,
        category:    String,
        path:        String,
        filename:    String,
    }

    let cur: CurrentRow = sqlx::query_as(
        "SELECT title, author, course_sub, description, price, language, level, category, path, filename
         FROM courses WHERE id = ?"
    )
    .bind(&course_id)
    .fetch_one(&state.db)
    .await?;

    use bigdecimal::ToPrimitive;

    let final_title       = title      .unwrap_or(cur.title);
    let final_author      = author     .unwrap_or(cur.author);
    let final_course_sub  = course_sub .unwrap_or(cur.course_sub);
    let final_description = description.unwrap_or(cur.description);
    let final_price       = price_val  .unwrap_or_else(|| cur.price.to_f64().unwrap_or(0.0));
    let final_language    = language   .unwrap_or(cur.language);
    let final_level       = level      .unwrap_or(cur.level);
    let final_category    = category   .unwrap_or(cur.category);
    let final_path        = new_path   .unwrap_or(cur.path);
    let final_filename    = new_filename.unwrap_or(cur.filename);

    sqlx::query(
        r#"UPDATE courses
           SET title = ?, author = ?, course_sub = ?, description = ?,
               price = ?, language = ?, level = ?, category = ?,
               path = ?, filename = ?
           WHERE id = ?"#,
    )
    .bind(&final_title)
    .bind(&final_author)
    .bind(&final_course_sub)
    .bind(&final_description)
    .bind(final_price)
    .bind(&final_language)
    .bind(&final_level)
    .bind(&final_category)
    .bind(&final_path)
    .bind(&final_filename)
    .bind(&course_id)
    .execute(&state.db)
    .await?;

    // Đồng bộ course_cards nếu có
    let _ = sqlx::query(
        "UPDATE course_cards SET title = ?, author = ?, price = ?, path = ?, filename = ?
         WHERE course_detail_id = ?"
    )
    .bind(&final_title)
    .bind(&final_author)
    .bind(final_price)
    .bind(&final_path)
    .bind(&final_filename)
    .bind(&course_id)
    .execute(&state.db)
    .await;

    Ok(Json(json!({
        "message":  "Course updated successfully",
        "courseId": course_id,
    })))
}