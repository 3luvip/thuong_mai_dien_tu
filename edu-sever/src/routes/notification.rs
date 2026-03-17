// ═══════════════════════════════════════════════════════════════════════════════
// src/routes/notification.rs  — TẠO MỚI
// ═══════════════════════════════════════════════════════════════════════════════
//
// Route prefix là /notifications (đăng ký trong main.rs)
// Dùng prefix rõ ràng để tránh conflict /:userId vs /item/:id vs /user/:id

use axum::{
    Router,
    routing::{delete, get, patch},
};

use crate::controllers::notification::{
    delete_notification, get_notifications, mark_all_read, mark_one_read,
};
use crate::state::AppState;

pub fn notification_routes() -> Router<AppState> {
    Router::new()
        // GET  /notifications/:userId          → lấy danh sách + unread count
        .route("/{userId}",               get(get_notifications))
        // PATCH /notifications/user/:userId/read-all → đánh dấu tất cả đã đọc
        .route("/user/{userId}/read-all", patch(mark_all_read))
        // PATCH /notifications/item/:notifId/read   → đánh dấu 1 thông báo đã đọc
        .route("/item/{notifId}/read",    patch(mark_one_read))
        // DELETE /notifications/item/:notifId       → xóa 1 thông báo
        .route("/item/{notifId}",         delete(delete_notification))
}