-- supabase/seed/gad7.sql

insert into questionnaire_definitions
  (code, name, domain, version, language, scoring_strategy, source_reference, instructions_json)
values (
  'GAD7',
  'Trastorno de Ansiedad Generalizada-7',
  'anxiety',
  '1.0',
  'es-ES',
  'sum',
  'Spitzer RL, Kroenke K, Williams JB, Löwe B. A brief measure for assessing generalized anxiety disorder.',
  '{"preamble": "Durante las últimas 2 semanas, ¿con qué frecuencia le han molestado los siguientes problemas?"}'
);

-- GAD-7 severity: 0-4 minimal, 5-9 mild, 10-14 moderate, 15-21 severe

with def as (select id from questionnaire_definitions where code = 'GAD7')
insert into questionnaire_items
  (questionnaire_id, order_index, prompt, response_type, options_json, numeric_value_map_json, is_required, risk_flag_rule)
select
  def.id,
  item.order_index,
  item.prompt,
  'single_choice',
  '[
    {"label": "Ningún día", "value": "0"},
    {"label": "Varios días", "value": "1"},
    {"label": "Más de la mitad de los días", "value": "2"},
    {"label": "Casi todos los días", "value": "3"}
  ]'::jsonb,
  '{"0": 0, "1": 1, "2": 2, "3": 3}'::jsonb,
  true,
  null
from def, (values
  (1, 'Sentirse nervioso/a, ansioso/a o muy alterado/a'),
  (2, 'No poder dejar de preocuparse o no poder controlar la preocupación'),
  (3, 'Preocuparse demasiado por distintas cosas'),
  (4, 'Dificultad para relajarse'),
  (5, 'Estar tan intranquilo/a que es difícil quedarse quieto/a'),
  (6, 'Molestarse o ponerse irritable con facilidad'),
  (7, 'Sentir miedo, como si fuera a pasar algo terrible')
) as item(order_index, prompt);
