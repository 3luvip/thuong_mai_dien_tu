// src/routes/instructor.rs

use axum::{
    Router, extract::DefaultBodyLimit, routing::{delete, get, patch, post, put}
};
use crate::{controllers::instructor::update_course, state::AppState};
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
    delete_course,
    set_course_discount,
};

pub fn instructor_routes() -> Router<AppState> {
    Router::new()
        // ── Courses ──────────────────────────────────────────────────────────
        .route("/my-courses/{instructor_id}",         get(get_my_courses))
        .route("/courses/{course_id}",                delete(delete_course))
        .route("/courses/{course_id}",                patch(update_course))
        .route("/courses/{course_id}/discount",       patch(set_course_discount))
        // ── Curriculum ───────────────────────────────────────────────────────
        .route("/course-curriculum/{course_id}",      get(get_course_curriculum))
        // ── Sections CRUD ────────────────────────────────────────────────────
        .route("/sections",                           post(create_section))
        .route("/sections/{section_id}",              put(update_section))
        .route("/sections/{section_id}",              delete(delete_section))
        // ── Lectures CRUD ────────────────────────────────────────────────────
        .route("/lectures",                           post(create_lecture))
        .route("/lectures/{lecture_id}",              put(update_lecture))
        .route("/lectures/{lecture_id}",              delete(delete_lecture))
        // ── Video upload (2 GiB limit) ───────────────────────────────────────
        .route("/lectures/{lecture_id}/upload-video", post(upload_lecture_video))
        .layer(DefaultBodyLimit::max(2 * 1024 * 1024 * 1024))
        .route("/lectures/{lecture_id}/video",        delete(delete_lecture_video))
}