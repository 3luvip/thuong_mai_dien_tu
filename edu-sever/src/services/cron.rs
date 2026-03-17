use bigdecimal::ToPrimitive;
use sqlx::MySqlPool;
use tokio_cron_scheduler::{Job, JobScheduler};
use tracing::{error, info};

pub async fn start_discount_cron(pool: MySqlPool) {
    let scheduler = JobScheduler::new()
        .await
        .expect("Failed to create scheduler");

    let job = Job::new_async("0 */2 * * * *", move |_uuid, _lock| {
        let pool = pool.clone();
        Box::pin(async move {
            match apply_discounts(&pool).await {
                Ok(n) if n > 0 => info!("Discount cron: updated {} cards", n),
                Ok(_) => {}
                Err(e) => error!("Discount cron error: {}", e),
            }
        })
    })
    .expect("Failed to create cron job");

    scheduler.add(job).await.expect("Failed to add cron job");
    scheduler.start().await.expect("Failed to start scheduler");
    info!("✅ Discount cron started (every 2 minutes)");
}

#[derive(sqlx::FromRow)]
struct CardPriceRow {
    id: String,
    price: bigdecimal::BigDecimal,
    current_price: bigdecimal::BigDecimal,
}

async fn apply_discounts(pool: &MySqlPool) -> Result<u64, sqlx::Error> {
    let cards: Vec<CardPriceRow> = sqlx::query_as(
        r#"SELECT id, price, current_price
        FROM course_cards
        WHERE TIMESTAMPDIFF(HOUR, created_at, NOW()) >= 48
          AND current_price != price"#
    )
    .fetch_all(pool)
    .await?;

    let mut count: u64 = 0;
    for card in cards {
        let current = card.current_price.to_f64().unwrap_or(0.0);
        let new_price = (current / 2.0).floor();
        sqlx::query("UPDATE course_cards SET current_price = ? WHERE id = ?")
            .bind(new_price)
            .bind(&card.id)
            .execute(pool)
            .await?;
        count += 1;
    }
    Ok(count)
}