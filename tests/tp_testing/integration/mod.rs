//! Tests de integración: la request HTTP recorre el router real, el extractor
//! `Claims`, los handlers, argon2 y JWT. Lo único mockeado es la BD
//! (`MockUserStore`). El pool de Postgres es lazy y nunca se conecta.

// Importa del backend: generador de tokens, mock de la BD y modelos de usuario.
use crate::users::{issue_token, MockUserStore, User, UserCredentials};
// Importa el router real de la app y el estado compartido que recibe.
use crate::{build_router, AppState};
// Importa argon2 para generar un hash como el que guarda la BD:
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString}, // generador aleatorio, trait de hasheo y sal
    Argon2,                                                        // algoritmo de hasheo
};
// Importa los tipos HTTP de axum:
use axum::{
    body::Body,                               // cuerpo de requests/responses
    http::{header, Request, StatusCode},      // nombres de headers, request y códigos HTTP
};
// Trait que permite leer el cuerpo completo de la respuesta (`collect`).
use http_body_util::BodyExt;
// Macro `json!` para armar JSON y tipo `Value` para leerlo.
use serde_json::{json, Value};
// Opciones para crear el pool de Postgres (se usa en modo lazy).
use sqlx::postgres::PgPoolOptions;
// Puntero compartido para guardar el mock dentro del estado.
use std::sync::Arc;
// Trait que agrega `oneshot`: mandar una request al router sin levantar un servidor.
use tower::ServiceExt;
// Uuid para ids de usuario.
use uuid::Uuid;

// Arma el estado de la app con el mock de BD en lugar de Postgres.
fn state_with(store: MockUserStore) -> AppState {
    // Construye el mismo AppState que usa main.rs.
    AppState {
        // Pool de Postgres obligatorio en el estado:
        db: PgPoolOptions::new()
            // `connect_lazy` no se conecta hasta usarse; estas rutas nunca lo usan.
            .connect_lazy("postgres://mock:mock@127.0.0.1:1/unused")
            // La URL es válida sintácticamente, así que no falla.
            .unwrap(),
        // Cliente de Redis: `open` sólo parsea la URL, no se conecta.
        redis: redis::Client::open("redis://127.0.0.1:1/").unwrap(),
        // El acceso a la tabla users pasa por el mock.
        users: Arc::new(store),
    }
}

// Manda una request al router real y devuelve el código y el cuerpo de la respuesta.
async fn send(store: MockUserStore, request: Request<Body>) -> (StatusCode, Vec<u8>) {
    // Crea el router con el estado mockeado y le pasa una única request.
    let response = build_router(state_with(store)).oneshot(request).await.unwrap();
    // Guarda el código HTTP.
    let status = response.status();
    // Lee el cuerpo completo y lo convierte a bytes.
    let body = response.into_body().collect().await.unwrap().to_bytes().to_vec();
    // Devuelve ambos.
    (status, body)
}

// Arma una request POST con cuerpo JSON.
fn post_json(uri: &str, body: Value) -> Request<Body> {
    // Request POST a la ruta indicada...
    Request::post(uri)
        // ...con header de contenido JSON...
        .header(header::CONTENT_TYPE, "application/json")
        // ...y el JSON serializado como cuerpo.
        .body(Body::from(body.to_string()))
        // Construir la request no puede fallar con estos datos.
        .unwrap()
}

// Test 1: POST /api/auth/register responde 200 con token y usuario.
#[tokio::test] // Test asíncrono ejecutado sobre el runtime de tokio.
async fn post_register_responde_200_con_token_y_usuario() {
    // Crea el mock de la BD.
    let mut store = MockUserStore::new();
    // Configura el mock:
    store
        // Se espera un INSERT de usuario...
        .expect_insert_user()
        // ...exactamente una vez...
        .times(1)
        // ...y la BD devuelve el usuario creado.
        .returning(|id, username, email, _| {
            // Usuario con los datos que llegaron desde el handler.
            Ok(User {
                id,                              // id generado por el backend
                username: username.to_string(), // username del request
                email: email.to_string(),       // email del request
                is_admin: false,                // los registros nunca son admin
            })
        });

    // Arma la request HTTP de registro.
    let request = post_json(
        "/api/auth/register", // ruta real del router
        json!({ "username": "bruno", "email": "bruno@example.com", "password": "Secreta123!" }), // cuerpo
    );
    // La manda por el router completo.
    let (status, body) = send(store, request).await;

    // Respondió 200 OK.
    assert_eq!(status, StatusCode::OK);
    // Parsea el cuerpo como JSON.
    let body: Value = serde_json::from_slice(&body).unwrap();
    // El usuario devuelto tiene el username enviado.
    assert_eq!(body["user"]["username"], "bruno");
    // Y el email enviado.
    assert_eq!(body["user"]["email"], "bruno@example.com");
    // Y no es admin.
    assert_eq!(body["user"]["is_admin"], false);
    // Hay un token y no está vacío.
    assert!(body["token"].as_str().is_some_and(|t| !t.is_empty()));
    // La respuesta no filtra el hash de la contraseña.
    assert!(body.get("password_hash").is_none());
}

