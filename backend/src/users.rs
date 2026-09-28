use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Pool, Postgres};
use uuid::Uuid;
use argon2::{
    password_hash::{
        rand_core::OsRng,
        PasswordHash, PasswordHasher, PasswordVerifier, SaltString
    },
    Argon2
};
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use chrono::{Utc, Duration};
use crate::AppState;

#[derive(Debug, Serialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub is_admin: bool,
    // we don't return the password hash
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub identifier: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: User,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // username
    pub user_id: Uuid,
    pub exp: usize,
    pub is_admin: bool,
}

use axum::{
    async_trait,
    extract::FromRequestParts,
    http::request::Parts,
};

// Extracts the token out of an `Authorization: Bearer <token>` header.
pub fn bearer_token(headers: &axum::http::HeaderMap) -> Result<&str, (StatusCode, String)> {
    let auth_header = headers
        .get("Authorization")
        .ok_or((StatusCode::UNAUTHORIZED, "Missing Authorization header".to_string()))?
        .to_str()
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid Authorization header".to_string()))?;

    if !auth_header.starts_with("Bearer ") {
        return Err((StatusCode::UNAUTHORIZED, "Invalid Authorization scheme".to_string()));
    }

    Ok(&auth_header["Bearer ".len()..])
}

#[async_trait]
impl FromRequestParts<AppState> for Claims {
    type Rejection = (StatusCode, String);

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let token = bearer_token(&parts.headers)?;

        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(JWT_SECRET),
            &Validation::default(),
        )
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid token".to_string()))?;

        if token_data.claims.is_admin {
            return Ok(token_data.claims);
        }

        let user_exists = state
            .users
            .user_exists(token_data.claims.user_id)
            .await
            .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid token".to_string()))?;

        if !user_exists {
            return Err((StatusCode::UNAUTHORIZED, "Token user no longer exists".to_string()));
        }

        Ok(token_data.claims)
    }
}


// Secret for JWT - in production this should be in .env
const JWT_SECRET: &[u8] = b"secret_key_change_me_in_production";
pub const ADMIN_USERNAME: &str = "admin";
const ADMIN_PASSWORD: &str = "Bannana13@";

// The hardcoded admin shortcut in `login`, bypassing the users table.
pub fn is_admin_login(identifier: &str, password: &str) -> bool {
    identifier.eq_ignore_ascii_case(ADMIN_USERNAME) && password == ADMIN_PASSWORD
}

#[cfg(test)]
pub(crate) fn admin_password_for_tests() -> &'static str {
    ADMIN_PASSWORD
}

// Row needed to check a login: the user plus their password hash.
#[derive(Debug, Clone, FromRow)]
pub struct UserCredentials {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub password_hash: String,
}

#[derive(Debug)]
pub enum StoreError {
    Duplicate,
    Other(String),
}

// Access to the `users` table. Behind a trait so tests can mock the database.
#[cfg_attr(test, mockall::automock)]
#[async_trait]
pub trait UserStore: Send + Sync {
    async fn insert_user(
        &self,
        id: Uuid,
        username: &str,
        email: &str,
        password_hash: &str,
    ) -> Result<User, StoreError>;
    async fn find_by_identifier(&self, identifier: &str) -> Result<Option<UserCredentials>, StoreError>;
    async fn user_exists(&self, id: Uuid) -> Result<bool, StoreError>;
}

pub struct PgUserStore {
    db: Pool<Postgres>,
}

impl PgUserStore {
    pub fn new(db: Pool<Postgres>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl UserStore for PgUserStore {
    async fn insert_user(
        &self,
        id: Uuid,
        username: &str,
        email: &str,
        password_hash: &str,
    ) -> Result<User, StoreError> {
        sqlx::query_as::<_, User>(
            r#"
            INSERT INTO users (id, username, email, password_hash)
            VALUES ($1, $2, $3, $4)
            RETURNING id, username, email, false as is_admin
            "#
        )
        .bind(id)
        .bind(username)
        .bind(email)
        .bind(password_hash)
        .fetch_one(&self.db)
        .await
        .map_err(|e| {
            if e.to_string().contains("duplicate key value violates unique constraint") {
                StoreError::Duplicate
            } else {
                StoreError::Other(e.to_string())
            }
        })
    }

    async fn find_by_identifier(&self, identifier: &str) -> Result<Option<UserCredentials>, StoreError> {
        sqlx::query_as::<_, UserCredentials>(
            "SELECT id, username, email, password_hash FROM users WHERE email = $1 OR username = $1"
        )
        .bind(identifier)
        .fetch_optional(&self.db)
        .await
        .map_err(|e| StoreError::Other(e.to_string()))
    }

    async fn user_exists(&self, id: Uuid) -> Result<bool, StoreError> {
        sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)")
            .bind(id)
            .fetch_one(&self.db)
            .await
            .map_err(|e| StoreError::Other(e.to_string()))
    }
}

// Signs a 24h JWT for the given user.
pub fn issue_token(user: &User) -> Result<String, (StatusCode, String)> {
    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(24))
        .expect("valid timestamp")
        .timestamp();

    let claims = Claims {
        sub: user.username.clone(),
        user_id: user.id,
        exp: expiration as usize,
        is_admin: user.is_admin,
    };

    encode(&Header::default(), &claims, &EncodingKey::from_secret(JWT_SECRET))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Token creation error: {}", e)))
}

pub fn decode_token(token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    decode::<Claims>(token, &DecodingKey::from_secret(JWT_SECRET), &Validation::default())
        .map(|data| data.claims)
}

pub async fn register_user(
    store: &dyn UserStore,
    payload: RegisterRequest,
) -> Result<AuthResponse, (StatusCode, String)> {
    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(payload.password.as_bytes(), &salt)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Hashing error: {}", e)))?
        .to_string();

    let user = store
        .insert_user(Uuid::new_v4(), &payload.username, &payload.email, &password_hash)
        .await
        .map_err(|e| match e {
            StoreError::Duplicate => (StatusCode::CONFLICT, "Username or email already exists".to_string()),
            StoreError::Other(msg) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", msg)),
        })?;

    let token = issue_token(&user)?;
    Ok(AuthResponse { token, user })
}

pub async fn authenticate(
    store: &dyn UserStore,
    payload: LoginRequest,
) -> Result<AuthResponse, (StatusCode, String)> {
    if is_admin_login(&payload.identifier, &payload.password) {
        let user = User {
            id: Uuid::nil(),
            username: ADMIN_USERNAME.to_string(),
            email: "admin@local".to_string(),
            is_admin: true,
        };
        let token = issue_token(&user)?;
        return Ok(AuthResponse { token, user });
    }

    let credentials = store
        .find_by_identifier(&payload.identifier)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {:?}", e)))?
        .ok_or((StatusCode::UNAUTHORIZED, "Invalid email or password".to_string()))?;

    let parsed_hash = PasswordHash::new(&credentials.password_hash)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Invalid password hash in DB".to_string()))?;

    Argon2::default()
        .verify_password(payload.password.as_bytes(), &parsed_hash)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid email or password".to_string()))?;

    let user = User {
        id: credentials.id,
        username: credentials.username,
        email: credentials.email,
        is_admin: false,
    };
    let token = issue_token(&user)?;
    Ok(AuthResponse { token, user })
}

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    register_user(state.users.as_ref(), payload).await.map(Json)
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    authenticate(state.users.as_ref(), payload).await.map(Json)
}
