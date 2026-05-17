-- supabase/migrations/20260517000001_seed_cssrs.sql
--
-- Plan 8 Fase 1 T1.4 — Seed C-SSRS (Columbia Suicide Severity Rating Scale,
-- screener exploratorio) en es-ES. SUSTITUYE al ASQ que usábamos antes.
-- Copy literal facilitado por @psicologo el 2026-05-02 (PDF en handoff fuera
-- del repo). Detalle clínico, bandas y override en docs/agents/questionnaires/cssrs.md.
--
-- 7 ítems Sí/No (1, 2, 3, 4, 5, 6, 6b). Skip flow:
--   - Si ítem 2 = No → 3, 4, 5 no se preguntan (caller pasa 0).
--   - Si ítem 6 = No → 6b no se pregunta (caller pasa 0).
--
-- Bandas firmadas por Pablo el 2026-05-03 — 5 bandas para que la app reaccione
-- distinto en cada caso (el screener oficial solo distingue any-yes vs no):
--   negative      — todos = No.
--   low_risk      — items 1 o 2 = Sí (deseo de morir / pensamiento no específico).
--   moderate_risk — item 3 = Sí (pensamiento con método sin plan ni intención).
--   high_risk     — item 4 = Sí (intención sin plan).
--   acute_risk    — items 5 o 6 = Sí (intención clara o conducta lifetime).
--
-- Override `behavior_recent` (ítem 6b = Sí): fuerza acute_risk + corte
-- inmediato de sesión + notificación URGENTE al psicólogo referente.
--
-- ASQ sigue en BD por ahora (se borrará en T1.7 tras renombrar SafetyState
-- en Fase 2). Plan 8 pre-launch: no hay instancias activas de ASQ, así que
-- la coexistencia es solo a nivel de definitions.
--
-- Nota de licensing (ADR-024 punto 13): C-SSRS es marca registrada de The
-- Research Foundation for Mental Hygiene. Uso en producción requiere acuerdo
-- formal — gestionar antes del lanzamiento real.

with cssrs as (
  insert into questionnaire_definitions (
    code, name, domain, version, language, scoring_strategy, source_reference, instructions_json
  ) values (
    'CSSRS',
    'C-SSRS — Columbia Suicide Severity Rating Scale (screener)',
    'suicide_risk',
    '1.0',
    'es-ES',
    'cssrs_levels',
    'Posner K. et al. (2008). C-SSRS. Cuadernillo es-ES facilitado por @psicologo 2026-05-02.',
    jsonb_build_object(
      'header', 'Voy a hacerte 6 preguntas sobre pensamientos o intenciones que has podido tener. Responde sí o no a cada una.',
      'lookback', 'lifetime',
      'score_range', jsonb_build_array(0, 7),
      'bands', jsonb_build_object(
        'negative', 'todos los items = No',
        'low_risk', 'items 1 o 2 = Sí',
        'moderate_risk', 'item 3 = Sí',
        'high_risk', 'item 4 = Sí',
        'acute_risk', 'items 5 o 6 = Sí (override 6b si reciente)'
      ),
      'override_behavior_recent', 'item 6b = Sí ⇒ acute_risk + cierre inmediato + alerta urgente al psicólogo',
      'skip_rules', jsonb_build_object(
        'item_2_no', 'omitir items 3, 4, 5',
        'item_6_no', 'omitir item 6b'
      )
    )
  )
  returning id
)
insert into questionnaire_items (
  questionnaire_id, order_index, prompt, response_type,
  options_json, numeric_value_map_json, risk_flag_rule
)
select
  cssrs.id, i.order_index, i.prompt, 'single_choice',
  '[{"value":1,"label":"Sí"},{"value":0,"label":"No"}]'::jsonb,
  '{}'::jsonb,
  i.risk_flag_rule::jsonb
from cssrs, (values
  (1,
    '¿Has deseado estar muerto/a o poder dormirte y no despertar?',
    null::text),
  (2,
    '¿Has tenido realmente la idea de suicidarte?',
    null),
  (3,
    '¿Has pensado en cómo llevarlo a cabo? (Por ejemplo: "He pensado en tomar una sobredosis pero nunca hice un plan concreto sobre cuándo, dónde o cómo, y nunca lo haría")',
    null),
  (4,
    '¿Has tenido estas ideas y en cierto grado la intención de llevarlas a cabo? (A diferencia de "tengo los pensamientos pero definitivamente no haré nada al respecto")',
    null),
  (5,
    '¿Has comenzado a elaborar o has elaborado los detalles sobre cómo suicidarte? ¿Tenías intención de llevar a cabo este plan?',
    '{"gte":1,"reason":"suicidality"}'),
  (6,
    '¿Alguna vez has hecho algo, has comenzado a hacer algo o te has preparado para hacer algo para terminar tu vida? (Por ejemplo: coleccionar pastillas, conseguir un arma, regalar cosas de valor, escribir un testamento o carta de suicidio, sostener un arma pero cambiar de opinión, subir al techo pero no saltar; o realmente haber tomado pastillas, haberse cortado, haber tratado de colgarse, etc.)',
    '{"gte":1,"reason":"suicidality"}'),
  (7,
    '¿Eso fue en los últimos 3 meses?',
    '{"gte":1,"reason":"acute_risk"}')
) as i(order_index, prompt, risk_flag_rule);
