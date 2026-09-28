//! Tests unitarios de `users`: serde de requests/respuestas, parseo del header
//! Authorization y el atajo de login admin. No tocan la base de datos.

use crate::users::*;
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use serde_json::json;
use uuid::Uuid;

fn uuid(n: u8) -> Uuid {
    Uuid::parse_str(&format!("{n}{n}{n}{n}{n}{n}{n}{n}-{n}{n}{n}{n}-4{n}{n}{n}-8{n}{n}{n}-{n}{n}{n}{n}{n}{n}{n}{n}{n}{n}{n}{n}"))
        .unwrap()
}

fn sample_user() -> User {
    User {
        id: uuid(1),
        username: "bruno".to_string(),
        email: "bruno@example.com".to_string(),
        is_admin: false,
    }
}

fn headers_with_auth(value: &str) -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert("Authorization", HeaderValue::from_str(value).unwrap());
    headers
}

// --- RegisterRequest ---

#[test]
fn register_request_maps_every_field() {
    let raw = json!({
        "username": "bruno",
        "email": "bruno@example.com",
        "password": "secreta123"
    })
    .to_string();

    let payload: RegisterRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.username, "bruno");
    assert_eq!(payload.email, "bruno@example.com");
    assert_eq!(payload.password, "secreta123");
}

#[test]
fn register_request_rejects_missing_fields() {
    let sin_username = json!({ "email": "b@example.com", "password": "x" }).to_string();
    let sin_email = json!({ "username": "bruno", "password": "x" }).to_string();
    let sin_password = json!({ "username": "bruno", "email": "b@example.com" }).to_string();

    assert!(serde_json::from_str::<RegisterRequest>(&sin_username).is_err());
    assert!(serde_json::from_str::<RegisterRequest>(&sin_email).is_err());
    assert!(serde_json::from_str::<RegisterRequest>(&sin_password).is_err());
}

#[test]
fn register_request_cannot_self_promote_to_admin() {
    // is_admin no existe en el request: el INSERT lo fuerza a false y mandarlo
    // por el body no cambia nada.
    let raw = json!({
        "username": "bruno",
        "email": "bruno@example.com",
        "password": "secreta123",
        "is_admin": true,
        "id": uuid(9)
    })
    .to_string();

    let payload: RegisterRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.username, "bruno");
}

#[test]
fn register_request_preserves_password_verbatim() {
    // Nada de trim ni normalización antes de hashear: lo que manda el cliente
    // es exactamente lo que entra a Argon2.
    let password = "  ñandú 🔐 con espacios  ";
    let raw = json!({
        "username": "bruno",
        "email": "bruno@example.com",
        "password": password
    })
    .to_string();

    let payload: RegisterRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.password, password);
}

#[test]
fn register_request_rejects_non_string_password() {
    let raw = json!({ "username": "bruno", "email": "b@example.com", "password": 1234 }).to_string();

    assert!(serde_json::from_str::<RegisterRequest>(&raw).is_err());
}

#[test]
fn register_request_does_not_validate_email_shape() {
    // serde sólo pide que sea texto; no hay validación de formato en el backend.
    let raw = json!({ "username": "bruno", "email": "no-es-un-mail", "password": "x" }).to_string();

    let payload: RegisterRequest = serde_json::from_str(&raw).unwrap();

    assert_eq!(payload.email, "no-es-un-mail");
}

// --- LoginRequest ---

#[test]
fn login_request_accepts_username_or_email_as_identifier() {
    for identifier in ["bruno", "bruno@example.com"] {
        let raw = json!({ "identifier": identifier, "password": "secreta123" }).to_string();

        let payload: LoginRequest = serde_json::from_str(&raw).unwrap();

        assert_eq!(payload.identifier, identifier);
        assert_eq!(payload.password, "secreta123");
    }
}

#[test]
fn login_request_rejects_missing_fields() {
    let sin_identifier = json!({ "password": "x" }).to_string();
    let sin_password = json!({ "identifier": "bruno" }).to_string();

    assert!(serde_json::from_str::<LoginRequest>(&sin_identifier).is_err());
    assert!(serde_json::from_str::<LoginRequest>(&sin_password).is_err());
}

#[test]
fn login_request_does_not_accept_email_field_name() {
    // El campo se llama identifier: mandar "email" no alcanza.
    let raw = json!({ "email": "bruno@example.com", "password": "x" }).to_string();

    assert!(serde_json::from_str::<LoginRequest>(&raw).is_err());
}

// --- Atajo de login admin ---

#[test]
fn admin_login_username_is_case_insensitive() {
    let password = admin_password_for_tests();

    assert!(is_admin_login("admin", password));
    assert!(is_admin_login("ADMIN", password));
    assert!(is_admin_login("Admin", password));
}

#[test]
fn admin_login_password_must_match_exactly() {
    assert!(!is_admin_login(ADMIN_USERNAME, "otra-cosa"));
    assert!(!is_admin_login(ADMIN_USERNAME, ""));
    assert!(!is_admin_login(
        ADMIN_USERNAME,
        &admin_password_for_tests().to_lowercase()
    ));
}

#[test]
fn admin_login_does_not_trigger_for_other_identifiers() {
    let password = admin_password_for_tests();

    assert!(!is_admin_login("admin@local", password));
    assert!(!is_admin_login("administrador", password));
    assert!(!is_admin_login("", password));
}