// Test 2: POST /api/auth/login con contraseña incorrecta responde 401.
#[tokio::test] // Test asíncrono ejecutado sobre el runtime de tokio.
async fn post_login_con_password_incorrecta_responde_401() {
    // Genera una sal aleatoria.
    let salt = SaltString::generate(&mut OsRng);
    // Hashea la contraseña real del usuario, como estaría en la BD.
    let password_hash = Argon2::default()
        // Hashea "Secreta123!" con la sal.
        .hash_password(b"Secreta123!", &salt)
        // No puede fallar con estos datos.
        .unwrap()
        // Lo pasa a texto `$argon2...`.
        .to_string();
    // Arma la fila que devolvería la BD.
    let credentials = UserCredentials {
        id: Uuid::new_v4(),                     // id aleatorio
        username: "bruno".to_string(),          // username
        email: "bruno@example.com".to_string(), // email
        password_hash,                          // hash de la contraseña real
    };

    // Crea el mock de la BD.
    let mut store = MockUserStore::new();
    // Configura el mock:
    store
        // Se espera una búsqueda por usuario/email...
        .expect_find_by_identifier()
        // ...exactamente una vez...
        .times(1)
        // ...y la BD encuentra al usuario.
        .returning(move |_| Ok(Some(credentials.clone())));

    // Arma la request de login con una contraseña equivocada.
    let request = post_json(
        "/api/auth/login",                                          // ruta real del router
        json!({ "identifier": "bruno", "password": "incorrecta" }), // cuerpo
    );
    // La manda por el router completo.
    let (status, body) = send(store, request).await;

    // Respondió 401 Unauthorized.
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    // Con el mensaje genérico de credenciales inválidas.
    assert_eq!(String::from_utf8(body).unwrap(), "Invalid email or password");
}

// Test 3: una ruta protegida rechaza un token válido cuyo usuario fue borrado.
#[tokio::test] // Test asíncrono ejecutado sobre el runtime de tokio.
async fn ruta_protegida_rechaza_token_de_usuario_eliminado() {
    // Usuario al que se le emite el token.
    let user = User {
        id: Uuid::new_v4(),                     // id aleatorio
        username: "bruno".to_string(),          // username
        email: "bruno@example.com".to_string(), // email
        is_admin: false,                        // usuario común (el admin no consulta la BD)
    };
    // Genera un JWT firmado válido para ese usuario.
    let token = issue_token(&user).unwrap();
    // Guarda el id para usarlo dentro del closure del mock.
    let user_id = user.id;

    // El token es válido pero el usuario ya no está en la BD.
    let mut store = MockUserStore::new();
    // Configura el mock:
    store
        // Se espera que el extractor `Claims` pregunte si el usuario existe...
        .expect_user_exists()
        // ...por el id que viene dentro del token...
        .withf(move |id| *id == user_id)
        // ...exactamente una vez...
        .times(1)
        // ...y la BD responde que no existe.
        .returning(|_| Ok(false));

    // Arma un GET a una ruta protegida.
    let request = Request::get("/api/notes")
        // Con el token en el header Authorization.
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        // Sin cuerpo.
        .body(Body::empty())
        // Construir la request no puede fallar.
        .unwrap();
    // La manda por el router completo.
    let (status, body) = send(store, request).await;

    // El extractor la corta con 401 antes de llegar al handler de notas.
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    // Con el mensaje específico de usuario inexistente.
    assert_eq!(String::from_utf8(body).unwrap(), "Token user no longer exists");
}
