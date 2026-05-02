-- Plan 8 Bloque 2 Fix 3 — atomic close_session RPC.
--
-- Antes (lib/sessions/service.ts): el cierre de sesión hacía 2 UPDATEs
-- separados (clinical_sessions + conversations) sin transacción. Si el
-- segundo fallaba, la BD quedaba inconsistente: la sesión clínica
-- aparecía cerrada pero la conversación continuaba 'active', con
-- ended_at NULL. Cualquier flujo que mira `conversations.status` para
-- decidir si una sesión sigue viva veía un fantasma.
--
-- Esta función envuelve los 2 UPDATEs (más el lookup del owner) en una
-- transacción implícita de plpgsql, manteniendo además la verificación
-- de ownership server-side (RLS sigue protegiendo, pero la función es
-- security definer para consolidar el contrato y evitar que el cliente
-- pueda emitir UN update y NO el otro).
--
-- closure_reason es columna `text` (ver 20260419000003_conversation_tables.sql);
-- no hay enum dedicado, así que el parámetro entra como text directo.
-- Las llamadas conocidas pasan: 'user_request' | 'time_limit' |
-- 'crisis_detected' | 'inactivity'.

create or replace function close_session_atomic(
  p_session_id uuid,
  p_user_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
  v_now timestamptz := now();
begin
  -- Verifica ownership y obtiene conversation_id. Si no hay match el RAISE
  -- aborta la transacción y propaga el error al cliente, que es lo que
  -- queremos: closeSession actual también throw-ea cuando el SELECT inicial
  -- no encuentra la fila (ver fetchError).
  select conversation_id into v_conversation_id
  from clinical_sessions
  where id = p_session_id and user_id = p_user_id;

  if v_conversation_id is null then
    raise exception 'Session % not found for user %', p_session_id, p_user_id;
  end if;

  -- Update clinical_sessions
  update clinical_sessions
  set status = 'closed',
      closed_at = v_now,
      closure_reason = p_reason
  where id = p_session_id;

  -- Update conversations en la misma transacción. Si falla, el UPDATE de
  -- clinical_sessions también se revierte (atomicidad plpgsql).
  update conversations
  set status = 'closed', ended_at = v_now
  where id = v_conversation_id and user_id = p_user_id;
end;
$$;

grant execute on function close_session_atomic(uuid, uuid, text)
  to authenticated, service_role;
