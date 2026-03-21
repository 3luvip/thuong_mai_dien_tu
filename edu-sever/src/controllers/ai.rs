use axum::{Json, extract::State};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::time::Duration;

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

fn simplify_query(query: &str) -> Option<String> {
    let mut cleaned = String::with_capacity(query.len());
    for ch in query.chars() {
        if ch.is_ascii_alphanumeric() || ch == '+' || ch == '#' {
            cleaned.push(ch.to_ascii_lowercase());
        } else {
            cleaned.push(' ');
        }
    }

    let stopwords = [
        "khoa", "hoc", "ve", "cho", "danh", "nguoi", "moi", "co", "ban", "nang", "cao",
        "trung", "cap", "thieu", "ky", "can",
    ];

    let mut terms: Vec<String> = cleaned
        .split_whitespace()
        .filter(|t| !stopwords.contains(t))
        .map(|t| t.to_string())
        .collect();

    if terms.is_empty() {
        return None;
    }

    // Prefer keeping the last 1-2 tokens (usually the skill name)
    if terms.len() > 2 {
        terms = terms[terms.len() - 2..].to_vec();
    }

    Some(terms.join(" "))
}

fn build_search_terms(query: &str) -> Vec<String> {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return vec![];
    }

    let mut set: HashSet<String> = HashSet::new();
    set.insert(q.clone());

    if let Some(simple) = simplify_query(&q) {
        if !simple.is_empty() {
            set.insert(simple);
        }
    }

    // Synonyms and common abbreviations
    let mut tokens: Vec<String> = q
        .split_whitespace()
        .filter(|t| t.chars().all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '#'))
        .map(|t| t.to_string())
        .collect();

    if q.contains("c++") {
        tokens.push("c++".into());
        tokens.push("cpp".into());
    }
    if q.contains("cpp") {
        tokens.push("c++".into());
        tokens.push("cpp".into());
    }
    if q.contains("c#") || q.contains("csharp") {
        tokens.push("c#".into());
        tokens.push("csharp".into());
    }
    if q.contains("js") || q.contains("javascript") {
        tokens.push("js".into());
        tokens.push("javascript".into());
        tokens.push("node".into());
        tokens.push("nodejs".into());
        tokens.push("react".into());
        tokens.push("frontend".into());
        tokens.push("web".into());
    }
    if q.contains("web") {
        tokens.push("web".into());
        tokens.push("frontend".into());
        tokens.push("backend".into());
    }

    for t in tokens {
        if !t.is_empty() {
            set.insert(t);
        }
    }

    let mut out: Vec<String> = set.into_iter().collect();
    out.sort();
    out
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

fn extract_output_text(body: &Value) -> Option<String> {
    let output = body.get("output")?.as_array()?;
    let mut combined = String::new();
    for item in output {
        if let Some(content) = item.get("content").and_then(|v| v.as_array()) {
            for c in content {
                let ctype = c.get("type").and_then(|v| v.as_str()).unwrap_or("");
                if ctype == "output_text" || ctype == "text" {
                    if let Some(t) = c.get("text").and_then(|v| v.as_str()) {
                        combined.push_str(t);
                    }
                }
            }
        }
    }
    if combined.trim().is_empty() {
        None
    } else {
        Some(combined)
    }
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
    let terms = build_search_terms(query);
    if terms.is_empty() {
        return Ok(Json(json!({ "suggestions": [] })));
    }
    tracing::info!("ai.suggest query='{}' terms={:?}", query, terms);

    let mut sql = String::from(
        r#"SELECT
               c.id AS course_id,
               c.title,
               c.category,
               c.course_sub,
               cc.id AS card_id
           FROM courses c
           LEFT JOIN course_cards cc ON cc.course_detail_id = c.id
           WHERE "#,
    );

    for i in 0..terms.len() {
        if i > 0 {
            sql.push_str(" OR ");
        }
        sql.push_str("(c.title LIKE ? OR c.category LIKE ? OR c.course_sub LIKE ?)");
    }

    sql.push_str(" ORDER BY c.created_at DESC LIMIT 50");

    let mut query_builder = sqlx::query_as::<_, CandidateRow>(&sql);
    for term in &terms {
        let like = format!("%{}%", term);
        query_builder = query_builder
            .bind(like.clone())
            .bind(like.clone())
            .bind(like);
    }

    let candidates: Vec<CandidateRow> = query_builder.fetch_all(&state.db).await?;

    // If no API key, return DB-only suggestions with a generic answer
    let api_key = std::env::var("GROQ_API_KEY").ok();
    if api_key.is_none() {
        return Ok(Json(json!({
            "answer": "Minh da tim mot so khoa hoc lien quan den noi dung ban hoi.",
            "suggestions": pick_top(&candidates, limit)
        })));
    }

    let model = std::env::var("GROQ_MODEL").unwrap_or_else(|_| "llama-3.3-70b-versatile".to_string());

    let candidate_list: Vec<String> = candidates
        .iter()
        .take(30)
        .map(|c| format!("{} | {} | {}", c.title, c.category, c.course_sub))
        .collect();

    let developer = "You are a Vietnamese course advisor. Answer the user's question briefly in 1-2 sentences. Do not invent course names. The answer should be plain text (no JSON).";
    let prompt = format!(
        "System: {}\nUser: \"{}\"\nCandidates:\n{}\n",
        developer,
        query,
        candidate_list.join("\n")
    );

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| crate::errors::AppError::Internal(e.to_string()))?;
    let resp = client
        .post("https://api.groq.com/openai/v1/responses")
        .header("Authorization", format!("Bearer {}", api_key.unwrap()))
        .header("content-type", "application/json")
        .json(&json!({
            "model": model,
            "max_output_tokens": 512,
            "input": prompt
        }))
        .send()
        .await;

    if let Ok(r) = resp {
        let status = r.status();
        let body_text = r.text().await.unwrap_or_default();
        tracing::info!("groq status={} body_len={}", status, body_text.len());
        if !status.is_success() {
            tracing::warn!("Groq error status={} body={}", status, body_text);
        } else if let Ok(body) = serde_json::from_str::<Value>(&body_text) {
            if let Some(text) = extract_output_text(&body) {
                let answer = text.trim();
                return Ok(Json(json!({
                    "answer": answer,
                    "suggestions": pick_top(&candidates, limit)
                })));
            } else {
                tracing::warn!("Groq response missing output_text: {}", body_text);
            }
        } else {
            tracing::warn!("Groq response not JSON: {}", body_text);
        }
    }

    Ok(Json(json!({
        "answer": "Minh da tim mot so khoa hoc lien quan den noi dung ban hoi.",
        "suggestions": pick_top(&candidates, limit)
    })))
}

