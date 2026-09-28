//! Tests unitarios de `calendar`: serde de payloads/respuestas, defaults
//! y parseo del query string. No tocan la base de datos.

use crate::calendar::*;
use axum::extract::Query;
use axum::http::Uri;
use chrono::{DateTime, TimeZone, Utc};
use serde_json::json;
use uuid::Uuid;

fn utc(y: i32, mo: u32, d: u32, h: u32, mi: u32) -> DateTime<Utc> {
    Utc.with_ymd_and_hms(y, mo, d, h, mi, 0).unwrap()
}

fn sample_event() -> Event {
    Event {
        id: Uuid::parse_str("11111111-1111-4111-8111-111111111111").unwrap(),
        user_id: Uuid::parse_str("22222222-2222-4222-8222-222222222222").unwrap(),
        title: "Reunión".to_string(),
        description: None,
        start_time: utc(2026, 1, 15, 10, 0),
        end_time: utc(2026, 1, 15, 11, 0),
        original_tz: "America/Argentina/Buenos_Aires".to_string(),
        status: "confirmed".to_string(),
        transparency: "opaque".to_string(),
        visibility: "private".to_string(),
        rrule: None,
        exdates: None,
        parent_event_id: None,
        recurrence_id: None,
        color: "#3b82f6".to_string(),
        created_at: None,
        updated_at: None,
    }
}

// --- CreateEventPayload: deserialization ---

#[test]
fn create_payload_minimal_leaves_optionals_none() {
    let raw = json!({
        "title": "Standup",
        "start_time": "2026-01-15T10:00:00Z",
        "end_time": "2026-01-15T10:15:00Z"
    })
    .to_string();

    let payload: CreateEventPayload = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.title, "Standup");
    assert_eq!(payload.start_time, utc(2026, 1, 15, 10, 0));
    assert_eq!(payload.end_time, utc(2026, 1, 15, 10, 15));
    assert!(payload.description.is_none());
    assert!(payload.original_tz.is_none());
    assert!(payload.status.is_none());
    assert!(payload.transparency.is_none());
    assert!(payload.visibility.is_none());
    assert!(payload.rrule.is_none());
    assert!(payload.exdates.is_none());
    assert!(payload.parent_event_id.is_none());
    assert!(payload.recurrence_id.is_none());
    assert!(payload.color.is_none());
}

#[test]
fn create_payload_full_json_maps_every_field() {
    let parent = Uuid::parse_str("33333333-3333-4333-8333-333333333333").unwrap();
    let raw = json!({
        "title": "Clase semanal",
        "description": "Sala 4",
        "start_time": "2026-02-01T13:00:00Z",
        "end_time": "2026-02-01T14:30:00Z",
        "original_tz": "America/Argentina/Buenos_Aires",
        "status": "tentative",
        "transparency": "transparent",
        "visibility": "public",
        "rrule": "FREQ=WEEKLY;BYDAY=MO",
        "exdates": ["2026-02-08T13:00:00Z", "2026-02-15T13:00:00Z"],
        "parent_event_id": parent,
        "recurrence_id": "2026-02-01T13:00:00Z",
        "color": "#ff0000"
    })
    .to_string();

    let payload: CreateEventPayload = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.description.as_deref(), Some("Sala 4"));
    assert_eq!(payload.original_tz.as_deref(), Some("America/Argentina/Buenos_Aires"));
    assert_eq!(payload.status.as_deref(), Some("tentative"));
    assert_eq!(payload.transparency.as_deref(), Some("transparent"));
    assert_eq!(payload.visibility.as_deref(), Some("public"));
    assert_eq!(payload.rrule.as_deref(), Some("FREQ=WEEKLY;BYDAY=MO"));
    assert_eq!(
        payload.exdates.as_deref(),
        Some(["2026-02-08T13:00:00Z".to_string(), "2026-02-15T13:00:00Z".to_string()].as_slice())
    );
    assert_eq!(payload.parent_event_id, Some(parent));
    assert_eq!(payload.recurrence_id, Some(utc(2026, 2, 1, 13, 0)));
    assert_eq!(payload.color.as_deref(), Some("#ff0000"));
}

