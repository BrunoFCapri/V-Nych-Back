//! Tests unitarios de `users::register_user` y `users::authenticate`.
//!
//! Cada test ejercita una sola función y reemplaza la BD (el flujo externo)
//! por un `MockUserStore` generado con mockall.

// Importa del módulo `users` del backend lo que se va a testear y usar:
use crate::users::{
    admin_password_for_tests, // contraseña del admin hardcodeado (sólo visible en tests)
    authenticate,             // función bajo test: login
    decode_token,             // decodifica un JWT para verificar su contenido
    register_user,            // función bajo test: registro
    LoginRequest,             // payload de login
    MockUserStore,            // mock de la BD generado por mockall a partir del trait UserStore
    RegisterRequest,          // payload de registro
    StoreError,               // errores que puede devolver la BD
    User,                     // usuario tal como lo devuelve la API
    UserCredentials,          // usuario + hash de contraseña, como está guardado en la BD
};
// Importa argon2 para generar hashes de contraseña como los que guarda la BD:
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString}, // generador aleatorio, trait de hasheo y sal
    Argon2,                                                        // algoritmo de hasheo
};
// Importa los códigos HTTP para comparar los errores devueltos.
use axum::http::StatusCode;
// Importa Uuid para generar y comparar ids de usuario.
use uuid::Uuid;

// Contraseña válida que usan todos los tests.
const PASSWORD: &str = "Secreta123!";

// Devuelve el hash argon2 de una contraseña (simula lo que hay guardado en la BD).
fn hash(password: &str) -> String {
    // Genera una sal aleatoria nueva.
    let salt = SaltString::generate(&mut OsRng);
    // Crea el hasher argon2 con la configuración por defecto.
    Argon2::default()
        // Hashea la contraseña con esa sal.
        .hash_password(password.as_bytes(), &salt)
        // En un test un error acá es un bug, así que se hace panic.
        .unwrap()
        // Convierte el hash al formato texto `$argon2...`.
        .to_string()
}

// Arma las credenciales que "devolvería" la BD para el usuario con este id.
fn stored_credentials(id: Uuid) -> UserCredentials {
    // Construye el struct con datos fijos de prueba.
    UserCredentials {
        id,                                       // id recibido por parámetro
        username: "bruno".to_string(),            // nombre de usuario de prueba
        email: "bruno@example.com".to_string(),   // email de prueba
        password_hash: hash(PASSWORD),            // hash real de la contraseña válida
    }
}

// Arma un payload de registro válido.
fn register_request() -> RegisterRequest {
    // Construye el request con datos fijos de prueba.
    RegisterRequest {
        username: "bruno".to_string(),          // nombre de usuario
        email: "bruno@example.com".to_string(), // email
        password: PASSWORD.to_string(),         // contraseña en texto plano (como la manda el cliente)
    }
}

// Arma un payload de login con el identificador y contraseña indicados.
fn login_request(identifier: &str, password: &str) -> LoginRequest {
    // Construye el request copiando los valores recibidos.
    LoginRequest {
        identifier: identifier.to_string(), // usuario o email
        password: password.to_string(),     // contraseña
    }
}

// Test 1: el registro exitoso guarda un hash (no la contraseña) y devuelve un JWT válido.
#[tokio::test] // Test asíncrono ejecutado sobre el runtime de tokio.
async fn register_user_guarda_el_hash_y_devuelve_un_token_valido() {
    // Crea el mock de la BD.
    let mut store = MockUserStore::new();
    // Configura qué se espera que haga la función con la BD:
    store
        // Se espera una llamada a `insert_user`...
        .expect_insert_user()
        // ...con estos argumentos:
        .withf(|_, username, email, password_hash| {
            // Nunca se guarda la contraseña en texto plano.
            username == "bruno"                          // el username que vino en el request
                && email == "bruno@example.com"          // el email que vino en el request
                && password_hash.starts_with("$argon2")  // un hash argon2
                && !password_hash.contains(PASSWORD)     // que no contenga la contraseña original
        })
        // ...exactamente una vez...
        .times(1)
        // ...y el mock responde como si el INSERT hubiera funcionado.
        .returning(|id, username, email, _| {
            // Devuelve el usuario creado con los mismos datos recibidos.
            Ok(User {
                id,                              // mismo id que generó la función
                username: username.to_string(), // mismo username
                email: email.to_string(),       // mismo email
                is_admin: false,                // un registro nunca crea admins
            })
        });

    // Ejecuta la función bajo test con el mock; si devuelve error el test falla.
    let response = register_user(&store, register_request()).await.unwrap();

    // Decodifica el token devuelto (falla si la firma no es válida).
    let claims = decode_token(&response.token).unwrap();
    // El token pertenece al usuario creado.
    assert_eq!(claims.user_id, response.user.id);
    // El `sub` del token es el username.
    assert_eq!(claims.sub, "bruno");
    // El token no da permisos de admin.
    assert!(!claims.is_admin);
}

