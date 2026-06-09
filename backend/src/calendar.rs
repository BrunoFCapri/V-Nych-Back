use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use chrono::{DateTime, Utc};
use uuid::Uuid;
use crate::AppState;
use crate::users::Claims;

#[derive(Serialize, Deserialize, Debug, FromRow)]
pub struct Event {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub original_tz: String,
    pub status: String,
    pub transparency: String,
    pub visibility: String,
    pub rrule: Option<String>,
    pub exdates: Option<Vec<String>>,
    pub parent_event_id: Option<Uuid>,
    pub recurrence_id: Option<DateTime<Utc>>,
    pub color: String,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}


#[derive(Serialize, Deserialize, Debug)]
pub struct CreateEventPayload {
    pub title: String,
    pub description: Option<String>,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub original_tz: Option<String>,
    pub status: Option<String>,
    pub transparency: Option<String>,
    pub visibility: Option<String>,
    pub rrule: Option<String>,
    pub exdates: Option<Vec<String>>,
    pub parent_event_id: Option<Uuid>,
    pub recurrence_id: Option<DateTime<Utc>>,
    pub color: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateEventPayload {
    pub title: Option<String>,
    pub description: Option<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub original_tz: Option<String>,
    pub status: Option<String>,
    pub transparency: Option<String>,
    pub visibility: Option<String>,
    pub rrule: Option<String>,
    pub exdates: Option<Vec<String>>,
    pub recurrence_id: Option<DateTime<Utc>>,
    pub color: Option<String>,
}

// Filter params for GET /api/calendar
#[derive(Deserialize, Debug)]
pub struct EventFilterCmd {
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
}


// --- Handlers ---

// Create Event
pub async fn create_event(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateEventPayload>,
) -> Result<(StatusCode, Json<Event>), (StatusCode, String)> {
    
    let user_id = claims.user_id;

    let event = sqlx::query_as::<_, Event>(
        r#"
        INSERT INTO events (
            user_id, title, description, start_time, end_time, 
            original_tz, status, transparency, visibility, rrule, exdates,
            parent_event_id, recurrence_id, color
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::TEXT[], $12::UUID, $13::TIMESTAMPTZ, $14)
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(payload.start_time)
    .bind(payload.end_time)
    .bind(payload.original_tz.unwrap_or_else(|| "UTC".to_string()))
    .bind(payload.status.unwrap_or_else(|| "confirmed".to_string()))
    .bind(payload.transparency.unwrap_or_else(|| "opaque".to_string()))
    .bind(payload.visibility.unwrap_or_else(|| "private".to_string()))
    .bind(&payload.rrule)
    .bind(&payload.exdates)
    .bind(payload.parent_event_id)
    .bind(payload.recurrence_id)
    .bind(payload.color.unwrap_or_else(|| "#3b82f6".to_string()))
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create event: {:?}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create event: {}", e))
    })?;

    Ok((StatusCode::CREATED, Json(event)))
}

// List Events (with optional date range filter)
pub async fn list_events(
    State(state): State<AppState>,
    claims: Claims,
    Query(params): Query<EventFilterCmd>,
) -> Result<Json<Vec<Event>>, StatusCode> {
    
    let user_id = claims.user_id;

    let events = if let (Some(start), Some(end)) = (params.start_date, params.end_date) {
        // Filter by range overlap
        sqlx::query_as::<_, Event>(
            r#"
            SELECT * FROM events 
            WHERE user_id = $1 
            AND (start_time < $3 AND end_time > $2)
            ORDER BY start_time ASC
            "#
        )
        .bind(user_id)
        .bind(start)
        .bind(end)
        .fetch_all(&state.db)
        .await
    } else {
        // No filter, return all (maybe limit?)
        sqlx::query_as::<_, Event>(
            "SELECT * FROM events WHERE user_id = $1 ORDER BY start_time ASC LIMIT 100"
        )
        .bind(user_id)
        .fetch_all(&state.db)
        .await
    };

    let events = events.map_err(|e| {
            tracing::error!("Failed to fetch events: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(events))
}

// Get Single Event
pub async fn get_event(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<Json<Event>, StatusCode> {
    let event = sqlx::query_as::<_, Event>("SELECT * FROM events WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.user_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch event: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(event))
}

// Update Event
pub async fn update_event(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateEventPayload>,
) -> Result<Json<Event>, StatusCode> {
    // Dynamic update query building ideally, but for now specific fields or helper needed
    // Using COALESCE to only update provided fields is a common pattern in raw SQL 
    // but gets verbose. Let's do a fetch-modify-save or a smarter query.
    // For brevity, we'll assume a full update or handle simpler case. 
    
    // Actually, let's use a structured UPDATE with COALESCE for each field
    // Note: If you want to unset a field to NULL, this pattern doesn't work well 
    // without Option<Option<T>>. Assuming standard partial updates here.

    let event = sqlx::query_as::<_, Event>(
        r#"
        UPDATE events SET
            title = COALESCE($2, title),
            description = COALESCE($3, description),
            start_time = COALESCE($4, start_time),
            end_time = COALESCE($5, end_time),
            original_tz = COALESCE($6, original_tz),
            status = COALESCE($7, status),
            transparency = COALESCE($8, transparency),
            visibility = COALESCE($9, visibility),
            rrule = COALESCE($10, rrule),
            exdates = COALESCE($11, exdates),
            recurrence_id = COALESCE($12, recurrence_id),
            color = COALESCE($13, color),
            updated_at = NOW()
        WHERE id = $1 AND user_id = $14
        RETURNING *
        "#
    )
    .bind(id)
    .bind(payload.title)
    .bind(payload.description)
    .bind(payload.start_time)
    .bind(payload.end_time)
    .bind(payload.original_tz)
    .bind(payload.status)
    .bind(payload.transparency)
    .bind(payload.visibility)
    .bind(payload.rrule)
    .bind(payload.exdates)
    .bind(payload.recurrence_id)
    .bind(payload.color)
    .bind(claims.user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update event: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(event))
}


// Delete Event
pub async fn delete_event(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM events WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.user_id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete event: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }
    
    Ok(StatusCode::NO_CONTENT)
}
