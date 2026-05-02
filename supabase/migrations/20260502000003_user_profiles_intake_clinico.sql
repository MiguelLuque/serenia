-- Plan 8 Fase 3 (T3.1) / ADR-020: intake clínico mínimo para sesión 1.
--
-- El onboarding antiguo pedía 11 campos. Plan 8 lo reduce a los 4
-- imprescindibles para que la asistente psicológica TCC/ACT supervisada
-- (ADR-020) pueda dirigirse correctamente al paciente y entender el
-- motivo de consulta desde la sesión 1:
--
--   1. informal_name        — nombre por el que el paciente quiere ser
--                              llamado en la conversación. Independiente
--                              de display_name (que mantiene su semántica
--                              histórica como nombre completo del
--                              paciente y se sigue usando en vistas
--                              clínicas).
--   2. pronouns             — pronombres identitarios. Separados de
--                              `sex` (biológico) para evitar el bug de
--                              asumir género femenino y respetar la
--                              identidad declarada (bug 3 del backlog).
--
-- Las 7 columnas legacy (sex, country, city, employment,
-- relationship_status, living_with, prior_therapy, current_medication)
-- se mantienen nullable; Plan 9 (Patient Profile completo) las reusará.
-- Esta migration NO las toca.
--
-- Idempotente.

alter table user_profiles
  add column if not exists informal_name text not null default '';

alter table user_profiles
  add column if not exists pronouns text;

-- CHECK constraint en columna separada para poder añadirlo idempotentemente
-- (DO bloque evita error si ya existe).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_pronouns_check'
  ) then
    alter table user_profiles
      add constraint user_profiles_pronouns_check
      check (pronouns is null or pronouns in ('el', 'ella', 'elle', 'prefer_not_say'));
  end if;
end$$;

comment on column user_profiles.informal_name is
  'Plan 8 / ADR-020: nombre por el que el paciente quiere ser llamado en la conversación. Distinto de display_name (nombre completo). Lo usa la asistente TCC/ACT desde la sesión 1.';

comment on column user_profiles.pronouns is
  'Plan 8 / ADR-020: pronombres identitarios declarados por el paciente (el/ella/elle/prefer_not_say). Separados de sex (biológico) para evitar asunciones de género en el prompt clínico.';
