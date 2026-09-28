//! Tests unitarios de `tasks`: serde de requests/respuestas, el default de
//! priority y el parseo de los filtros. No tocan la base de datos.

use crate::tasks::*;
use axum::extract::Query;
use axum::http::Uri;
use chrono::{DateTime, TimeZone, Utc};
use serde_json::json;
use uuid::Uuid;

fn utc(y: i32, mo: u32, d: u32, h: u32, mi: u32) -> DateTime<Utc> {
    Utc.with_ymd_and_hms(y, mo, d, h, mi, 0).unwrap()
}

fn uuid(n: u8) -> Uuid {
    Uuid::parse_str(&format!("{n}{n}{n}{n}{n}{n}{n}{n}-{n}{n}{n}{n}-4{n}{n}{n}-8{n}{n}{n}-{n}{n}{n}{n}{n}{n}{n}{n}{n}{n}{n}{n}"))
        .unwrap()
}

fn sample_task() -> Task {
    Task {
        id: uuid(1),
        user_id: Some(uuid(2)),
        title: "Comprar pan".to_string(),
        description: None,
        status: "pending".to_string(),
        priority: Some("medium".to_string()),
        due_date: None,
        completed_at: None,
        list_id: None,
        parent_id: None,
        is_starred: false,
        position: 0,
        related_note_id: None,
        created_at: None,
        updated_at: None,
    }
}

// --- CreateTaskRequest ---

#[test]
fn create_request_minimal_leaves_optionals_none() {
    let raw = json!({ "title": "Comprar pan" }).to_string();

    let payload: CreateTaskRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.title, "Comprar pan");
    assert!(payload.description.is_none());
    assert!(payload.priority.is_none());
    assert!(payload.due_date.is_none());
    assert!(payload.list_id.is_none());
    assert!(payload.parent_id.is_none());
    assert!(payload.related_note_id.is_none());
}

#[test]
fn create_request_full_json_maps_every_field() {
    let raw = json!({
        "title": "Informe",
        "description": "Para el lunes",
        "priority": "high",
        "due_date": "2026-03-02T09:00:00Z",
        "list_id": uuid(3),
        "parent_id": uuid(4),
        "related_note_id": uuid(5)
    })
    .to_string();

    let payload: CreateTaskRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.description.as_deref(), Some("Para el lunes"));
    assert_eq!(payload.priority.as_deref(), Some("high"));
    assert_eq!(payload.due_date, Some(utc(2026, 3, 2, 9, 0)));
    assert_eq!(payload.list_id, Some(uuid(3)));
    assert_eq!(payload.parent_id, Some(uuid(4)));
    assert_eq!(payload.related_note_id, Some(uuid(5)));
}

#[test]
fn create_request_rejects_missing_title() {
    let raw = json!({ "description": "sin título" }).to_string();

    assert!(serde_json::from_str::<CreateTaskRequest>(&raw).is_err());
}

#[test]
fn create_request_rejects_invalid_due_date() {
    let raw = json!({ "title": "Informe", "due_date": "02/03/2026" }).to_string();

    assert!(serde_json::from_str::<CreateTaskRequest>(&raw).is_err());
}

#[test]
fn create_request_rejects_invalid_list_id() {
    let raw = json!({ "title": "Informe", "list_id": "no-es-un-uuid" }).to_string();

    assert!(serde_json::from_str::<CreateTaskRequest>(&raw).is_err());
}

#[test]
fn create_request_normalizes_due_date_offset_to_utc() {
    let raw = json!({ "title": "Turno", "due_date": "2026-03-02T09:00:00-03:00" }).to_string();

    let payload: CreateTaskRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.due_date, Some(utc(2026, 3, 2, 12, 0)));
}

#[test]
fn create_request_cannot_set_status_starred_or_position() {
    // Esos campos no existen en CreateTaskRequest: una tarea no puede nacer
    // marcada como hecha, destacada ni en una posición elegida por el cliente.
    let raw = json!({
        "title": "Comprar pan",
        "status": "done",
        "is_starred": true,
        "position": 99,
        "completed_at": "2026-03-02T09:00:00Z",
        "user_id": uuid(9)
    })
    .to_string();

    let payload: CreateTaskRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.title, "Comprar pan");
}

#[test]
fn create_request_applies_default_priority_when_absent() {
    let raw = json!({ "title": "Comprar pan" }).to_string();

    let payload: CreateTaskRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.priority_or_default(), "medium");
}

#[test]
fn create_request_keeps_provided_priority_over_default() {
    let raw = json!({ "title": "Comprar pan", "priority": "low" }).to_string();

    let payload: CreateTaskRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.priority_or_default(), "low");
}

#[test]
fn create_request_null_priority_takes_the_default() {
    let raw = json!({ "title": "Comprar pan", "priority": null }).to_string();

    let payload: CreateTaskRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.priority_or_default(), "medium");
}

// --- UpdateTaskRequest ---

