# V-NYCH 🪲

Una infraestructura de productividad integral, multiplataforma y de alto rendimiento desarrollada desde cero. V-NYCH toma su identidad del manuscrito de Voynich y reemplaza la dependencia de servicios de terceros (Google Calendar, Notion, Google Tasks) mediante una arquitectura de microservicios soberana, diseñada para la eficiencia extrema en hardware local (**Raspberry Pi 5 / CapiOS**).

---

## 🎯 Core Features & Multi-Platform

* **📅 Calendar Engine (Rust):** Implementación nativa de lógica de eventos y recurrencias (RFC 5545) con sistema de notificaciones push asíncronas.
* **📝 Block-Based Notes (Rust):** Motor de notas estilo Notion con soporte para tipos de datos complejos y persistencia en tiempo real.
* **✅ Task Orchestrator (Rust):** Gestión de tareas con prioridades, estados de ciclo de vida y sincronización multi-dispositivo.
* **📱 Mobile App (React Native):** Aplicación móvil nativa con notificaciones de eventos en tiempo real y modo offline.
* **💻 Desktop Client (Tauri/Rust):** Cliente de escritorio ultra-ligero que aprovecha el backend en Rust para un consumo mínimo de recursos.
* **📟 Terminal UI - Lite Version (Rust/TUI):** Versión de terminal optimizada para **CapiOS**. Diseñada para consumir el mínimo de energía y CPU, ideal para gestión rápida vía SSH o local.
* **🐳 Infra-Controller (Go):** Gestor de infraestructura que interactúa con el Docker SDK para el despliegue automático y monitoreo de salud de los servicios.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Rol / Implementación |
| :--- | :--- | :--- |
| **Backend Core** | **Rust** (Axum/Tokio) | Lógica de negocio con seguridad de memoria y alta concurrencia. |
| **Orquestación** | **Go** | Scripts de gestión para Docker Engine y automatización de la infra. |
| **Mobile App** | **React Native** | Interfaz móvil multiplataforma con integración de notificaciones push. |
| **Desktop / TUI** | **Tauri / Ratatui** | Clientes livianos enfocados en performance y bajo consumo. |
| **Database** | PostgreSQL | Persistencia relacional robusta para datos estructurados. |
| **Cache** | Redis | Gestión de sesiones y colas de tareas rápidas. |
| **Runtime** | Docker / Debian | Aislamiento de servicios en arquitectura ARM64 (**CapiOS**). |

---

## 🏗️ Arquitectura del Sistema

```text
[ Mobile App ] <───┐          [ Desktop / TUI ]
           │                 │
           ▼                 ▼
    [ Reverse Proxy: Nginx/Traefik ]
           │
   ├─► [ Service: Notes & Calendar (Rust) ] ──► [ PostgreSQL ]
   │
   ├─► [ Infra-Controller (Go) ] ────────────► [ Docker SDK ]
   │
   └─► [ Auth & Session (Redis) ]
```

---

## Origen Del Nombre

`V-NYCH` está inspirado en el **manuscrito de Voynich**: una referencia a conocimiento cifrado, privado y difícil de exponer sin contexto. El nombre refleja la idea central del proyecto: datos personales bajo control del usuario, sin depender de plataformas externas.

## Estado Actual Del Proyecto

Actualmente el repositorio incluye:

- **Autenticación JWT** (registro/login) con protección por usuario.
- **Notas tipo bloques** con contenido JSON y soporte de jerarquía (`parent_id`).
- **Calendario** con CRUD de eventos, colores y filtros por rango de fechas.
- **Tareas y listas** con estados, prioridad, subtareas y elementos destacados.
- **Adjuntos en tareas**: subir, listar, descargar y eliminar archivos por tarea.
- **Health checks** para backend, PostgreSQL y Redis.
- **Infra local con Docker Compose** para DB + caché.

## Stack Tecnologico

- **Backend**: Rust, Axum, Tokio, SQLx
- **Frontend**: React + TypeScript + Vite
- **Base de datos**: PostgreSQL
- **Cache / sesiones**: Redis
- **Infra**: Docker Compose

## Arquitectura (Resumen)

```text
Web (React + Vite)
       |
       v
API REST (Rust / Axum)
   |                 |
   v                 v
PostgreSQL         Redis
```

## Endpoints Principales

