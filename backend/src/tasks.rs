// Endpoint para listar todos los archivos adjuntos del usuario (sin mover archivos físicamente)

pub async fn list_user_attachments(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<TaskAttachment>>, (StatusCode, String)> {
    let attachments = sqlx::query_as::<_, TaskAttachment>(
        r#"
        SELECT ta.id, ta.task_id, ta.filename, ta.mime_type, ta.uploaded_at
        FROM task_attachments ta
        JOIN tasks t ON t.id = ta.task_id
        WHERE t.user_id = $1
        ORDER BY ta.uploaded_at DESC
        "#
    )
    .bind(claims.user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(attachments))
}
// Handler para eliminar un adjunto de una tarea
pub async fn delete_task_attachment(
    State(state): State<AppState>,
    Path((task_id, attachment_id)): Path<(Uuid, Uuid)>,
    claims: Claims,
) -> Result<StatusCode, (StatusCode, String)> {
    // Verifica que la tarea exista y pertenezca al usuario
    let task: Option<Task> = sqlx::query_as("SELECT * FROM tasks WHERE id = $1 AND user_id = $2")
        .bind(task_id)
        .bind(claims.user_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if task.is_none() {
        return Err((StatusCode::NOT_FOUND, "Task not found or not owned by user".to_string()));
    }
    let result = sqlx::query("DELETE FROM task_attachments WHERE id = $1 AND task_id = $2")
        .bind(attachment_id)
        .bind(task_id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Attachment not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}
use sqlx::Row;
use axum::{
    extract::{Path, State, Query},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use crate::AppState;
use crate::users::Claims;

use axum::extract::multipart::Multipart;
use axum::response::{IntoResponse, Response};
use axum::http::{header, HeaderMap, HeaderValue};

#[derive(Debug, Serialize, FromRow)]
pub struct Task {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub list_id: Option<Uuid>,
    pub parent_id: Option<Uuid>,
    pub is_starred: bool,
    pub position: i32,
    pub related_note_id: Option<Uuid>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct TaskList {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub title: String,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub is_default: bool,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub list_id: Option<Uuid>,
    pub parent_id: Option<Uuid>,
    pub related_note_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTaskRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub is_starred: Option<bool>,
    pub list_id: Option<Uuid>,
    pub parent_id: Option<Uuid>,
    pub position: Option<i32>,
    pub related_note_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateListRequest {
    pub title: String,
    pub color: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateListRequest {
    pub title: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TaskFilter {
    pub list_id: Option<Uuid>,
    pub is_starred: Option<bool>,
    pub parent_id: Option<Uuid>,
}

// --- Attachments ---

#[derive(Debug, Serialize, FromRow)]
pub struct TaskAttachment {
    pub id: Uuid,
    pub task_id: Uuid,
    pub filename: String,
    pub mime_type: Option<String>,
    pub uploaded_at: Option<DateTime<Utc>>,
}

// Handler para subir archivos adjuntos a una tarea
// Multipart debe ser el último extractor
pub async fn upload_task_attachment(
    State(state): State<AppState>,
    Path(task_id): Path<Uuid>,
    claims: Claims,
    mut multipart: Multipart,
) -> Result<Json<TaskAttachment>, (StatusCode, String)> {
    // Solo permite un archivo por request
    if let Some(field) = multipart.next_field().await.map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))? {
        let filename = field.file_name().map(|s| s.to_string()).unwrap_or("attachment".to_string());
        let mime_type = field.content_type().map(|s| s.to_string());
        let data = field.bytes().await.map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?.to_vec();

        // Verifica que la tarea exista y pertenezca al usuario
        let task: Option<Task> = sqlx::query_as("SELECT * FROM tasks WHERE id = $1 AND user_id = $2")
            .bind(task_id)
            .bind(claims.user_id)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        if task.is_none() {
            return Err((StatusCode::NOT_FOUND, "Task not found or not owned by user".to_string()));
        }

        let attachment: TaskAttachment = sqlx::query_as(
            r#"
            INSERT INTO task_attachments (task_id, filename, mime_type, data)
            VALUES ($1, $2, $3, $4)
            RETURNING id, task_id, filename, mime_type, uploaded_at
            "#
        )
        .bind(task_id)
        .bind(&filename)
        .bind(&mime_type)
        .bind(&data[..])
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        return Ok(Json(attachment));
    }
    Err((StatusCode::BAD_REQUEST, "No file uploaded".to_string()))
}

// Handler para listar adjuntos de una tarea
pub async fn list_task_attachments(
    State(state): State<AppState>,
    Path(task_id): Path<Uuid>,
    claims: Claims,
) -> Result<Json<Vec<TaskAttachment>>, (StatusCode, String)> {
    // Verifica que la tarea exista y pertenezca al usuario
    let task: Option<Task> = sqlx::query_as("SELECT * FROM tasks WHERE id = $1 AND user_id = $2")
        .bind(task_id)
        .bind(claims.user_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if task.is_none() {
        return Err((StatusCode::NOT_FOUND, "Task not found or not owned by user".to_string()));
    }
    let attachments = sqlx::query_as::<_, TaskAttachment>(
        "SELECT id, task_id, filename, mime_type, uploaded_at FROM task_attachments WHERE task_id = $1 ORDER BY uploaded_at DESC"
    )
    .bind(task_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(attachments))
}

// Handler para descargar un adjunto
pub async fn download_task_attachment(
    State(state): State<AppState>,
    Path((task_id, attachment_id)): Path<(Uuid, Uuid)>,
    claims: Claims,
) -> Result<Response, (StatusCode, String)> {
    // Verifica que la tarea exista y pertenezca al usuario
    let task: Option<Task> = sqlx::query_as("SELECT * FROM tasks WHERE id = $1 AND user_id = $2")
        .bind(task_id)
        .bind(claims.user_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if task.is_none() {
        return Err((StatusCode::NOT_FOUND, "Task not found or not owned by user".to_string()));
    }
    let row = sqlx::query(
        "SELECT filename, mime_type, data FROM task_attachments WHERE id = $1 AND task_id = $2"
    )
    .bind(attachment_id)
    .bind(task_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if let Some(att) = row {
        let filename: String = att.try_get("filename").unwrap_or("attachment".to_string());
        let mime_type: Option<String> = att.try_get("mime_type").ok();
        let data: Vec<u8> = att.try_get("data").unwrap_or_default();
        let mut headers = HeaderMap::new();
        headers.insert(header::CONTENT_TYPE, HeaderValue::from_str(mime_type.as_deref().unwrap_or("application/octet-stream")).unwrap());
        headers.insert(header::CONTENT_DISPOSITION, HeaderValue::from_str(&format!("attachment; filename=\"{}\"", filename)).unwrap());
        Ok((headers, data).into_response())
    } else {
        Err((StatusCode::NOT_FOUND, "Attachment not found".to_string()))
    }
}

// --- List Handlers ---

pub async fn get_lists(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<TaskList>>, (StatusCode, String)> {
    let lists = sqlx::query_as::<_, TaskList>(
        "SELECT * FROM task_lists WHERE user_id = $1 ORDER BY created_at ASC"
    )
    .bind(claims.user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(lists))
}

pub async fn create_list(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateListRequest>,
) -> Result<Json<TaskList>, (StatusCode, String)> {
    let list = sqlx::query_as::<_, TaskList>(
        r#"
        INSERT INTO task_lists (user_id, title, color, icon)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#
    )
    .bind(claims.user_id)
    .bind(payload.title.clone())
    .bind(payload.color)
    .bind(payload.icon)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(list))
}

pub async fn update_list(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    claims: Claims,
    Json(payload): Json<UpdateListRequest>,
) -> Result<Json<TaskList>, (StatusCode, String)> {
    let list = sqlx::query_as::<_, TaskList>(
        r#"
        UPDATE task_lists
        SET title = COALESCE($2, title),
            color = COALESCE($3, color),
            icon = COALESCE($4, icon),
            updated_at = NOW()
        WHERE id = $1 AND user_id = $5
        RETURNING *
        "#
    )
    .bind(id)
    .bind(payload.title.clone())
    .bind(payload.color)
    .bind(payload.icon)
    .bind(claims.user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if matches!(e, sqlx::Error::RowNotFound) {
            (StatusCode::NOT_FOUND, "List not found".to_string())
        } else {
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        }
    })?;

    Ok(Json(list))
}

pub async fn delete_list(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    claims: Claims,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM task_lists WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.user_id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "List not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// --- Task Handlers ---

pub async fn list_tasks(
    State(state): State<AppState>,
    claims: Claims,
    Query(filter): Query<TaskFilter>,
) -> Result<Json<Vec<Task>>, (StatusCode, String)> {
    let mut query_builder = sqlx::QueryBuilder::new("SELECT * FROM tasks WHERE user_id = ");
    query_builder.push_bind(claims.user_id);

    if let Some(list_id) = filter.list_id {
        query_builder.push(" AND list_id = ");
        query_builder.push_bind(list_id);
    }
    
    if let Some(is_starred) = filter.is_starred {
        if is_starred {
             query_builder.push(" AND is_starred = TRUE");
        }
    }

    if let Some(parent_id) = filter.parent_id {
        query_builder.push(" AND parent_id = ");
        query_builder.push_bind(parent_id);
    }

    query_builder.push(" ORDER BY position ASC, created_at DESC");

    let query = query_builder.build_query_as::<Task>();
    let tasks = query
        .fetch_all(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(tasks))
}

pub async fn create_task(
    State(state): State<AppState>,
    claims: Claims,
    Json(payload): Json<CreateTaskRequest>,
) -> Result<Json<Task>, (StatusCode, String)> {
    println!("[CREATE_TASK] user_id: {:?}, payload: {:?}", claims.user_id, payload);
    let title = payload.title.clone();
    let description = payload.description.clone();
    let priority = payload.priority.clone();
    let due_date = payload.due_date.clone();
    let list_id = payload.list_id.clone();
    let parent_id = payload.parent_id.clone();
    let related_note_id = payload.related_note_id.clone();
    let result = sqlx::query_as::<_, Task>(
        r#"
        INSERT INTO tasks (user_id, title, description, priority, due_date, list_id, parent_id, related_note_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#
    )
    .bind(claims.user_id)
    .bind(title)
    .bind(description)
    .bind(priority.unwrap_or_else(|| "medium".to_string()))
    .bind(due_date)
    .bind(list_id)
    .bind(parent_id)
    .bind(related_note_id)
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(task) => Ok(Json(task)),
        Err(e) => {
            println!("[CREATE_TASK ERROR] user_id: {:?}, payload: {:?}, error: {}", claims.user_id, payload, e);
            Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
        }
    }
}

pub async fn update_task(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    claims: Claims,
    Json(payload): Json<UpdateTaskRequest>,
) -> Result<Json<Task>, (StatusCode, String)> {
    // Determine update logic with CASE for completed_at
    let task = sqlx::query_as::<_, Task>(
        r#"
        UPDATE tasks
        SET title = COALESCE($2, title),
            description = COALESCE($3, description),
            status = COALESCE($4, status),
            priority = COALESCE($5, priority),
            due_date = COALESCE($6, due_date),
            is_starred = COALESCE($7, is_starred),
            list_id = COALESCE($8, list_id),
            parent_id = COALESCE($9, parent_id),
            position = COALESCE($10, position),
            related_note_id = COALESCE($11, related_note_id),
            completed_at = CASE 
                WHEN $4 = 'done' OR $4 = 'completed' THEN NOW()
                WHEN $4 IS NOT NULL AND $4 != 'done' AND $4 != 'completed' THEN NULL
                ELSE completed_at
            END,
            updated_at = NOW()
        WHERE id = $1 AND user_id = $12
        RETURNING *
        "#
    )
    .bind(id)
    .bind(payload.title.clone())
    .bind(payload.description.clone())
    .bind(payload.status)
    .bind(payload.priority)
    .bind(payload.due_date.clone())
    .bind(payload.is_starred)
    .bind(payload.list_id.clone())
    .bind(payload.parent_id.clone())
    .bind(payload.position)
    .bind(payload.related_note_id.clone())
    .bind(claims.user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        if matches!(e, sqlx::Error::RowNotFound) {
            (StatusCode::NOT_FOUND, "Task not found".to_string())
        } else {
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        }
    })?;

    Ok(Json(task))
}

pub async fn delete_task(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    claims: Claims,
) -> Result<StatusCode, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM tasks WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(claims.user_id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Task not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}
