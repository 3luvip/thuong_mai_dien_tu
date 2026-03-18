
use crate::controllers::cart::handler::{add_to_cart, clear_cart, get_cart, remove_from_cart};
use crate::controllers::coupon::handler::{apply_coupon, confirm_coupon};
use crate::controllers::course::{create_course, create_course_card, create_course_instruction, get_all_courses, get_categories, get_course, get_course_cards, get_course_detail_full, get_footer};
use crate::controllers::order::handler::{checkout, get_my_orders};
use crate::controllers::review::handler::create_review;
use crate::state::AppState;
use axum::{
    Router,
    routing::{delete, get, post},
};

pub fn course_routes() -> Router<AppState> {
    Router::new()
        .route("/course-creation-form", post(create_course))
        .route("/course-detail/{id}", get(get_course))
        .route("/course-card", get(get_course_cards))
        .route("/all-courses", get(get_all_courses))
        .route("/course-home-card", post(create_course_card))
        .route("/courseInstruction", post(create_course_instruction))
        .route("/get-cart/{userId}", get(get_cart))
        .route("/add-cart", post(add_to_cart))
        .route("/remove-cart", delete(remove_from_cart))
        .route("/clear-cart/{userId}", delete(clear_cart)) 
        .route("/footer", get(get_footer))
        .route("/apply-coupon", post(apply_coupon))
        .route("/confirm-coupon", post(confirm_coupon))
        .route(
            "/course-detail-full/{course_card_id}",
            get(get_course_detail_full),
        )
        .route("/categories", get(get_categories))
}

pub fn order_routes() -> Router<AppState> {
    Router::new()
        .route("/checkout", post(checkout))
        .route("/my-orders/{user_id}", get(get_my_orders))
}
pub fn review_routes() -> Router<AppState> {
    Router::new().route("/", post(create_review))
}
