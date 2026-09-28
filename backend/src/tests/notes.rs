//! Tests unitarios de `notes`: serde de requests/respuestas y manejo del
//! contenido JSONB. No tocan la base de datos.

use crate::notes::*;
use chrono::{DateTime, TimeZone, Utc};
use serde_json::{json, Value};
use uuid::Uuid;

fn utc(y: i32, mo: u32, d: u32, h: u32, mi: u32) -> DateTime<Utc> {
    Utc.with_ymd_and_hms(y, mo, d, h, mi, 0).unwrap()
}

fn sample_content() -> Value {
    json!({
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [{ "type": "text", "text": "Hola" }]
            }
        ]
    })
}

fn sample_note() -> Note {
    Note {
        id: Uuid::parse_str("11111111-1111-4111-8111-111111111111").unwrap(),
        user_id: Uuid::parse_str("22222222-2222-4222-8222-222222222222").unwrap(),
        title: "Ideas".to_string(),
        content: sample_content(),
        created_at: None,
        updated_at: None,
        parent_id: None,
    }
}

// --- CreateNoteRequest ---

#[test]
fn create_request_minimal_leaves_parent_none() {
    let raw = json!({ "title": "Ideas", "content": sample_content() }).to_string();

    let payload: CreateNoteRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.title, "Ideas");
    assert_eq!(payload.content, sample_content());
    assert!(payload.parent_id.is_none());
}

#[test]
fn create_request_parses_parent_id_for_subnotes() {
    let parent = Uuid::parse_str("33333333-3333-4333-8333-333333333333").unwrap();
    let raw = json!({
        "title": "Subnota",
        "content": sample_content(),
        "parent_id": parent
    })
    .to_string();

    let payload: CreateNoteRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.parent_id, Some(parent));
}

#[test]
fn create_request_preserves_nested_content_verbatim() {
    // El documento del editor viaja tal cual hasta el JSONB: nada se reordena
    // ni se pierde en la deserialización.
    let raw = json!({ "title": "Ideas", "content": sample_content() }).to_string();

    let payload: CreateNoteRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.content["type"], "doc");
    assert_eq!(payload.content["content"][0]["type"], "paragraph");
    assert_eq!(payload.content["content"][0]["content"][0]["text"], "Hola");
}

#[test]
fn create_request_accepts_any_json_shape_as_content() {
    // content es JSONB libre: no sólo objetos.
    for content in [json!([1, 2, 3]), json!("texto plano"), json!(42), json!(true)] {
        let raw = json!({ "title": "Ideas", "content": content }).to_string();

        let payload: CreateNoteRequest = serde_json::from_str(&raw).unwrap();

        assert_eq!(payload.content, content);
    }
}

#[test]
fn create_request_accepts_explicit_null_content() {
    // `null` es un valor JSON válido, no un error de parseo.
    let raw = json!({ "title": "Ideas", "content": null }).to_string();

    let payload: CreateNoteRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.content, Value::Null);
}

#[test]
fn create_request_rejects_missing_required_fields() {
    // sin title
    let raw = json!({ "content": sample_content() }).to_string();
    assert!(serde_json::from_str::<CreateNoteRequest>(&raw).is_err());

    // sin content
    let raw = json!({ "title": "Ideas" }).to_string();
    assert!(serde_json::from_str::<CreateNoteRequest>(&raw).is_err());
}

#[test]
fn create_request_rejects_invalid_parent_id() {
    let raw = json!({
        "title": "Ideas",
        "content": sample_content(),
        "parent_id": "no-es-un-uuid"
    })
    .to_string();

    assert!(serde_json::from_str::<CreateNoteRequest>(&raw).is_err());
}

#[test]
fn create_request_rejects_invalid_title_type() {
    let raw = json!({ "title": 42, "content": sample_content() }).to_string();

    assert!(serde_json::from_str::<CreateNoteRequest>(&raw).is_err());
}

#[test]
fn create_request_ignores_unknown_fields_like_user_id() {
    // Un cliente no puede inyectar user_id ni id por el body.
    let raw = json!({
        "title": "Ideas",
        "content": sample_content(),
        "user_id": "44444444-4444-4444-8444-444444444444",
        "id": "55555555-5555-4555-8555-555555555555"
    })
    .to_string();

    let payload: CreateNoteRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.title, "Ideas");
}

// --- UpdateNoteRequest ---

#[test]
fn update_request_empty_json_leaves_everything_none() {
    let payload: UpdateNoteRequest = serde_json::from_str("{}").unwrap();

    assert!(payload.title.is_none());
    assert!(payload.content.is_none());
}

