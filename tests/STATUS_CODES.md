# HTTP Status Codes for V-Nych Backend

Based on backend analysis:
- **POST/PUT/PATCH**: Return 200 or 201 (backend varies)
- **GET**: Return 200
- **DELETE**: Return 204
- **404**: Resource not found
- **405**: Method not allowed (endpoint doesn't exist)

## Endpoints that don't exist:
- GET /api/lists/:id (use GET /api/lists instead)
- GET /api/tasks/:id (use GET /api/tasks instead)

## Issues found:
- Tasks filter by starred: backend may not support this properly
- is_starred field: may not be set correctly on create
