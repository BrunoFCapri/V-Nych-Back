use axum::{extract::{Query, State}, http::StatusCode, Json};
use serde::Deserialize;
use chrono::{DateTime, Utc};
use crate::AppState;
use sqlx::Row;

#[derive(Deserialize)]
pub struct PublicLinkQuery {
    pub token: String,
    pub until: Option<DateTime<Utc>>,
}

// Handler para obtener disponibilidad pública por link
pub async fn public_availability(
    State(state): State<AppState>,
    Query(params): Query<PublicLinkQuery>,
) -> Result<Json<Vec<(DateTime<Utc>, DateTime<Utc>)>>, StatusCode> {
    // 1. Validar token en base de datos (ejemplo: tabla public_links)
    let row = sqlx::query("SELECT user_id, expires_at FROM public_links WHERE token = $1")
        .bind(&params.token)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let (user_id, expires_at): (uuid::Uuid, DateTime<Utc>) = match row {
        Some(row) => (row.get(0), row.get(1)),
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    // 2. Validar expiración
    let now = Utc::now();
    if now > expires_at {
        return Err(StatusCode::UNAUTHORIZED);
    }
    if let Some(until) = params.until {
        if until > expires_at {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    // 3. Consultar eventos ocupados (solo rangos, no detalles)
    let until = params.until.unwrap_or(expires_at);
    let events = sqlx::query_as::<_, (DateTime<Utc>, DateTime<Utc>)>(
        "SELECT start_time, end_time FROM events WHERE user_id = $1 AND start_time <= $2 AND end_time >= $3 ORDER BY start_time ASC"
    )
    .bind(user_id)
    .bind(until)
    .bind(now)
    .fetch_all(&state.db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(events))
}
