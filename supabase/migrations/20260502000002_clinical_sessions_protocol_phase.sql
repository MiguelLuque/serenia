-- Plan 8 T5.1 / ADR-015: protocolo rígido y hardcoded de 8 sesiones.
--
-- protocol_phase se calcula en código al crear la sesión como
-- min(count(closed) + 1, 8). Tras la sesión 8, las fases siguientes
-- mantienen protocol_phase = 8 (mantenimiento).
--
-- Decisión: el cálculo vive en lib/sessions/service.ts (T5.2) en vez
-- de un trigger Postgres. Más legible y testeable. La columna queda
-- con default 1 como red de seguridad ante INSERT directos sin lógica.
--
-- La columna NUNCA se actualiza durante la sesión.

alter table clinical_sessions
  add column if not exists protocol_phase smallint not null default 1
  check (protocol_phase between 1 and 8);

comment on column clinical_sessions.protocol_phase is
  'Plan 8: 1-8. Calculada al abrir la sesión como min(count(closed)+1, 8). Tras la 8 se mantiene en 8 (mantenimiento). Nunca se actualiza durante la sesión.';