#[test]
fn update_request_partial_only_sets_sent_fields() {
    let raw = json!({ "title": "Nuevo título" }).to_string();

    let payload: UpdateNoteRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.title.as_deref(), Some("Nuevo título"));
    assert!(payload.content.is_none());
}

#[test]
fn update_request_null_title_is_indistinguishable_from_absent() {
    // Con Option<String>, `null` colapsa a None y el COALESCE de update_note
    // deja el título viejo: no hay forma de borrarlo.
    let with_null: UpdateNoteRequest =
        serde_json::from_str(&json!({ "title": null }).to_string()).unwrap();
    let absent: UpdateNoteRequest = serde_json::from_str("{}").unwrap();

    assert!(with_null.title.is_none());
    assert!(absent.title.is_none());
}

#[test]
fn update_request_null_content_also_collapses_to_none() {
    // Aunque Value puede representar null, Option<Value> lo intercepta antes:
    // `"content": null` da None, no Some(Value::Null). O sea que el content
    // tampoco se puede vaciar vía COALESCE, igual que el title.
    // Ojo con la asimetría contra create_note, donde content es Value pelado
    // y `null` sí se guarda como JSONB null.
    let with_null: UpdateNoteRequest =
        serde_json::from_str(&json!({ "content": null }).to_string()).unwrap();
    let absent: UpdateNoteRequest = serde_json::from_str("{}").unwrap();

    assert!(with_null.content.is_none());
    assert!(absent.content.is_none());

    // En create, en cambio, el mismo `null` sí sobrevive.
    let created: CreateNoteRequest =
        serde_json::from_str(&json!({ "title": "Ideas", "content": null }).to_string()).unwrap();
    assert_eq!(created.content, Value::Null);
}

#[test]
fn update_request_accepts_replacement_content() {
    let nuevo = json!({ "type": "doc", "content": [] });
    let raw = json!({ "content": nuevo }).to_string();

    let payload: UpdateNoteRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.content, Some(nuevo));
}

#[test]
fn update_request_rejects_invalid_title_type() {
    let raw = json!({ "title": 42 }).to_string();

    assert!(serde_json::from_str::<UpdateNoteRequest>(&raw).is_err());
}

#[test]
fn update_request_has_no_parent_id_field() {
    // update_note no mueve la nota de padre: mandarlo no rompe, pero se ignora.
    let raw = json!({ "title": "Ok", "parent_id": "33333333-3333-4333-8333-333333333333" })
        .to_string();

    let payload: UpdateNoteRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.title.as_deref(), Some("Ok"));
}

// --- Note (respuesta) ---

#[test]
fn note_serializes_timestamps_as_rfc3339_utc() {
    let mut note = sample_note();
    note.created_at = Some(utc(2026, 1, 10, 8, 30));
    note.updated_at = Some(utc(2026, 1, 12, 9, 45));

    let json = serde_json::to_value(note).unwrap();

    assert_eq!(json["created_at"], "2026-01-10T08:30:00Z");
    assert_eq!(json["updated_at"], "2026-01-12T09:45:00Z");
}

#[test]
fn note_serializes_absent_optionals_as_null() {
    let json = serde_json::to_value(sample_note()).unwrap();

    assert!(json["created_at"].is_null());
    assert!(json["updated_at"].is_null());
    assert!(json["parent_id"].is_null());
}

#[test]
fn note_serializes_parent_id_when_present() {
    let parent = Uuid::parse_str("33333333-3333-4333-8333-333333333333").unwrap();
    let mut note = sample_note();
    note.parent_id = Some(parent);

    let json = serde_json::to_value(note).unwrap();

    assert_eq!(json["parent_id"], parent.to_string());
}

#[test]
fn note_serializes_content_as_json_not_as_string() {
    // El content sale como objeto anidado, no escapado dentro de un string.
    let json = serde_json::to_value(sample_note()).unwrap();

    assert!(json["content"].is_object());
    assert_eq!(json["content"], sample_content());
}

#[test]
fn note_never_exposes_fields_outside_the_struct() {
    let json = serde_json::to_value(sample_note()).unwrap();
    let obj = json.as_object().unwrap();

    let mut keys: Vec<&str> = obj.keys().map(|k| k.as_str()).collect();
    keys.sort_unstable();

    assert_eq!(
        keys,
        vec![
            "content",
            "created_at",
            "id",
            "parent_id",
            "title",
            "updated_at",
            "user_id",
        ]
    );
}
