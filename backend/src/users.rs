use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
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

#[async_trait]
impl FromRequestParts<AppState> for Claims {
    type Rejection = (StatusCode, String);

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get("Authorization")
            .ok_or((StatusCode::UNAUTHORIZED, "Missing Authorization header".to_string()))?
            .to_str()
            .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid Authorization header".to_string()))?;

        if !auth_header.starts_with("Bearer ") {
            return Err((StatusCode::UNAUTHORIZED, "Invalid Authorization scheme".to_string()));
        }

        let token = &auth_header["Bearer ".len()..];
        
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(JWT_SECRET),
            &Validation::default(),
        )
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid token".to_string()))?;

        if token_data.claims.is_admin {
            return Ok(token_data.claims);
        }

        let user_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)"
        )
        .bind(token_data.claims.user_id)
        .fetch_one(&state.db)
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
const ADMIN_USERNAME: &str = "admin";
const ADMIN_PASSWORD: &str = "Bannana13@";

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    // 1. Hash the password
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2.hash_password(payload.password.as_bytes(), &salt)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Hashing error: {}", e)))?
        .to_string();

    // 2. Insert user into DB
    let user_id = Uuid::new_v4();
    let row = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (id, username, email, password_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING id, username, email, false as is_admin
        "#
    )
    .bind(user_id)
    .bind(&payload.username)
    .bind(&payload.email)
    .bind(&password_hash)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        // Handle duplicate email/username
        if e.to_string().contains("duplicate key value violates unique constraint") {
            (StatusCode::CONFLICT, "Username or email already exists".to_string())
        } else {
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e))
        }
    })?;

    let user = row.ok_or((StatusCode::INTERNAL_SERVER_ERROR, "Failed to create user".to_string()))?;

    // 3. Generate JWT
    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(24))
        .expect("valid timestamp")
        .timestamp();

    let claims = Claims {
        sub: user.username.clone(),
        user_id: user.id,
        exp: expiration as usize,
        is_admin: false,
    };

    let token = encode(&Header::default(), &claims, &EncodingKey::from_secret(JWT_SECRET))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Token creation error: {}", e)))?;

    Ok(Json(AuthResponse { token, user }))
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    if payload.identifier.eq_ignore_ascii_case(ADMIN_USERNAME) && payload.password == ADMIN_PASSWORD {
        let admin_user = User {
            id: Uuid::nil(),
            username: ADMIN_USERNAME.to_string(),
            email: "admin@local".to_string(),
            is_admin: true,
        };

        let expiration = Utc::now()
            .checked_add_signed(Duration::hours(24))
            .expect("valid timestamp")
            .timestamp();

        let claims = Claims {
            sub: admin_user.username.clone(),
            user_id: admin_user.id,
            exp: expiration as usize,
            is_admin: true,
        };

        let token = encode(&Header::default(), &claims, &EncodingKey::from_secret(JWT_SECRET))
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Token creation error: {}", e)))?;

        return Ok(Json(AuthResponse { token, user: admin_user }));
    }

    // 1. Find user by username or email
    #[derive(FromRow)]
    struct UserLoginDetails {
        pub id: Uuid,
        pub username: String,
        pub email: String,
        pub password_hash: String,
        pub is_admin: bool,
    }

    let row = sqlx::query_as::<_, UserLoginDetails>(
        "SELECT id, username, email, password_hash, false as is_admin FROM users WHERE email = $1 OR username = $1"
    )
    .bind(&payload.identifier)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    let user_data = row.ok_or((StatusCode::UNAUTHORIZED, "Invalid email or password".to_string()))?;

    // 2. Verify password
    let parsed_hash = PasswordHash::new(&user_data.password_hash)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Invalid password hash in DB".to_string()))?;
    
    Argon2::default().verify_password(payload.password.as_bytes(), &parsed_hash)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid email or password".to_string()))?;

    // 3. Generate JWT
    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(24))
        .expect("valid timestamp")
        .timestamp();

    let claims = Claims {
        sub: user_data.username.clone(),
        user_id: user_data.id,
        exp: expiration as usize,
        is_admin: user_data.is_admin,
    };

    let token = encode(&Header::default(), &claims, &EncodingKey::from_secret(JWT_SECRET))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Token creation error: {}", e)))?;

    let user = User {
        id: user_data.id,
        username: user_data.username,
        email: user_data.email,
        is_admin: user_data.is_admin,
    };

    Ok(Json(AuthResponse { token, user }))
}