#[test]
fn create_payload_rejects_missing_required_fields() {
    // sin title
    let raw = json!({
        "start_time": "2026-01-15T10:00:00Z",
        "end_time": "2026-01-15T11:00:00Z"
    })
    .to_string();
    assert!(serde_json::from_str::<CreateEventPayload>(&raw).is_err());

    // sin end_time
    let raw = json!({
        "title": "Standup",
        "start_time": "2026-01-15T10:00:00Z"
    })
    .to_string();
    assert!(serde_json::from_str::<CreateEventPayload>(&raw).is_err());
}

#[test]
fn create_payload_rejects_invalid_datetime() {
    let raw = json!({
        "title": "Standup",
        "start_time": "15/01/2026 10:00",
        "end_time": "2026-01-15T11:00:00Z"
    })
    .to_string();

    assert!(serde_json::from_str::<CreateEventPayload>(&raw).is_err());
}

#[test]
fn create_payload_normalizes_offset_datetimes_to_utc() {
    // -03:00 local => 13:00 UTC. El offset se pierde en el instante,
    // por eso existe original_tz como campo aparte.
    let raw = json!({
        "title": "Turno",
        "start_time": "2026-01-15T10:00:00-03:00",
        "end_time": "2026-01-15T11:00:00-03:00",
        "original_tz": "America/Argentina/Buenos_Aires"
    })
    .to_string();

    let payload: CreateEventPayload = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.start_time, utc(2026, 1, 15, 13, 0));
    assert_eq!(payload.end_time, utc(2026, 1, 15, 14, 0));
}

#[test]
fn create_payload_ignores_unknown_fields_like_user_id() {
    // Un cliente no puede inyectar user_id ni id por el body.
    let raw = json!({
        "title": "Standup",
        "start_time": "2026-01-15T10:00:00Z",
        "end_time": "2026-01-15T11:00:00Z",
        "user_id": "44444444-4444-4444-8444-444444444444",
        "id": "55555555-5555-4555-8555-555555555555"
    })
    .to_string();

    let payload: CreateEventPayload = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.title, "Standup");
}

// --- CreateEventPayload: defaults ---

#[test]
fn create_payload_applies_defaults_when_fields_are_absent() {
    let raw = json!({
        "title": "Standup",
        "start_time": "2026-01-15T10:00:00Z",
        "end_time": "2026-01-15T11:00:00Z"
    })
    .to_string();

    let payload: CreateEventPayload = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.original_tz_or_default(), "UTC");
    assert_eq!(payload.status_or_default(), "confirmed");
    assert_eq!(payload.transparency_or_default(), "opaque");
    assert_eq!(payload.visibility_or_default(), "private");
    assert_eq!(payload.color_or_default(), "#3b82f6");
}

#[test]
fn create_payload_keeps_provided_values_over_defaults() {
    let raw = json!({
        "title": "Standup",
        "start_time": "2026-01-15T10:00:00Z",
        "end_time": "2026-01-15T11:00:00Z",
        "original_tz": "Europe/Madrid",
        "status": "cancelled",
        "transparency": "transparent",
        "visibility": "public",
        "color": "#00ff00"
    })
    .to_string();

    let payload: CreateEventPayload = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.original_tz_or_default(), "Europe/Madrid");
    assert_eq!(payload.status_or_default(), "cancelled");
    assert_eq!(payload.transparency_or_default(), "transparent");
    assert_eq!(payload.visibility_or_default(), "public");
    assert_eq!(payload.color_or_default(), "#00ff00");
}

