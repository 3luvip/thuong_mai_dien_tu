use crate::errors::AppError;

pub async fn save_upload(
    upload_dir: &str,
    data: Vec<u8>,
    original_name: &str,
) -> Result<(String, String), AppError> {
    let now = chrono::Utc::now()
        .format("%Y-%m-%dT%H-%M-%S%.3fZ")
        .to_string();
    let filename = format!("{}-{}", now, original_name);
    let filepath = format!("{}/{}", upload_dir, filename);
    tokio::fs::write(&filepath, &data).await;
    Ok((filepath, filename))
}


pub fn format_vnd(value: f64) -> String {
    let n = value as u64;
    let s = n.to_string();
    let mut result = String::new();
    for (i, ch) in s.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            result.push('.');
        }
        result.push(ch);
    }
    result.chars().rev().collect()
}