// src/routes/instructor.rs

use axum::{
    Router, extract::DefaultBodyLimit, routing::{delete, get, post, put}
};
use crate::state::AppState;
use crate::controllers::instructor::{
    get_my_courses,
    get_course_curriculum,
    create_section,
    update_section,
    delete_section,
    create_lecture,
    update_lecture,
    delete_lecture,
    upload_lecture_video,
    delete_lecture_video,
};

pub fn instructor_routes() -> Router<AppState> {
    Router::new()
        // Courses của giảng viên
        .route("/my-courses/{instructor_id}", get(get_my_courses))
        // Curriculum
        .route("/course-curriculum/{course_id}", get(get_course_curriculum))
        // Sections CRUD
        .route("/sections", post(create_section))
        .route("/sections/{section_id}", put(update_section))
        .route("/sections/{section_id}", delete(delete_section))
        // Lectures CRUD
        .route("/lectures", post(create_lecture))
        .route("/lectures/{lecture_id}", put(update_lecture))
        .route("/lectures/{lecture_id}", delete(delete_lecture))
        // Video upload
        .route("/lectures/{lecture_id}/upload-video", post(upload_lecture_video)).layer(DefaultBodyLimit::max(2 * 1024 * 1024 * 1024))
        .route("/lectures/{lecture_id}/video", delete(delete_lecture_video))
}