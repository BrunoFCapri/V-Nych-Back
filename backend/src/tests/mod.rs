//! Tests unitarios del backend, un archivo por módulo.
//!
//! Sólo lógica pura: serde de payloads y respuestas, defaults y parseo de
//! query strings. Nada acá toca Postgres ni Redis. Los tests que sí necesitan
//! la API levantada viven en la suite de pytest de `tests/` en la raíz del repo.

mod calendar;
mod notes;
mod tasks;
mod users;