#[test]
fn update_request_empty_json_leaves_everything_none() {
    let payload: UpdateTaskRequest = serde_json::from_str("{}").unwrap();

    assert!(payload.title.is_none());
    assert!(payload.description.is_none());
    assert!(payload.status.is_none());
    assert!(payload.priority.is_none());
    assert!(payload.due_date.is_none());
    assert!(payload.is_starred.is_none());
    assert!(payload.list_id.is_none());
    assert!(payload.parent_id.is_none());
    assert!(payload.position.is_none());
    assert!(payload.related_note_id.is_none());
}

#[test]
fn update_request_partial_only_sets_sent_fields() {
    let raw = json!({ "is_starred": true, "position": 3 }).to_string();

    let payload: UpdateTaskRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.is_starred, Some(true));
    assert_eq!(payload.position, Some(3));
    assert!(payload.title.is_none());
    assert!(payload.status.is_none());
}

#[test]
fn update_request_null_is_indistinguishable_from_absent() {
    // Mismo COALESCE que en notes y calendar: `null` no borra, no hace nada.
    // Incluye due_date, así que una tarea no puede perder su vencimiento.
    let with_null: UpdateTaskRequest =
        serde_json::from_str(&json!({ "due_date": null, "list_id": null }).to_string()).unwrap();
    let absent: UpdateTaskRequest = serde_json::from_str("{}").unwrap();

    assert!(with_null.due_date.is_none());
    assert!(with_null.list_id.is_none());
    assert!(absent.due_date.is_none());
}

#[test]
fn update_request_accepts_any_status_string() {
    // No hay enum ni validación: serde deja pasar cualquier texto. El CASE de
    // update_task sólo distingue 'done'/'completed' del resto.
    for status in ["done", "completed", "pending", "cualquier_cosa"] {
        let raw = json!({ "status": status }).to_string();

        let payload: UpdateTaskRequest = serde_json::from_str(&raw).unwrap();

        assert_eq!(payload.status.as_deref(), Some(status));
    }
}

#[test]
fn update_request_rejects_non_integer_position() {
    let raw = json!({ "position": 1.5 }).to_string();

    assert!(serde_json::from_str::<UpdateTaskRequest>(&raw).is_err());
}

#[test]
fn update_request_rejects_position_out_of_i32_range() {
    let raw = r#"{"position": 2147483648}"#;

    assert!(serde_json::from_str::<UpdateTaskRequest>(raw).is_err());
}

#[test]
fn update_request_accepts_negative_position() {
    let raw = json!({ "position": -1 }).to_string();

    let payload: UpdateTaskRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.position, Some(-1));
}

#[test]
fn update_request_rejects_non_boolean_is_starred() {
    let raw = json!({ "is_starred": "true" }).to_string();

    assert!(serde_json::from_str::<UpdateTaskRequest>(&raw).is_err());
}

// --- CreateListRequest / UpdateListRequest ---

#[test]
fn create_list_request_minimal_leaves_style_none() {
    let raw = json!({ "title": "Trabajo" }).to_string();

    let payload: CreateListRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.title, "Trabajo");
    assert!(payload.color.is_none());
    assert!(payload.icon.is_none());
}

#[test]
fn create_list_request_rejects_missing_title() {
    let raw = json!({ "color": "#ff0000" }).to_string();

    assert!(serde_json::from_str::<CreateListRequest>(&raw).is_err());
}

#[test]
fn create_list_request_maps_color_and_icon() {
    let raw = json!({ "title": "Trabajo", "color": "#ff0000", "icon": "briefcase" }).to_string();

    let payload: CreateListRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.color.as_deref(), Some("#ff0000"));
    assert_eq!(payload.icon.as_deref(), Some("briefcase"));
}

#[test]
fn update_list_request_empty_json_leaves_everything_none() {
    let payload: UpdateListRequest = serde_json::from_str("{}").unwrap();

    assert!(payload.title.is_none());
    assert!(payload.color.is_none());
    assert!(payload.icon.is_none());
}

#[test]
fn update_list_request_cannot_change_is_default() {
    // is_default no es actualizable por el body: se ignora.
    let raw = json!({ "title": "Trabajo", "is_default": true }).to_string();

    let payload: UpdateListRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.title.as_deref(), Some("Trabajo"));
}

// --- TaskFilter (query string de GET /api/tasks) ---

fn parse_filter(query: &str) -> Result<TaskFilter, String> {
    let uri: Uri = format!("/api/tasks{}", query).parse().unwrap();
    Query::<TaskFilter>::try_from_uri(&uri)
        .map(|Query(filter)| filter)
        .map_err(|e| e.to_string())
}

#[test]
fn filter_parses_every_param() {
    let query = format!("?list_id={}&is_starred=true&parent_id={}", uuid(3), uuid(4));

    let filter = parse_filter(&query).unwrap();

    assert_eq!(filter.list_id, Some(uuid(3)));
    assert_eq!(filter.is_starred, Some(true));
    assert_eq!(filter.parent_id, Some(uuid(4)));
}