- `GET /health`
- `GET /api/status`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET|POST /api/notes`
- `GET|PATCH|DELETE /api/notes/:id`
- `GET|POST /api/calendar/events`
- `GET|PATCH|DELETE /api/calendar/events/:id`
- `GET|POST /api/tasks`
- `PATCH|DELETE /api/tasks/:id`
- `GET|POST /api/tasks/:id/attachments`
- `GET|DELETE /api/tasks/:id/attachments/:attachment_id`

## 📁 Gestor de Archivos (Drive)

La aplicación incluye una vista tipo "Google Drive" donde cada usuario puede:

- **Ver todos sus archivos subidos** (de cualquier tarea o independientes)
- **Subir archivos** (sin asociar a una tarea, usando el botón "Subir archivo")
- **Descargar archivos**
- **Eliminar archivos**
- **Previsualizar archivos** (imágenes, PDF, texto plano) directamente desde la web

### Acceso

- Desde el menú principal, selecciona la pestaña **Drive** o accede a `/drive`.

### Funcionalidades

- **Tabla de archivos:** Muestra nombre, extensión, fecha de subida y acciones.
- **Subida rápida:** Permite subir archivos sueltos (no ligados a una tarea) desde la propia vista.
- **Previsualización:** Haz clic en "👁 Previsualizar" para abrir una modal con el archivo (soporta imágenes, PDF y texto plano).
- **Descarga:** Descarga directa con el botón "⬇ Descargar".
- **Eliminación:** Elimina archivos con confirmación.

### Endpoints relacionados

- `GET /api/attachments` — Lista todos los archivos del usuario
- `POST /api/tasks/null/attachments` — Sube archivo sin tarea asociada
- `GET /api/tasks/:task_id/attachments/:attachment_id` — Descarga o previsualiza archivo
- `DELETE /api/tasks/:task_id/attachments/:attachment_id` — Elimina archivo

> **Nota:** También existe una vista para gestionar archivos por tarea específica (pestaña "Archivos por tarea"), con funciones similares pero agrupadas por tarea.

## Puesta En Marcha

### Inicio Rapido (1 comando)

Desde la raiz del proyecto:

```powershell
pwsh -File .\dev-up.ps1
```

Esto levanta contenedores, valida/crea la DB `v_nych`, reinicia backend y arranca el frontend en modo desarrollo.

### Apagar Servicios

```powershell
pwsh -File .\dev-down.ps1
```

Si tambien quieres borrar los datos locales de Docker (volumenes):

```powershell
pwsh -File .\dev-down.ps1 -PruneData
```

### 1. Levantar infraestructura

Desde la raiz del proyecto:

```bash
docker-compose up -d
```

### 2. Ejecutar backend

```bash
cd backend
cargo run
```

Backend disponible en `http://localhost:3000`.

### 3. Ejecutar frontend

```bash
cd web
npm install
npm run dev
```

Frontend disponible en `http://localhost:5173`.

## Estructura Del Repositorio

- `backend/`: API en Rust (modulos de usuarios, notas, calendario y tareas).
- `backend/migrations/`: migraciones SQL de la base de datos.
- `web/`: aplicacion web en React + TypeScript.
- `docker-compose.yml`: servicios locales (PostgreSQL, Redis, backend).

---

# Documentación actual

## Resumen

- Backend REST en Rust con Axum, Tokio y SQLx.
- Frontend web en React 19 + Vite + TypeScript.
- Persistencia en PostgreSQL.
- Redis para soporte de sesión/estado auxiliar.
- Migraciones SQL ejecutadas automáticamente al arrancar el backend.
- Arranque local con Docker Compose o con scripts `dev-up.ps1` y `dev-down.ps1`.

## Funcionalidades

### Autenticación

- Registro de usuarios.
- Inicio de sesión con correo o nombre de usuario.
- Tokens JWT con expiración de 24 horas.
- Soporte de usuario administrador local para acceso al panel `/admin`.

### Notas

- CRUD de notas en `/api/notes`.
- Contenido en formato estructurado para bloques.
- Soporte de jerarquía mediante `parent_id`.
- Bloques de texto, encabezados, imágenes, enlaces a otras notas y listas con viñetas.

### Calendario

- CRUD de eventos en `/api/calendar/events`.
- Vista con modos día, semana y mes en el frontend.
- Eventos con color, estado, transparencia y visibilidad.
- Endpoint público para disponibilidad en `/api/public/calendar`.

### Tareas

- CRUD de tareas y listas.
- Estructura jerárquica de subtareas.
- Marcado de destacadas.
- Estados de tarea como `todo`, `done` y variantes equivalentes usadas por la UI.
- Adjuntos por tarea y adjuntos sueltos.

### Gestor de archivos

- Vista global de archivos subidos por el usuario.
- Vista de archivos agrupados por tarea.
- Subida, descarga y eliminación de archivos.
- Previsualización desde la interfaz web cuando el tipo de archivo lo permite.

### Administración

- Panel `/admin` con resumen general.
- Conteos globales de usuarios, notas, tareas, eventos y listas.
- Resumen de actividad reciente.

## Stack técnico

| Capa | Tecnología |
| --- | --- |
| Backend | Rust, Axum, Tokio, SQLx |
| Frontend | React 19, TypeScript, Vite |
| Base de datos | PostgreSQL |
| Cache / apoyo de sesión | Redis |
| Infra local | Docker Compose |

