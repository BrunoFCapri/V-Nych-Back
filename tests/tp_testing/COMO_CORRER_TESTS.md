# Cómo correr todos los tests

Todos los comandos parten de la raíz del repo: `~/Proyectos/V-Nych-Backend`.

| Suite | Ubicación | Necesita backend levantado | Comando |
|---|---|---|---|
| Unitarios Rust existentes | `backend/src/tests/` | No | `cargo test` |
| Unitarios (5) | `tests/tp_testing/unit/` | No | `cargo test tp_testing::unit` |
| Integración (3) | `tests/tp_testing/integration/` | No | `cargo test tp_testing::integration` |
| Tests de API existentes (pytest) | `tests/test_*.py` | **Sí** | `pytest` |
| E2E POST `/api/notes` (3) | `tests/tp_testing/e2e/` | **Sí** | `pytest tp_testing/e2e` |
| Front: login (4) | `tests/tp_testing/frontend/` | No (se mockea) | `npx playwright test` |

---

## 1. Requisitos (una sola vez)

```bash
# Rust: las dependencias se bajan solas con cargo.

# Python: entorno virtual para pytest
cd tests
python3 -m venv venv
venv/bin/pip install -r requirements.txt
cd ..

# Front a testear (vive en ~/Proyectos/V-Nych-Fronted)
cd ../V-Nych-Fronted
npm install
cd ../V-Nych-Backend

# Playwright + navegador
cd tests/tp_testing/frontend
npm install
npx playwright install chromium
cd ../../..
```

## 2. Tests de Rust (unitarios + integración)

No necesitan Postgres ni Redis: la BD está mockeada.

```bash
cd backend

cargo test                          # todo: tests existentes + tp_testing
cargo test tp_testing               # sólo los de la entrega (5 unit + 3 integración)
cargo test tp_testing::unit         # sólo los 5 unitarios
cargo test tp_testing::integration  # sólo los 3 de integración

cd ..
```

## 3. Levantar el backend (para pytest / e2e)

```bash
docker compose up -d --build
curl localhost:3000/health          # tiene que responder: OK
```

## 4. Tests con pytest (API existente + e2e)

```bash
cd tests

venv/bin/pytest                     # todo: suite existente + e2e
venv/bin/pytest tp_testing/e2e      # sólo el e2e del POST /api/notes
venv/bin/pytest -m e2e              # lo mismo, por marker

cd ..
```

## 5. Test del front (flujo de login)

Playwright levanta solo el Vite de `~/Proyectos/V-Nych-Fronted` en el puerto 5174
y simula las respuestas del backend, así que no hace falta el backend.

```bash
cd tests/tp_testing/frontend

npx playwright test                 # corre los 4 tests
npx playwright test --headed        # viendo el navegador
npx playwright test --ui            # modo interactivo

# Si el front está en otra carpeta:
FRONTEND_DIR=/ruta/al/front npx playwright test

cd ../../..
```

## 6. Todo de una

```bash
(cd backend && cargo test) \
  && docker compose up -d --build \
  && (cd tests && venv/bin/pytest) \
  && (cd tests/tp_testing/frontend && npx playwright test)
```

Al terminar, se puede bajar el stack con `docker compose down`.

## Resultado esperado

| Suite | Resultado |
|---|---|
| `cargo test` | 113 passed |
| `pytest` | 107 passed, 1 failed |
| `playwright test` | 4 passed |

El único fallo es `test_calendar.py::TestCalendarEvents::test_create_event_minimal`:
ya fallaba antes de esta entrega. El test espera el color `#3B82F6` y el backend
devuelve `#3b82f6`.
