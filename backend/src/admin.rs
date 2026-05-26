use axum::{extract::{State, Path}, http::StatusCode, Json};
use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

use crate::{users::Claims, AppState};

#[derive(Serialize)]
pub struct AdminSummary {
    pub users: i64,
    pub notes: i64,
    pub tasks: i64,
    pub events: i64,
    pub task_lists: i64,
    pub completed_tasks: i64,
    pub starred_tasks: i64,
}

#[derive(Serialize, FromRow)]
pub struct RecentUser {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Serialize, FromRow)]
pub struct RecentTask {
    pub id: Uuid,
    pub title: String,
    pub status: String,
    pub priority: Option<String>,
    pub owner_username: String,
    pub owner_email: String,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Serialize, FromRow)]
pub struct RecentNote {
    pub id: Uuid,
    pub title: String,
    pub owner_username: String,
    pub owner_email: String,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Serialize, FromRow)]
pub struct RecentEvent {
    pub id: Uuid,
    pub title: String,
    pub status: String,
    pub color: String,
    pub owner_username: String,
    pub owner_email: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
}

#[derive(Serialize, FromRow)]
pub struct TaskStatusCount {
    pub status: String,
    pub total: i64,
}

#[derive(Serialize)]
pub struct AdminOverviewResponse {
    pub summary: AdminSummary,
    pub task_status_breakdown: Vec<TaskStatusCount>,
    pub recent_users: Vec<RecentUser>,
    pub recent_tasks: Vec<RecentTask>,
    pub recent_notes: Vec<RecentNote>,
    pub recent_events: Vec<RecentEvent>,
}

pub async fn overview(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<AdminOverviewResponse>, (StatusCode, String)> {
    if !claims.is_admin {
        return Err((StatusCode::FORBIDDEN, "Admin access only".to_string()));
    }

    let users = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users")
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let notes = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM notes")
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let tasks = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM tasks")
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let events = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM events")
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let task_lists = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM task_lists")
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let completed_tasks = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM tasks WHERE status IN ('done', 'completed')",
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let starred_tasks = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM tasks WHERE is_starred = TRUE")
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let task_status_breakdown = sqlx::query_as::<_, TaskStatusCount>(
        "SELECT status, COUNT(*)::bigint AS total FROM tasks GROUP BY status ORDER BY total DESC, status ASC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let recent_users = sqlx::query_as::<_, RecentUser>(
        "SELECT id, username, email, created_at FROM users ORDER BY created_at DESC LIMIT 8",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let recent_tasks = sqlx::query_as::<_, RecentTask>(
        r#"
        SELECT
            tasks.id,
            tasks.title,
            tasks.status,
            tasks.priority,
            tasks.created_at,
            tasks.updated_at,
            tasks.completed_at,
            users.username AS owner_username,
            users.email AS owner_email
        FROM tasks
        LEFT JOIN users ON users.id = tasks.user_id
        ORDER BY tasks.updated_at DESC NULLS LAST, tasks.created_at DESC
        LIMIT 10
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let recent_notes = sqlx::query_as::<_, RecentNote>(
        r#"
        SELECT
            notes.id,
            notes.title,
            users.username AS owner_username,
            users.email AS owner_email,
            notes.created_at,
            notes.updated_at
        FROM notes
        LEFT JOIN users ON users.id = notes.user_id
        ORDER BY notes.updated_at DESC NULLS LAST, notes.created_at DESC
        LIMIT 10
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let recent_events = sqlx::query_as::<_, RecentEvent>(
        r#"
        SELECT
            events.id,
            events.title,
            events.status,
            events.color,
            users.username AS owner_username,
            users.email AS owner_email,
            events.start_time,
            events.end_time
        FROM events
        LEFT JOIN users ON users.id = events.user_id
        ORDER BY events.start_time DESC
        LIMIT 8
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(AdminOverviewResponse {
        summary: AdminSummary {
            users,
            notes,
            tasks,
            events,
            task_lists,
            completed_tasks,
            starred_tasks,
        },
        task_status_breakdown,
        recent_users,
        recent_tasks,
        recent_notes,
        recent_events,
    }))
}

#[derive(Serialize, FromRow)]
pub struct TaskAttachment {
    pub id: Uuid,
    pub filename: String,
    pub mime_type: Option<String>,
    pub uploaded_at: Option<DateTime<Utc>>,
}

#[derive(Serialize, FromRow)]
pub struct UserTask {
    pub id: Uuid,
    pub title: String,
    pub status: String,
    pub priority: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Serialize, FromRow)]
pub struct UserEvent {
    pub id: Uuid,
    pub title: String,
    pub status: String,
    pub color: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
}

#[derive(Serialize, FromRow)]
pub struct UserNote {
    pub id: Uuid,
    pub title: String,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Serialize)]
pub struct UserDetailResponse {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub created_at: Option<DateTime<Utc>>,
    pub task_count: i64,
    pub event_count: i64,
    pub note_count: i64,
    pub attachment_count: i64,
    pub tasks: Vec<UserTask>,
    pub events: Vec<UserEvent>,
    pub notes: Vec<UserNote>,
    pub attachments: Vec<TaskAttachment>,
}

pub async fn user_detail(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
    claims: Claims,
) -> Result<Json<UserDetailResponse>, (StatusCode, String)> {
    if !claims.is_admin {
        return Err((StatusCode::FORBIDDEN, "Admin access only".to_string()));
    }

    // Get user info
    let user = sqlx::query_as::<_, RecentUser>(
        "SELECT id, username, email, created_at FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "User not found".to_string()))?;

    // Get task count
    let task_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM tasks WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Get event count
    let event_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM events WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Get note count
    let note_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM notes WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Get attachment count
    let attachment_count = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(DISTINCT task_attachments.id)
        FROM task_attachments
        JOIN tasks ON tasks.id = task_attachments.task_id
        WHERE tasks.user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Get user tasks
    let tasks = sqlx::query_as::<_, UserTask>(
        r#"
        SELECT id, title, status, priority, created_at, updated_at, completed_at
        FROM tasks
        WHERE user_id = $1
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 20
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Get user events
    let events = sqlx::query_as::<_, UserEvent>(
        r#"
        SELECT id, title, status, color, start_time, end_time
        FROM events
        WHERE user_id = $1
        ORDER BY start_time DESC
        LIMIT 20
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Get user notes
    let notes = sqlx::query_as::<_, UserNote>(
        r#"
        SELECT id, title, created_at, updated_at
        FROM notes
        WHERE user_id = $1
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 20
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Get user attachments
    let attachments = sqlx::query_as::<_, TaskAttachment>(
        r#"
        SELECT DISTINCT ON (task_attachments.id)
            task_attachments.id,
            task_attachments.filename,
            task_attachments.mime_type,
            task_attachments.uploaded_at
        FROM task_attachments
        JOIN tasks ON tasks.id = task_attachments.task_id
        WHERE tasks.user_id = $1
        ORDER BY task_attachments.id, task_attachments.uploaded_at DESC
        LIMIT 20
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(UserDetailResponse {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
        task_count,
        event_count,
        note_count,
        attachment_count,
        tasks,
        events,
        notes,
        attachments,
    }))
}