// --- Header Authorization ---

#[test]
fn bearer_token_extracts_the_token() {
    let headers = headers_with_auth("Bearer abc.def.ghi");

    assert_eq!(bearer_token(&headers).unwrap(), "abc.def.ghi");
}

#[test]
fn bearer_token_requires_the_header() {
    let (status, msg) = bearer_token(&HeaderMap::new()).unwrap_err();

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(msg, "Missing Authorization header");
}

#[test]
fn bearer_token_rejects_other_schemes() {
    let headers = headers_with_auth("Basic dXNlcjpwYXNz");

    let (status, msg) = bearer_token(&headers).unwrap_err();

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(msg, "Invalid Authorization scheme");
}

#[test]
fn bearer_token_scheme_is_case_sensitive() {
    // "bearer" en minúscula no pasa, aunque el RFC 7235 lo permita.
    let headers = headers_with_auth("bearer abc.def.ghi");

    assert!(bearer_token(&headers).is_err());
}

#[test]
fn bearer_token_rejects_the_scheme_without_a_space() {
    let headers = headers_with_auth("Bearerabc.def.ghi");

    assert!(bearer_token(&headers).is_err());
}

#[test]
fn bearer_token_rejects_non_ascii_headers() {
    let mut headers = HeaderMap::new();
    headers.insert(
        "Authorization",
        HeaderValue::from_bytes(b"Bearer \xff\xfe").unwrap(),
    );

    let (status, msg) = bearer_token(&headers).unwrap_err();

    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(msg, "Invalid Authorization header");
}

#[test]
fn bearer_token_returns_empty_string_for_a_bare_scheme() {
    // "Bearer " solo devuelve Ok(""): el 401 lo termina tirando el decode,
    // no este parseo.
    let headers = headers_with_auth("Bearer ");

    assert_eq!(bearer_token(&headers).unwrap(), "");
}

#[test]
fn bearer_token_keeps_the_rest_of_the_value_verbatim() {
    // No hay trim: los espacios extra van al token y el decode los rechaza.
    let headers = headers_with_auth("Bearer  abc.def.ghi ");

    assert_eq!(bearer_token(&headers).unwrap(), " abc.def.ghi ");
}

// --- Respuestas ---

#[test]
fn user_never_exposes_the_password_hash() {
    let json = serde_json::to_value(sample_user()).unwrap();
    let obj = json.as_object().unwrap();

    let mut keys: Vec<&str> = obj.keys().map(|k| k.as_str()).collect();
    keys.sort_unstable();

    assert_eq!(keys, vec!["email", "id", "is_admin", "username"]);
    assert!(obj.get("password_hash").is_none());
    assert!(obj.get("password").is_none());
}

#[test]
fn user_serializes_id_as_a_uuid_string() {
    let json = serde_json::to_value(sample_user()).unwrap();

    assert_eq!(json["id"], uuid(1).to_string());
    assert_eq!(json["is_admin"], false);
}

#[test]
fn auth_response_carries_the_token_and_the_user() {
    let response = AuthResponse {
        token: "abc.def.ghi".to_string(),
        user: sample_user(),
    };

    let json = serde_json::to_value(response).unwrap();

    assert_eq!(json["token"], "abc.def.ghi");
    assert_eq!(json["user"]["username"], "bruno");
    assert!(json["user"].get("password_hash").is_none());

    let mut keys: Vec<&str> = json.as_object().unwrap().keys().map(|k| k.as_str()).collect();
    keys.sort_unstable();
    assert_eq!(keys, vec!["token", "user"]);
}

// --- Claims (payload del JWT) ---

#[test]
fn claims_survive_a_serde_roundtrip() {
    let claims = Claims {
        sub: "bruno".to_string(),
        user_id: uuid(1),
        exp: 1_800_000_000,
        is_admin: false,
    };

    let encoded = serde_json::to_string(&claims).unwrap();
    let decoded: Claims = serde_json::from_str(&encoded).unwrap();

    assert_eq!(decoded.sub, claims.sub);
    assert_eq!(decoded.user_id, claims.user_id);
    assert_eq!(decoded.exp, claims.exp);
    assert_eq!(decoded.is_admin, claims.is_admin);
}

#[test]
fn claims_use_the_exact_keys_the_jwt_payload_carries() {
    let claims = Claims {
        sub: "bruno".to_string(),
        user_id: uuid(1),
        exp: 1_800_000_000,
        is_admin: true,
    };

    let json = serde_json::to_value(claims).unwrap();
    let mut keys: Vec<&str> = json.as_object().unwrap().keys().map(|k| k.as_str()).collect();
    keys.sort_unstable();

    assert_eq!(keys, vec!["exp", "is_admin", "sub", "user_id"]);
    assert_eq!(json["exp"], 1_800_000_000_u64);
}

#[test]
fn claims_require_is_admin_to_be_present() {
    // Un token viejo sin is_admin no deserializa, así que no se cuela como
    // usuario común por defecto: falla la validación entera.
    let raw = json!({ "sub": "bruno", "user_id": uuid(1), "exp": 1_800_000_000_u64 }).to_string();

    assert!(serde_json::from_str::<Claims>(&raw).is_err());
}