#[test]
fn create_payload_null_is_treated_as_absent_and_takes_default() {
    let raw = json!({
        "title": "Standup",
        "start_time": "2026-01-15T10:00:00Z",
        "end_time": "2026-01-15T11:00:00Z",
        "status": null,
        "color": null
    })
    .to_string();

    let payload: CreateEventPayload = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.status_or_default(), "confirmed");
    assert_eq!(payload.color_or_default(), "#3b82f6");
}

// --- UpdateEventPayload ---

#[test]
fn update_payload_empty_json_leaves_everything_none() {
    let payload: UpdateEventPayload = serde_json::from_str("{}").unwrap();

    assert!(payload.title.is_none());
    assert!(payload.description.is_none());
    assert!(payload.start_time.is_none());
    assert!(payload.end_time.is_none());
    assert!(payload.original_tz.is_none());
    assert!(payload.status.is_none());
    assert!(payload.transparency.is_none());
    assert!(payload.visibility.is_none());
    assert!(payload.rrule.is_none());
    assert!(payload.exdates.is_none());
    assert!(payload.recurrence_id.is_none());
    assert!(payload.color.is_none());
}

#[test]
fn update_payload_partial_only_sets_sent_fields() {
    let raw = json!({ "title": "Nuevo título", "color": "#123456" }).to_string();

    let payload: UpdateEventPayload = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.title.as_deref(), Some("Nuevo título"));
    assert_eq!(payload.color.as_deref(), Some("#123456"));
    assert!(payload.status.is_none());
    assert!(payload.start_time.is_none());
}

#[test]
fn update_payload_explicit_null_is_indistinguishable_from_absent() {
    // Limitación conocida del COALESCE en update_event: con Option<T>
    // mandar `null` no borra el campo, se comporta como si no viniera.
    let with_null: UpdateEventPayload =
        serde_json::from_str(&json!({ "description": null }).to_string()).unwrap();
    let absent: UpdateEventPayload = serde_json::from_str("{}").unwrap();

    assert!(with_null.description.is_none());
    assert!(absent.description.is_none());
}

#[test]
fn update_payload_has_no_parent_event_id_field() {
    // parent_event_id no es actualizable: mandarlo no rompe, pero se ignora.
    let raw = json!({
        "title": "Ok",
        "parent_event_id": "33333333-3333-4333-8333-333333333333"
    })
    .to_string();

    let payload: UpdateEventPayload = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.title.as_deref(), Some("Ok"));
}

#[test]
fn update_payload_rejects_invalid_types() {
    let raw = json!({ "title": 42 }).to_string();
    assert!(serde_json::from_str::<UpdateEventPayload>(&raw).is_err());

    let raw = json!({ "exdates": "2026-02-08T13:00:00Z" }).to_string();
    assert!(serde_json::from_str::<UpdateEventPayload>(&raw).is_err());
}

// --- EventFilterCmd (query string de GET /api/calendar) ---

fn parse_filter(query: &str) -> Result<EventFilterCmd, String> {
    let uri: Uri = format!("/api/calendar{}", query).parse().unwrap();
    Query::<EventFilterCmd>::try_from_uri(&uri)
        .map(|Query(params)| params)
        .map_err(|e| e.to_string())
}

#[test]
fn filter_parses_both_dates() {
    let params = parse_filter("?start_date=2026-01-01T00:00:00Z&end_date=2026-01-31T23:59:00Z")
        .unwrap();

    assert_eq!(params.start_date, Some(utc(2026, 1, 1, 0, 0)));
    assert_eq!(params.end_date, Some(utc(2026, 1, 31, 23, 59)));
}

#[test]
fn filter_without_query_string_is_empty() {
    let params = parse_filter("").unwrap();

    assert!(params.start_date.is_none());
    assert!(params.end_date.is_none());
}

#[test]
fn filter_with_only_start_date_does_not_trigger_range_branch() {
    // list_events sólo filtra cuando vienen las dos fechas.
    let params = parse_filter("?start_date=2026-01-01T00:00:00Z").unwrap();

    assert_eq!(params.start_date, Some(utc(2026, 1, 1, 0, 0)));
    assert!(params.end_date.is_none());
    assert!(!matches!((params.start_date, params.end_date), (Some(_), Some(_))));
}

