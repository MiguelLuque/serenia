-- Plan 8 T0.1 — Wipe de datos legacy de pre-lanzamiento.
--
-- Pre-lanzamiento (memory: serenia_prelaunch_env): la BD contiene únicamente
-- datos de pruebas internas de Plan 7. Plan 8 reescribe el modelo terapéutico
-- (TCC/ACT, 8 fases, C-SSRS sustituye ASQ, evaluación tier-2). Los datos de
-- interacción legacy son incompatibles con el nuevo flujo y los conservamos
-- carecería de valor clínico.
--
-- Se preservan:
--   * Las cuentas auth.users de Miguel y Pablo (acceso a la app sin re-signup).
--   * Sus filas de user_profiles, salvo los campos clínicos que se resetean
--     para forzar paso por el onboarding nuevo (Plan 8 Fase 3).
--   * El rol (`clinician`/`patient`) de cada uno.
--   * Las definiciones de cuestionarios (questionnaire_definitions / items),
--     que son seed.
--
-- Se borran (TRUNCATE … CASCADE):
--   * Todos los datos de sesión: clinical_sessions, conversations, messages,
--     session_summaries, patient_context_injections, assessments,
--     clinician_reviews, risk_events, patient_tasks.
--   * Todos los datos de cuestionarios: questionnaire_instances,
--     questionnaire_answers, questionnaire_results.
--   * audit_log, consents, care_plans, user_clinician_assignments.
--
-- Resto de auth.users + user_profiles: DELETE WHERE id NOT IN (preservados).
-- El cascade desde auth.users.delete limpia clinicians y FKs derivadas.
--
-- ADR-013 / ADR-021 vinculados.

-- UIDs preservados (Miguel + Pablo).
do $$
declare
  preserved_user_ids uuid[] := array[
    '999f99cb-a6e7-4755-9ffd-c259bbbf133f'::uuid, -- Miguel (dev/owner)
    '39ea68ed-f4c9-41c7-8654-556ab872c8ce'::uuid  -- Pablo (clinician)
  ];
begin
  -- Sanity-check: ambos UIDs deben existir en auth.users antes de proceder.
  if not exists (
    select 1 from auth.users where id = preserved_user_ids[1]
  ) then
    raise exception 'UID Miguel (%) no encontrado en auth.users — abortar wipe', preserved_user_ids[1];
  end if;

  if not exists (
    select 1 from auth.users where id = preserved_user_ids[2]
  ) then
    raise exception 'UID Pablo (%) no encontrado en auth.users — abortar wipe', preserved_user_ids[2];
  end if;
end $$;

-- 1) TRUNCATE datos de interacción (CASCADE limpia FKs derivadas).
--    `restart identity` no aplica aquí (todas las PK son uuid), pero lo dejamos
--    explícito para futuras tablas con secuencias.
truncate table
  messages,
  session_summaries,
  patient_context_injections,
  clinical_sessions,
  conversations,
  questionnaire_answers,
  questionnaire_results,
  questionnaire_instances,
  assessments,
  clinician_reviews,
  risk_events,
  patient_tasks,
  consents,
  care_plans,
  user_clinician_assignments,
  audit_log
restart identity cascade;

-- 2) DELETE auth.users no preservados.
--    El on-delete-cascade de las FKs en user_profiles, clinicians, etc.
--    limpia automáticamente los rows asociados.
delete from auth.users
where id not in (
  '999f99cb-a6e7-4755-9ffd-c259bbbf133f',
  '39ea68ed-f4c9-41c7-8654-556ab872c8ce'
);

-- 3) Reset clínico de los preservados.
--    Mantiene id, user_id, role, locale, timezone, created_at.
--    Resetea: campos clínicos legacy + intake (informal_name/pronouns/birth_date/
--    reason_for_consulting están vacíos pero las columnas existen tras Fase 3),
--    estado de onboarding (forzar a 'pending' para que pasen por el nuevo flow),
--    riesgo y baseline.
update user_profiles
set
  informal_name           = '',
  pronouns                = null,
  birth_date              = null,
  reason_for_consulting   = null,
  display_name            = null,
  sex                     = null,
  country                 = null,
  city                    = null,
  employment              = null,
  relationship_status     = null,
  living_with             = null,
  prior_therapy           = null,
  current_medication      = null,
  consent_version         = null,
  consent_given_at        = null,
  onboarding_status       = 'pending',
  baseline_summary        = null,
  active_care_plan_id     = null,
  last_reviewed_assessment_id = null,
  last_known_risk_level   = 'unknown',
  risk_profile_status     = 'unknown',
  current_focus           = null,
  updated_at              = now()
where user_id in (
  '999f99cb-a6e7-4755-9ffd-c259bbbf133f',
  '39ea68ed-f4c9-41c7-8654-556ab872c8ce'
);

-- 4) Verificación post-wipe.
do $$
declare
  remaining_users        int;
  remaining_sessions     int;
  remaining_messages     int;
  remaining_assessments  int;
  remaining_qi           int;
begin
  select count(*) into remaining_users from auth.users;
  select count(*) into remaining_sessions from clinical_sessions;
  select count(*) into remaining_messages from messages;
  select count(*) into remaining_assessments from assessments;
  select count(*) into remaining_qi from questionnaire_instances;

  raise notice 'Wipe completado. auth.users=%, clinical_sessions=%, messages=%, assessments=%, questionnaire_instances=%',
    remaining_users, remaining_sessions, remaining_messages, remaining_assessments, remaining_qi;

  if remaining_users != 2 then
    raise exception 'Esperaba 2 users preservados, encontré %', remaining_users;
  end if;

  if remaining_sessions != 0 or remaining_messages != 0 or remaining_assessments != 0 or remaining_qi != 0 then
    raise exception 'Wipe incompleto: alguna tabla de interacción quedó con datos';
  end if;
end $$;
