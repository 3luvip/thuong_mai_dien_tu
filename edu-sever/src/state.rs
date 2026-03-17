use sqlx::MySqlPool;

#[derive(Clone)]
pub struct AppState {
    pub db: MySqlPool,
    pub jwt_secret: String,
    pub upload_dir: String
}