// src/main.rs

mod controllers;
mod middleware;
mod models;
mod routes;
mod errors;
mod state;
mod utils;
mod services;

use axum::Router;
use sqlx::{MySql, Pool};
use sqlx::mysql::MySqlPoolOptions;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use state::AppState;
use crate::routes::{
    admin_routes, ai_routes, auth_routes, course_routes, instructor_routes, learning_routes, notification_routes, order_routes, review_routes, user_routes, wishlist_routes, withdrawal_routes
};
use crate::services::cron::start_discount_cron;


#[tokio::main]
async fn main() {
    dotenv::dotenv().ok();
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool: Pool<MySql> = MySqlPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
        .expect("Failed to connect to MySQL");
    tracing::info!("Connected to MySQL");

    let upload_dir = std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());
    tokio::fs::create_dir_all(&upload_dir).await.ok();

    let state = AppState {
        db: pool.clone(),
        jwt_secret: std::env::var("JWT_SECRET")
            .unwrap_or_else(|_| "supersecretesecrete".to_string()),
        upload_dir: upload_dir.clone(),
    };

    start_discount_cron(pool.clone()).await;

    let cors = CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any);

    let app: Router = Router::new()
        .nest("/auth",           auth_routes())
        .nest("/userAuth",       user_routes())
        .nest("/courseCreation", course_routes())
        .nest("/notifications",  notification_routes())
        .nest("/wishlist",       wishlist_routes())
        .nest("/ai",             ai_routes())
        .nest("/orders",         order_routes())
        .nest("/reviews",        review_routes())
        .nest("/instructor",     instructor_routes())
        .nest("/learning",       learning_routes())
        .nest("/withdrawal",     withdrawal_routes())
        .nest("/admin",          admin_routes())
        .nest_service("/uploads", ServeDir::new(&upload_dir))
        .nest_service("/images",  ServeDir::new(&upload_dir))
        .with_state(state)
        .layer(cors);

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse().expect("PORT must be a number");

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Server running on http://{}", addr);
    axum::serve(tokio::net::TcpListener::bind(addr).await.unwrap(), app).await.unwrap();
}