#[test]
fn filter_rejects_invalid_date() {
    assert!(parse_filter("?start_date=ayer").is_err());
}

#[test]
fn filter_ignores_unknown_query_params() {
    let params = parse_filter("?foo=bar&end_date=2026-01-31T23:59:00Z").unwrap();

    assert!(params.start_date.is_none());
    assert_eq!(params.end_date, Some(utc(2026, 1, 31, 23, 59)));
}

// --- Event (respuesta) ---

#[test]
fn event_serializes_timestamps_as_rfc3339_utc() {
    let json = serde_json::to_value(sample_event()).unwrap();

    assert_eq!(json["start_time"], "2026-01-15T10:00:00Z");
    assert_eq!(json["end_time"], "2026-01-15T11:00:00Z");
    assert_eq!(json["original_tz"], "America/Argentina/Buenos_Aires");
}

#[test]
fn event_serializes_absent_optionals_as_null() {
    let json = serde_json::to_value(sample_event()).unwrap();

    assert!(json["description"].is_null());
    assert!(json["rrule"].is_null());
    assert!(json["exdates"].is_null());
    assert!(json["parent_event_id"].is_null());
    assert!(json["recurrence_id"].is_null());
    assert!(json["created_at"].is_null());
    assert!(json["updated_at"].is_null());
}

#[test]
fn event_never_exposes_fields_outside_the_struct() {
    let json = serde_json::to_value(sample_event()).unwrap();
    let obj = json.as_object().unwrap();

    let mut keys: Vec<&str> = obj.keys().map(|k| k.as_str()).collect();
    keys.sort_unstable();

    assert_eq!(
        keys,
        vec![
            "color",
            "created_at",
            "description",
            "end_time",
            "exdates",
            "id",
            "original_tz",
            "parent_event_id",
            "recurrence_id",
            "rrule",
            "start_time",
            "status",
            "title",
            "transparency",
            "updated_at",
            "user_id",
            "visibility",
        ]
    );
}

#[test]
fn event_survives_a_serde_roundtrip() {
    let mut original = sample_event();
    original.description = Some("con detalle".to_string());
    original.rrule = Some("FREQ=DAILY;COUNT=5".to_string());
    original.exdates = Some(vec!["2026-01-16T10:00:00Z".to_string()]);
    original.parent_event_id = Some(Uuid::parse_str("33333333-3333-4333-8333-333333333333").unwrap());
    original.recurrence_id = Some(utc(2026, 1, 15, 10, 0));
    original.created_at = Some(utc(2026, 1, 10, 8, 30));
    original.updated_at = Some(utc(2026, 1, 12, 9, 45));

    let encoded = serde_json::to_string(&original).unwrap();
    let decoded: Event = serde_json::from_str(&encoded).unwrap();

    assert_eq!(decoded.id, original.id);
    assert_eq!(decoded.user_id, original.user_id);
    assert_eq!(decoded.title, original.title);
    assert_eq!(decoded.description, original.description);
    assert_eq!(decoded.start_time, original.start_time);
    assert_eq!(decoded.end_time, original.end_time);
    assert_eq!(decoded.original_tz, original.original_tz);
    assert_eq!(decoded.status, original.status);
    assert_eq!(decoded.transparency, original.transparency);
    assert_eq!(decoded.visibility, original.visibility);
    assert_eq!(decoded.rrule, original.rrule);
    assert_eq!(decoded.exdates, original.exdates);
    assert_eq!(decoded.parent_event_id, original.parent_event_id);
    assert_eq!(decoded.recurrence_id, original.recurrence_id);
    assert_eq!(decoded.color, original.color);
    assert_eq!(decoded.created_at, original.created_at);
    assert_eq!(decoded.updated_at, original.updated_at);
}
