use axum::{
    Router,
    routing::{delete, get, patch, post},
};
use crate::controllers::coupon::handler::{
    create_coupon, delete_coupon, list_all_coupons, list_my_coupons, toggle_coupon,
};
use crate::state::AppState;
 
pub fn coupon_routes() -> Router<AppState> {
    Router::new()
        // Admin: xem tất cả coupon
        .route("/",          get(list_all_coupons))
        // Instructor: xem coupon của mình
        .route("/my",        get(list_my_coupons))
        // Cả hai: tạo coupon (scope tự động từ JWT role)
        .route("/",          post(create_coupon))
        // Cả hai: bật/tắt
        .route("/{id}/toggle", patch(toggle_coupon))
        // Cả hai: xóa (chỉ khi chưa dùng)
        .route("/{id}",      delete(delete_coupon))
}