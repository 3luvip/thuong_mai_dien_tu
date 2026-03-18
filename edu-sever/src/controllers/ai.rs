use axum::{Json, extract::State};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::errors::AppResult;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct SuggestRequest {
    pub query: String,
    pub limit: Option<usize>,
}

#[derive(Serialize, Deserialize, Clone)]
struct Suggestion {
    title: String,
    category: String,
    url: String,
}

#[derive(sqlx::FromRow)]
struct CandidateRow {
    course_id: String,
    title: String,
    category: String,
    course_sub: String,
    card_id: Option<String>,
}

fn make_url(card_id: &Option<String>, course_id: &str) -> String {
    match card_id {
        Some(id) => format!("/course-detail/{}", id),
        None => format!("/course-detail/{}", course_id),
    }
}

fn pick_top(candidates: &[CandidateRow], limit: usize) -> Vec<Suggestion> {
    candidates
        .iter()
        .take(limit)
        .map(|c| Suggestion {
            title: c.title.clone(),
            category: c.category.clone(),
            url: make_url(&c.card_id, &c.course_id),
        })
        .collect()
}

fn extract_json(text: &str) -> &str {
    if let Some(start) = text.find("```") {
        let rest = &text[start + 3..];
        if let Some(end) = rest.find("```") {
            return &rest[..end];
        }
    }
    text
}

pub async fn suggest(
    State(state): State<AppState>,
    Json(payload): Json<SuggestRequest>,
) -> AppResult<Json<Value>> {
    let query = payload.query.trim();
    if query.len() < 2 {
        return Ok(Json(json!({ "suggestions": [] })));
    }

    let limit = payload.limit.unwrap_or(8).clamp(1, 10);
    let like = format!("%{}%", query);

    let candidates: Vec<CandidateRow> = sqlx::query_as(
        r#"SELECT
               c.id AS course_id,
               c.title,
               c.category,
               c.course_sub,
               cc.id AS card_id
           FROM courses c
           LEFT JOIN course_cards cc ON cc.course_detail_id = c.id
           WHERE c.title LIKE ? OR c.category LIKE ? OR c.course_sub LIKE ?
           ORDER BY c.created_at DESC
           LIMIT 50"#,
    )
    .bind(&like)
    .bind(&like)
    .bind(&like)
    .fetch_all(&state.db)
    .await?;

    // If no API key, return DB-only suggestions
    let api_key = std::env::var("ANTHROPIC_API_KEY").ok();
    if api_key.is_none() {
        return Ok(Json(json!({ "suggestions": pick_top(&candidates, limit) })));
    }

    let model = std::env::var("ANTHROPIC_MODEL").unwrap_or_else(|_| "claude-3-5-haiku-20241022".to_string());

    let candidate_list: Vec<String> = candidates
        .iter()
        .take(30)
        .map(|c| format!("{} | {} | {}", c.title, c.category, c.course_sub))
        .collect();

    let prompt = format!(
        "User query: \"{}\"\nCandidates:\n{}\n\nReturn top {} suggestions as JSON array:\n[{{\"title\":\"...\",\"category\":\"...\",\"url\":\"/course-detail/<id>\"}}]",
        query,
        candidate_list.join("\n"),
        limit
    );

    #[derive(Serialize)]
    struct Msg<'a> { role: &'a str, content: &'a str }

    #[derive(Serialize)]
    struct AnthropicRequest<'a> {
        model: &'a str,
        max_tokens: u32,
        messages: Vec<Msg<'a>>,
    }

    #[derive(Deserialize)]
    struct ContentBlock { #[serde(rename = "type")] kind: String, text: Option<String> }
    #[derive(Deserialize)]
    struct AnthropicResponse { content: Vec<ContentBlock> }

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key.unwrap())
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&AnthropicRequest {
            model: &model,
            max_tokens: 512,
            messages: vec![Msg { role: "user", content: &prompt }],
        })
        .send()
        .await;

    if let Ok(r) = resp {
        if let Ok(body) = r.json::<AnthropicResponse>().await {
            let text = body
                .content
                .iter()
                .find(|c| c.kind == "text")
                .and_then(|c| c.text.as_ref())
                .cloned()
                .unwrap_or_default();

            let json_text = extract_json(text.trim());
            if let Ok(list) = serde_json::from_str::<Vec<Suggestion>>(json_text) {
                return Ok(Json(json!({ "suggestions": list })));
            }
        }
    }

    Ok(Json(json!({ "suggestions": pick_top(&candidates, limit) })))
}
