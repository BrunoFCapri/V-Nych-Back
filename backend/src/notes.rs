use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde_json::Value;
use crate::AppState;
use crate::users::Claims;

#[derive(Debug, Serialize, FromRow)]
pub struct Note {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub content: Value, // JSONB
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub parent_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateNoteRequest {
    pub title: String,
    pub content: Value,
    pub parent_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateNoteRequest {
    pub title: Option<String>,
    pub content: Option<Value>,
}

pub async fn list_notes(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<Note>>, (StatusCode, String)> {
    let notes = sqlx::query_as::<_, Note>(
        "SELECT * FROM notes WHERE user_id = $1 ORDER BY updated_at DESC"
    )
    .bind(claims.user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(notes))
}

pub async fn create_note(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateNoteRequest>,
) -> Result<Json<Note>, (StatusCode, String)> {
    tracing::info!("Creating note with payload: {:?}", payload);

    let note = sqlx::query_as::<_, Note>(
        r#"
        INSERT INTO notes (user_id, title, content, parent_id)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#
    )
    .bind(claims.user_id)
    .bind(payload.title)
    .bind(payload.content)
    .bind(payload.parent_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(note))
}

pub async fn get_note(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<Json<Note>, (StatusCode, String)> {
    let note = sqlx::query_as::<_, Note>(
        "SELECT * FROM notes WHERE id = $1 AND user_id = $2"
    )
    .bind(id)
    .bind(claims.user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Note not found".to_string()))?;

    Ok(Json(note))
}

pub async fn update_note(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateNoteRequest>,
) -> Result<Json<Note>, (StatusCode, String)> {
    let note = sqlx::query_as::<_, Note>(
        r#"
        UPDATE notes
        SET title = COALESCE($3, title),
            content = COALESCE($4, content),
            updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING *
        "#
    )
    .bind(id)
    .bind(claims.user_id)
    .bind(payload.title)
    .bind(payload.content)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Note not found".to_string()))?;

    Ok(Json(note))
}

pub async fn delete_note(
    State(state): State<AppState>,  
    claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query(
        "DELETE FROM notes WHERE id = $1 AND user_id = $2"
    )
    .bind(id)
    .bind(claims.user_id)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Note not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}
