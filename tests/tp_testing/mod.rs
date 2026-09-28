//! Suite de la entrega de testing del backend.
//!
//! Se compila dentro del crate `backend` (ver `#[path]` en `backend/src/main.rs`)
//! para poder usar `crate::...`. Correr con `cargo test tp_testing` desde `backend/`.
//!
//! - `unit`: 5 tests unitarios de la lógica de auth con el `UserStore` mockeado.
//! - `integration`: 3 tests que pasan por router + extractor + handler reales,
//!   mockeando sólo el acceso a la BD.

// Declara el submódulo de integración; Rust lo busca en `integration/mod.rs`.
mod integration;
// Declara el submódulo de unitarios; Rust lo busca en `unit/mod.rs`.
mod unit;
