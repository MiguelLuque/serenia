-- Plan 8 T0.1 — Reparación post-wipe: recrear user_profiles para los UIDs
-- preservados (Miguel + Pablo).
--
-- Contexto: la migration 20260502000004 hizo TRUNCATE de tablas de
-- interacción. El cascade de TRUNCATE en Postgres también vacía las tablas
-- que tienen FK a las truncadas: `user_profiles` cascadeó por
-- `active_care_plan_id REFERENCES care_plans(id)` y por
-- `last_reviewed_assessment_id REFERENCES assessments(id)`. Resultado:
-- user_profiles quedó vacío y el UPDATE final de la 04 corrió sobre 0 rows.
--
-- Esta migration corrige el estado: recrea las 2 filas de user_profiles
-- con los roles correctos (Miguel patient, Pablo clinician) y
-- onboarding_status='pending' para forzar paso por el flow nuevo.
--
-- Idempotente vía `on conflict (user_id) do nothing`.

insert into user_profiles (user_id, role, onboarding_status, locale, timezone)
values
  ('999f99cb-a6e7-4755-9ffd-c259bbbf133f', 'patient',   'pending', 'es-ES', 'Europe/Madrid'),
  ('39ea68ed-f4c9-41c7-8654-556ab872c8ce', 'clinician', 'pending', 'es-ES', 'Europe/Madrid')
on conflict (user_id) do nothing;

-- Verificación.
do $$
declare
  miguel_role text;
  pablo_role  text;
  total       int;
begin
  select role into miguel_role from user_profiles where user_id = '999f99cb-a6e7-4755-9ffd-c259bbbf133f';
  select role into pablo_role  from user_profiles where user_id = '39ea68ed-f4c9-41c7-8654-556ab872c8ce';
  select count(*) into total from user_profiles;

  raise notice 'Profiles restaurados: Miguel=%, Pablo=%, total=%', miguel_role, pablo_role, total;

  if miguel_role is distinct from 'patient' then
    raise exception 'Esperaba Miguel role=patient, obtuve %', miguel_role;
  end if;
  if pablo_role is distinct from 'clinician' then
    raise exception 'Esperaba Pablo role=clinician, obtuve %', pablo_role;
  end if;
  if total != 2 then
    raise exception 'Esperaba 2 profiles, encontré %', total;
  end if;
end $$;
