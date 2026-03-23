use axum::{
    Json,
    extract::{Multipart, State},
    http::StatusCode,
};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{models::{course_instruction::CreateCourseInstructionRequest}, utils};
use crate::state::AppState;
use crate::{
    errors::{AppError, AppResult}
};



pub async fn create_course(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> AppResult<(StatusCode, Json<Value>)> {
    let mut title = String::new();
    let mut author = String::new();
    let mut course_sub = String::new();
    let mut description = String::new();
    let mut price = String::new();
    let mut language = String::new();
    let mut level = String::new();
    let mut category = String::new();
    let mut instructor = String::new();
    let mut file_path: Option<String> = None;
    let mut file_name: Option<String> = None;

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
                    let (p, f) = utils::save_upload(&state.upload_dir, data, &orig).await?;
                    file_path = Some(p);
                    file_name = Some(f);
                }
            }
            "title" => title = field.text().await.unwrap_or_default(),
            "author" => author = field.text().await.unwrap_or_default(),
            "courseSub" => course_sub = field.text().await.unwrap_or_default(),
            "description" => description = field.text().await.unwrap_or_default(),
            "price" => price = field.text().await.unwrap_or_default(),
            "language" => language = field.text().await.unwrap_or_default(),
            "level" => level = field.text().await.unwrap_or_default(),
            "catogory" => category = field.text().await.unwrap_or_default(),
            "instructor" => instructor = field.text().await.unwrap_or_default(),
            _ => {}
        }
    }

    if title.len() > 56 {
        return Err(AppError::Validation(
            "Title must be within 56 characters".into(),
        ));
    }
    if author.len() > 78 {
        return Err(AppError::Validation(
            "Author must be within 78 characters".into(),
        ));
    }
    if course_sub.len() > 56 {
        return Err(AppError::Validation(
            "Sub-title must be within 56 characters".into(),
        ));
    }
    if description.len() > 5000 {
        return Err(AppError::Validation(
            "Description must be within 5000 characters".into(),
        ));
    }
    if !["English", "Hindi", "French", "aymur"].contains(&language.as_str()) {
        return Err(AppError::Validation("Invalid language".into()));
    }
    if ![
        "Beginner Level",
        "Intermediate Level",
        "Expert",
        "All Level",
    ]
    .contains(&level.as_str())
    {
        return Err(AppError::Validation("Invalid level".into()));
    }
    if instructor.is_empty() {
        return Err(AppError::Validation("Instructor ID is required".into()));
    }

    let (path, filename) = file_path
        .zip(file_name)
        .ok_or_else(|| AppError::Validation("Image is required".into()))?;

    let price_num: f64 = price
        .parse()
        .map_err(|_| AppError::Validation("Price must be a number".into()))?;

    let course_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO courses (id, title, author, course_sub, description, price, language, level,
         category, path, filename, instructor_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(&course_id)
    .bind(&title)
    .bind(&author)
    .bind(&course_sub)
    .bind(&description)
    .bind(price_num)
    .bind(&language)
    .bind(&level)
    .bind(&category)
    .bind(&path)
    .bind(&filename)
    .bind(&instructor)
    .execute(&state.db)
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "message": "Course created successfully",
            "courseId": course_id
        })),
    ))
}


pub async fn create_course_card(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> AppResult<(StatusCode, Json<Value>)> {
    let mut title = String::new();
    let mut author = String::new();
    let mut price = String::new();
    let mut instructor = String::new();
    let mut course_details = String::new();
    let mut file_path: Option<String> = None;
    let mut file_name: Option<String> = None;

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
                    let (p, f) = utils::save_upload(&state.upload_dir, data, &orig).await?;
                    file_path = Some(p);
                    file_name = Some(f);
                }
            }
            "title" => title = field.text().await.unwrap_or_default(),
            "author" => author = field.text().await.unwrap_or_default(),
            "price" => price = field.text().await.unwrap_or_default(),
            "instructor" => instructor = field.text().await.unwrap_or_default(),
            "courseDetails" => course_details = field.text().await.unwrap_or_default(),
            _ => {}
        }
    }

    if title.len() > 78 {
        return Err(AppError::Validation(
            "Title must be within 78 characters".into(),
        ));
    }
    if author.len() > 78 {
        return Err(AppError::Validation(
            "Author must be within 78 characters".into(),
        ));
    }
    if instructor.is_empty() {
        return Err(AppError::Validation("Instructor is required".into()));
    }
    if course_details.is_empty() {
        return Err(AppError::Validation("CourseDetails ID is required".into()));
    }

    let (path, filename) = file_path
        .zip(file_name)
        .ok_or_else(|| AppError::Validation("Image is required".into()))?;

    let price_num: f64 = price
        .parse()
        .map_err(|_| AppError::Validation("Price must be a number".into()))?;
    let discounted = (price_num * 0.5).round();

    let card_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO course_cards (id, title, author, price, current_price, path, filename, instructor_id, course_detail_id)
         VALUES (?,?,?,?,?,?,?,?,?)"
    )
    .bind(&card_id).bind(&title).bind(&author).bind(price_num)
    .bind(discounted).bind(&path).bind(&filename)
    .bind(&instructor).bind(&course_details)
    .execute(&state.db).await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "message": "CourseCard created successfully",
            "courseCardId": card_id
        })),
    ))
}



pub async fn create_course_instruction(
    State(state): State<AppState>,
    Json(body): Json<CreateCourseInstructionRequest>,
) -> AppResult<(StatusCode, Json<Value>)> {
    if body.role.len() > 160 {
        return Err(AppError::Validation(
            "Role must be within 160 characters".into(),
        ));
    }
    if body.budget.len() > 160 {
        return Err(AppError::Validation(
            "Budget must be within 160 characters".into(),
        ));
    }
    if body.project_risk.len() > 160 {
        return Err(AppError::Validation(
            "ProjectRisk must be within 160 characters".into(),
        ));
    }
    if body.case_study.len() > 160 {
        return Err(AppError::Validation(
            "CaseStudy must be within 160 characters".into(),
        ));
    }

    let instruction_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO course_instructions (id, role, budget, project_risk, case_study, requirement, about_course)
         VALUES (?,?,?,?,?,?,?)"
    )
    .bind(&instruction_id).bind(&body.role).bind(&body.budget)
    .bind(&body.project_risk).bind(&body.case_study)
    .bind(&body.requirement).bind(&body.about_course)
    .execute(&state.db).await?;

    sqlx::query("UPDATE courses SET course_instruction_id = ? WHERE id = ?")
        .bind(&instruction_id)
        .bind(&body.course_detail_id)
        .execute(&state.db)
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "message": "Instruction added and linked",
            "instructionId": instruction_id
        })),
    ))
}