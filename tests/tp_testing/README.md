# Entrega de testing

| Tipo          | Cant. | Dónde                          | Herramientas                                   | Qué se mockea                              |
| ------------- | ----- | ------------------------------- | ---------------------------------------------- | ------------------------------------------- |
| Unitarios     | 5     | `unit/mod.rs`                 | `cargo test`, `tokio::test`, `mockall`   | La BD (`MockUserStore`)                   |
| Integración  | 3     | `integration/mod.rs`          | `cargo test`, `tower::ServiceExt::oneshot` | Sólo la BD (`MockUserStore`)             |
| E2E (POST)    | 3     | `e2e/test_e2e_create_note.py` | `pytest`, `requests`                       | Nada: backend + Postgres reales             |
| Front (login) | 4     | `frontend/`                   | npx playwright test login.spec.ts --ui         | Las respuestas del backend (`page.route`) |

## Cómo se mockea la BD

El acceso a la tabla `users` está detrás del trait `UserStore` (`backend/src/users.rs`).
En producción `AppState.users` es un `PgUserStore`; en los tests es el `MockUserStore`
que genera `mockall`. La lógica de auth vive en `register_user` / `authenticate`,
que reciben el store, y los handlers `register` / `login` sólo delegan en ellas.

- **Unitarios**: llaman directo a `register_user` / `authenticate` con el mock.
- **Integración**: arman el router real (`build_router`) y le mandan requests HTTP;
  pasan por el extractor `Claims`, los handlers, argon2 y JWT. El pool de Postgres
  es `connect_lazy` y nunca se conecta.

## Cómo correrlos

```bash
# Unitarios + integración (desde backend/)
cargo test tp_testing

# E2E: con el stack levantado (docker compose up -d), desde tests/
pytest tp_testing/e2e
pytest -m e2e

# Front: necesita ../V-Nych-Fronted con `npm install` hecho
cd tests/tp_testing/frontend
npm install
npx playwright install chromium
npx playwright test
```

El test del front levanta solo el dev server de Vite en el puerto 5174. Si el front
está en otra ruta: `FRONTEND_DIR=/ruta/al/front npx playwright test`.