// Test 2: si la BD informa duplicado, la función responde 409 Conflict.
#[tokio::test] // Test asíncrono ejecutado sobre el runtime de tokio.
async fn register_user_con_usuario_duplicado_devuelve_409() {
    // Crea el mock de la BD.
    let mut store = MockUserStore::new();
    // Configura el mock:
    store
        // Se espera una llamada a `insert_user`...
        .expect_insert_user()
        // ...exactamente una vez...
        .times(1)
        // ...y la BD responde que el usuario/email ya existe.
        .returning(|_, _, _, _| Err(StoreError::Duplicate));

    // Ejecuta la función; se espera error, así que se extrae con `unwrap_err`.
    let (status, message) = register_user(&store, register_request()).await.unwrap_err();

    // El código HTTP es 409.
    assert_eq!(status, StatusCode::CONFLICT);
    // El mensaje es el mismo que ve el cliente real.
    assert_eq!(message, "Username or email already exists");
}

// Test 3: login con contraseña correcta devuelve el usuario y un token suyo.
#[tokio::test] // Test asíncrono ejecutado sobre el runtime de tokio.
async fn authenticate_con_password_correcta_devuelve_el_usuario() {
    // Genera un id de usuario aleatorio.
    let id = Uuid::new_v4();
    // Arma las credenciales que va a devolver la BD mockeada.
    let credentials = stored_credentials(id);
    // Crea el mock de la BD.
    let mut store = MockUserStore::new();
    // Configura el mock:
    store
        // Se espera una búsqueda de usuario...
        .expect_find_by_identifier()
        // ...por el email que se usa en el login...
        .withf(|identifier| identifier == "bruno@example.com")
        // ...exactamente una vez...
        .times(1)
        // ...y la BD devuelve el usuario encontrado.
        .returning(move |_| Ok(Some(credentials.clone())));

    // Ejecuta el login con la contraseña correcta.
    let response = authenticate(&store, login_request("bruno@example.com", PASSWORD))
        // Espera el resultado asíncrono.
        .await
        // Si devolvió error, el test falla.
        .unwrap();

    // Devuelve el usuario de la BD.
    assert_eq!(response.user.id, id);
    // Con su username.
    assert_eq!(response.user.username, "bruno");
    // Y el token corresponde a ese usuario.
    assert_eq!(decode_token(&response.token).unwrap().user_id, id);
}

// Test 4: login con contraseña incorrecta devuelve 401.
#[tokio::test] // Test asíncrono ejecutado sobre el runtime de tokio.
async fn authenticate_con_password_incorrecta_devuelve_401() {
    // Credenciales guardadas con la contraseña válida.
    let credentials = stored_credentials(Uuid::new_v4());
    // Crea el mock de la BD.
    let mut store = MockUserStore::new();
    // Configura el mock:
    store
        // Se espera una búsqueda de usuario...
        .expect_find_by_identifier()
        // ...exactamente una vez...
        .times(1)
        // ...y la BD encuentra al usuario.
        .returning(move |_| Ok(Some(credentials.clone())));

    // Ejecuta el login con una contraseña que no coincide con el hash.
    let (status, message) = authenticate(&store, login_request("bruno", "otra-clave"))
        // Espera el resultado asíncrono.
        .await
        // Se espera error; si devuelve Ok el test falla.
        .unwrap_err();

    // El código HTTP es 401.
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    // El mensaje no revela si falló el usuario o la contraseña.
    assert_eq!(message, "Invalid email or password");
}

// Test 5: el login del admin hardcodeado no toca la BD.
#[tokio::test] // Test asíncrono ejecutado sobre el runtime de tokio.
async fn authenticate_admin_no_consulta_la_bd() {
    // Crea el mock de la BD.
    let mut store = MockUserStore::new();
    // Si se llegara a buscar un usuario en la BD, el test falla.
    store.expect_find_by_identifier().never();

    // Login como admin (en mayúsculas: el usuario no distingue mayúsculas).
    let response = authenticate(&store, login_request("ADMIN", admin_password_for_tests()))
        // Espera el resultado asíncrono.
        .await
        // Si devolvió error, el test falla.
        .unwrap();

    // El usuario devuelto es admin.
    assert!(response.user.is_admin);
    // El admin usa el UUID nulo como id.
    assert_eq!(response.user.id, Uuid::nil());
    // El token también lleva el permiso de admin.
    assert!(decode_token(&response.token).unwrap().is_admin);
}
