-- supabase/migrations/20260422000001_seed_questionnaires.sql
--
-- Seeds PHQ-9, GAD-7 and ASQ questionnaires in es-ES.
-- Source of truth (editable by clinician) lives in docs/agents/questionnaires/.
-- Keep in sync manually — the runtime reads DB, not markdown.

-- Common options for 0-3 frequency scales (PHQ-9, GAD-7)
-- [{"value":0,"label":"Ningún día"},{"value":1,"label":"Varios días"},{"value":2,"label":"Más de la mitad de los días"},{"value":3,"label":"Casi todos los días"}]
-- Common options for yes/no (ASQ)
-- [{"value":0,"label":"No"},{"value":1,"label":"Sí"}]

-- ======================================================================
-- PHQ-9
-- ======================================================================
with phq as (
  insert into questionnaire_definitions (code, name, domain, version, language, scoring_strategy, source_reference, instructions_json)
  values (
    'PHQ9',
    'PHQ-9 — Cribado de síntomas depresivos',
    'depression',
    '1.0',
    'es-ES',
    'sum',
    'Kroenke K, Spitzer RL, Williams JB. The PHQ-9. J Gen Intern Med. 2001',
    jsonb_build_object(
      'header', 'Durante las últimas 2 semanas, ¿con qué frecuencia te han molestado los siguientes problemas?',
      'score_range', jsonb_build_array(0, 27),
      'bands', jsonb_build_object(
        'minimal', jsonb_build_array(0, 4),
        'mild', jsonb_build_array(5, 9),
        'moderate', jsonb_build_array(10, 14),
        'moderately_severe', jsonb_build_array(15, 19),
        'severe', jsonb_build_array(20, 27)
      )
    )
  )
  returning id
)
insert into questionnaire_items (questionnaire_id, order_index, prompt, response_type, options_json, numeric_value_map_json, risk_flag_rule)
select
  phq.id, i.order_index, i.prompt, 'single_choice',
  '[{"value":0,"label":"Ningún día"},{"value":1,"label":"Varios días"},{"value":2,"label":"Más de la mitad de los días"},{"value":3,"label":"Casi todos los días"}]'::jsonb,
  '{}'::jsonb,
  i.risk_flag_rule
from phq, (values
  (1, 'Poco interés o placer en hacer cosas.', null::jsonb),
  (2, 'Te has sentido decaído/a, deprimido/a o sin esperanzas.', null),
  (3, 'Problemas para dormir o dormir demasiado.', null),
  (4, 'Te has sentido cansado/a o con poca energía.', null),
  (5, 'Poco apetito o has comido en exceso.', null),
  (6, 'Te has sentido mal contigo mismo/a — o que eres un fracaso o que has defraudado a tu familia.', null),
  (7, 'Dificultad para concentrarte en cosas como leer o ver la tele.', null),
  (8, 'Te has movido o hablado tan despacio que otras personas lo han notado — o al contrario, has estado tan inquieto/a que te movías más de lo habitual.', null),
  (9, 'Pensamientos de que estarías mejor muerto/a o de hacerte daño de alguna forma.', '{"gte":1,"reason":"suicidality"}'::jsonb)
) as i(order_index, prompt, risk_flag_rule);

-- ======================================================================
-- GAD-7
-- ======================================================================
with gad as (
  insert into questionnaire_definitions (code, name, domain, version, language, scoring_strategy, source_reference, instructions_json)
  values (
    'GAD7',
    'GAD-7 — Cribado de síntomas de ansiedad',
    'anxiety',
    '1.0',
    'es-ES',
    'sum',
    'Spitzer RL, Kroenke K, Williams JB, Löwe B. The GAD-7. Arch Intern Med. 2006',
    jsonb_build_object(
      'header', 'Durante las últimas 2 semanas, ¿con qué frecuencia te han molestado los siguientes problemas?',
      'score_range', jsonb_build_array(0, 21),
      'bands', jsonb_build_object(
        'minimal', jsonb_build_array(0, 4),
        'mild', jsonb_build_array(5, 9),
        'moderate', jsonb_build_array(10, 14),
        'severe', jsonb_build_array(15, 21)
      )
    )
  )
  returning id
)
insert into questionnaire_items (questionnaire_id, order_index, prompt, response_type, options_json, numeric_value_map_json, risk_flag_rule)
select
  gad.id, i.order_index, i.prompt, 'single_choice',
  '[{"value":0,"label":"Ningún día"},{"value":1,"label":"Varios días"},{"value":2,"label":"Más de la mitad de los días"},{"value":3,"label":"Casi todos los días"}]'::jsonb,
  '{}'::jsonb,
  null
from gad, (values
  (1, 'Sentirte nervioso/a, ansioso/a o con los nervios de punta.'),
  (2, 'No poder dejar de preocuparte o no poder controlar la preocupación.'),
  (3, 'Preocuparte demasiado por diferentes cosas.'),
  (4, 'Dificultad para relajarte.'),
  (5, 'Estar tan inquieto/a que te cuesta quedarte quieto/a.'),
  (6, 'Molestarte o irritarte fácilmente.'),
  (7, 'Sentir miedo como si algo terrible fuera a pasar.')
) as i(order_index, prompt);

-- ======================================================================
-- ASQ
-- ======================================================================
with asq as (
  insert into questionnaire_definitions (code, name, domain, version, language, scoring_strategy, source_reference, instructions_json)
  values (
    'ASQ',
    'ASQ — Cribado de riesgo suicida',
    'risk',
    '1.0',
    'es-ES',
    'conditional',
    'Horowitz LM et al. Ask Suicide-Screening Questions (ASQ). NIMH',
    jsonb_build_object(
      'header', 'Voy a hacerte unas preguntas cortas. Responde con sinceridad — tu psicólogo va a revisar esta conversación.',
      'acute_item_order', 5,
      'trigger_acute_if_any_positive', true
    )
  )
  returning id
)
insert into questionnaire_items (questionnaire_id, order_index, prompt, response_type, options_json, numeric_value_map_json, risk_flag_rule)
select
  asq.id, i.order_index, i.prompt, 'single_choice',
  '[{"value":0,"label":"No"},{"value":1,"label":"Sí"}]'::jsonb,
  '{}'::jsonb,
  i.risk_flag_rule
from asq, (values
  (1, 'En las últimas semanas, ¿has deseado estar muerto/a?', null::jsonb),
  (2, 'En las últimas semanas, ¿has sentido que tu familia o amigos/as estarían mejor si tú no estuvieras?', null),
  (3, 'En la última semana, ¿has pensado en suicidarte?', null),
  (4, '¿Alguna vez has intentado suicidarte?', null),
  (5, '¿Estás pensando en suicidarte ahora mismo?', '{"eq":1,"reason":"acute_risk"}'::jsonb)
) as i(order_index, prompt, risk_flag_rule);
