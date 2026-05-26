-- 0010_task_attachments_nullable.sql
-- Permitir archivos adjuntos sin tarea asociada

ALTER TABLE task_attachments
    ALTER COLUMN task_id DROP NOT NULL;