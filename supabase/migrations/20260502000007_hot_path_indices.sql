-- Plan 8 Bloque 4 — índices Postgres para hot paths detectados en auditoría.
--
-- Pre-launch sin tráfico real: las consultas no se notan lentas, pero estos
-- índices cubren patrones de acceso que escalan mal en cuanto haya datos.
-- `if not exists` para idempotencia.

-- 1) messages(conversation_id, role, created_at)
--
-- Patrón: `app/api/chat/route.ts` cuenta mensajes assistant por sesión
-- desde el último scored_at de un cuestionario. Hoy existen
-- `idx_messages_conversation_id` y `idx_messages_created_at` separados;
-- Postgres puede combinarlos vía bitmap-and pero es subóptimo cuando se
-- añade un filtro `role = 'assistant'`. El compuesto cubre la consulta
-- en una sola scan.
create index if not exists idx_messages_conversation_role_created
  on messages(conversation_id, role, created_at);

-- 2) questionnaire_instances(session_id, status, created_at)
--
-- Patrón: `lib/questionnaires/service.ts:getActiveInstanceForSession` filtra
-- por `session_id = X and status in ('proposed','in_progress','scored')`
-- ordenado por `created_at desc`. Hoy solo hay índice por `user_id` y por
-- `questionnaire_id` — la query hace seq-scan filtrado por session_id.
create index if not exists idx_instances_session_status_created
  on questionnaire_instances(session_id, status, created_at desc);

comment on index idx_messages_conversation_role_created is
  'Plan 8 Bloque 4: hot path del chat route (cuenta mensajes assistant por conversación desde scored_at).';

comment on index idx_instances_session_status_created is
  'Plan 8 Bloque 4: hot path getActiveInstanceForSession + buildQuestionnaireResultNotice.';