## Arquitectura

```text
Web (React + Vite)
        |
        v
API REST (Rust / Axum)
   |                |
   v                v
PostgreSQL        Redis
```

## Estructura del proyecto

- `backend/`: API en Rust.
- `backend/src/main.rs`: arranque del servidor, router y health/status.
- `backend/src/users.rs`: autenticación y claims JWT.
- `backend/src/notes.rs`: notas.
- `backend/src/calendar.rs`: eventos del calendario.
- `backend/src/tasks.rs`: tareas, listas y adjuntos.
- `backend/src/admin.rs`: panel administrativo.
- `backend/src/public_link.rs`: disponibilidad pública de calendario.
- `backend/migrations/`: migraciones SQL.
- `web/`: aplicación web.
- `web/src/pages/`: pantallas de la interfaz.
- `docker-compose.yml`: PostgreSQL, Redis y backend.
- `dev-up.ps1`: arranque local completo.
- `dev-down.ps1`: apagado local completo.

## Rutas de la web

- `/login`: inicio de sesión.
- `/register`: registro.
- `/`: dashboard principal.
- `/notes`: notas.
- `/calendar`: calendario.
- `/tasks`: tareas.
- `/drive/files`: gestor global de archivos.
- `/drive/tasks`: archivos agrupados por tarea.
- `/admin`: panel administrativo.

## API principal

### Salud y estado

- `GET /health`
- `GET /api/status`

### Autenticación

- `POST /api/auth/register`
- `POST /api/auth/login`

### Notas

- `GET /api/notes`
- `POST /api/notes`
- `GET /api/notes/:id`
- `PATCH /api/notes/:id`
- `DELETE /api/notes/:id`

### Calendario

- `GET /api/calendar/events`
- `POST /api/calendar/events`
- `GET /api/calendar/events/:id`
- `PATCH /api/calendar/events/:id`
- `DELETE /api/calendar/events/:id`
- `GET /api/public/calendar`

### Tareas y listas

- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `GET /api/lists`
- `POST /api/lists`
- `PATCH /api/lists/:id`
- `DELETE /api/lists/:id`

### Adjuntos

- `GET /api/tasks/:id/attachments`
- `POST /api/tasks/:id/attachments`
- `GET /api/tasks/:id/attachments/:attachment_id`
- `DELETE /api/tasks/:id/attachments/:attachment_id`
- `GET /api/attachments`
- `POST /api/attachments`

### Administración

- `GET /api/admin/overview`
- `GET /api/admin/user/:user_id`

## Requisitos

- Node.js 20 o superior.
- Rust toolchain estable.
- Docker y Docker Compose.
- PowerShell para usar los scripts `dev-up.ps1` y `dev-down.ps1`.

## Variables de entorno

### Backend

- `DATABASE_URL`: cadena de conexión a PostgreSQL.
- `REDIS_URL`: cadena de conexión a Redis.
- `RUST_LOG`: nivel de logging de Rust.

Si estas variables no se definen, el backend usa valores locales por defecto:

- `postgres://postgres:password@localhost:5432/v_nych`
- `redis://localhost:6379/`

### Frontend

- `VITE_API_URL`: URL del backend. Si no se define, el frontend usa `http://127.0.0.1:3000`.

## Puesta en marcha

### Opción recomendada: arranque completo

Desde la raíz del proyecto:

```powershell
pwsh -File .\dev-up.ps1
```

Este flujo levanta la infraestructura, prepara la base de datos y arranca el backend y el frontend en desarrollo.

### Apagar servicios

```powershell
pwsh -File .\dev-down.ps1
```

Si además quieres borrar los datos locales de Docker:

```powershell
pwsh -File .\dev-down.ps1 -PruneData
```

### Arranque manual

1. Levanta PostgreSQL, Redis y el backend con Docker Compose:

```bash
docker-compose up -d
```

2. Ejecuta el backend en local si no usas Docker para esa parte:

```bash
cd backend
cargo run
```

3. Ejecuta el frontend:

```bash
cd web
npm install
npm run dev
```

Backend: `http://localhost:3000`

Frontend: `http://localhost:5173`

## Comandos útiles

### Frontend

```bash
cd web
npm run build
npm run lint
```

### Backend

```bash
cd backend
cargo check
cargo run
```

## Notas de implementación

- El backend ejecuta las migraciones con `sqlx::migrate!` al iniciar.
- El estado de salud verifica PostgreSQL y Redis desde `/api/status`.
- La API usa CORS abierto en desarrollo.
- La autenticación se basa en el header `Authorization: Bearer <token>`.

## Sobre el nombre

V-NYCH está inspirado en el manuscrito de Voynich. El nombre apunta a la idea de conocimiento personal y datos organizados bajo control del usuario.