#[test]
fn filter_without_query_string_is_empty() {
    let filter = parse_filter("").unwrap();

    assert!(filter.list_id.is_none());
    assert!(filter.is_starred.is_none());
    assert!(filter.parent_id.is_none());
}

#[test]
fn filter_is_starred_false_parses_but_does_not_filter() {
    // list_tasks sólo agrega el AND cuando is_starred es true, así que
    // `?is_starred=false` devuelve todas las tareas, no las no destacadas.
    let filter = parse_filter("?is_starred=false").unwrap();

    assert_eq!(filter.is_starred, Some(false));
    assert!(!matches!(filter.is_starred, Some(true)));
}

#[test]
fn filter_rejects_numeric_booleans() {
    // El front tiene que mandar true/false; 1 y 0 no parsean.
    assert!(parse_filter("?is_starred=1").is_err());
    assert!(parse_filter("?is_starred=0").is_err());
}

#[test]
fn filter_rejects_invalid_uuid() {
    assert!(parse_filter("?list_id=no-es-un-uuid").is_err());
}

#[test]
fn filter_ignores_unknown_query_params() {
    let filter = parse_filter("?foo=bar&is_starred=true").unwrap();

    assert_eq!(filter.is_starred, Some(true));
    assert!(filter.list_id.is_none());
}

// --- Respuestas ---

#[test]
fn task_serializes_timestamps_as_rfc3339_utc() {
    let mut task = sample_task();
    task.due_date = Some(utc(2026, 3, 2, 9, 0));
    task.completed_at = Some(utc(2026, 3, 1, 18, 30));

    let json = serde_json::to_value(task).unwrap();

    assert_eq!(json["due_date"], "2026-03-02T09:00:00Z");
    assert_eq!(json["completed_at"], "2026-03-01T18:30:00Z");
}

#[test]
fn task_serializes_absent_optionals_as_null() {
    let json = serde_json::to_value(sample_task()).unwrap();

    assert!(json["description"].is_null());
    assert!(json["due_date"].is_null());
    assert!(json["completed_at"].is_null());
    assert!(json["list_id"].is_null());
    assert!(json["parent_id"].is_null());
    assert!(json["related_note_id"].is_null());
    assert!(json["created_at"].is_null());
    assert!(json["updated_at"].is_null());
}

#[test]
fn task_keeps_flags_as_native_json_types() {
    let json = serde_json::to_value(sample_task()).unwrap();

    assert_eq!(json["is_starred"], false);
    assert_eq!(json["position"], 0);
    assert!(json["is_starred"].is_boolean());
    assert!(json["position"].is_number());
}

#[test]
fn task_never_exposes_fields_outside_the_struct() {
    let json = serde_json::to_value(sample_task()).unwrap();
    let obj = json.as_object().unwrap();

    let mut keys: Vec<&str> = obj.keys().map(|k| k.as_str()).collect();
    keys.sort_unstable();

    assert_eq!(
        keys,
        vec![
            "completed_at",
            "created_at",
            "description",
            "due_date",
            "id",
            "is_starred",
            "list_id",
            "parent_id",
            "position",
            "priority",
            "related_note_id",
            "status",
            "title",
            "updated_at",
            "user_id",
        ]
    );
}

#[test]
fn task_list_never_exposes_fields_outside_the_struct() {
    let list = TaskList {
        id: uuid(1),
        user_id: Some(uuid(2)),
        title: "Trabajo".to_string(),
        color: None,
        icon: None,
        is_default: false,
        created_at: None,
        updated_at: None,
    };

    let json = serde_json::to_value(list).unwrap();
    let obj = json.as_object().unwrap();

    let mut keys: Vec<&str> = obj.keys().map(|k| k.as_str()).collect();
    keys.sort_unstable();

    assert_eq!(
        keys,
        vec!["color", "created_at", "icon", "id", "is_default", "title", "updated_at", "user_id"]
    );
}

#[test]
fn attachment_never_exposes_the_binary_column() {
    // `data` está en la tabla pero no en el struct: los listados devuelven
    // sólo metadata y los bytes salen únicamente por el endpoint de descarga.
    let attachment = TaskAttachment {
        id: uuid(1),
        task_id: uuid(2),
        filename: "informe.pdf".to_string(),
        mime_type: Some("application/pdf".to_string()),
        uploaded_at: Some(utc(2026, 3, 2, 9, 0)),
    };

    let json = serde_json::to_value(attachment).unwrap();
    let obj = json.as_object().unwrap();

    let mut keys: Vec<&str> = obj.keys().map(|k| k.as_str()).collect();
    keys.sort_unstable();

    assert_eq!(keys, vec!["filename", "id", "mime_type", "task_id", "uploaded_at"]);
    assert!(obj.get("data").is_none());
}
