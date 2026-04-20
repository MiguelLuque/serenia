-- supabase/seed/phq9.sql

insert into questionnaire_definitions
  (code, name, domain, version, language, scoring_strategy, source_reference, instructions_json)
values (
  'PHQ9',
  'Cuestionario de Salud del Paciente-9',
  'depression',
  '1.0',
  'es-ES',
  'sum',
  'Kroenke K, Spitzer RL, Williams JB. The PHQ-9: validity of a brief depression severity measure.',
  '{"preamble": "Durante las últimas 2 semanas, ¿con qué frecuencia le han molestado los siguientes problemas?"}'
);

-- PHQ-9 options are identical for items 1-9
-- severity: 0-4 minimal, 5-9 mild, 10-14 moderate, 15-19 moderately severe, 20-27 severe

with def as (select id from questionnaire_definitions where code = 'PHQ9')
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
  item.risk_flag_rule
from def, (values
  (1, 'Poco interés o placer en hacer las cosas', null::jsonb),
  (2, 'Sentirse desanimado/a, deprimido/a, o sin esperanza', null),
  (3, 'Con problemas para dormir o para mantenerse dormido/a, o durmiendo demasiado', null),
  (4, 'Sintiéndose cansado/a o con poca energía', null),
  (5, 'Con poco apetito o comiendo en exceso', null),
  (6, 'Sintiéndose mal consigo mismo/a, o que es un fracaso, o que ha fallado a sí mismo/a o a su familia', null),
  (7, 'Con dificultad para concentrarse en cosas como leer el periódico o ver la televisión', null),
  (8, 'Moviéndose o hablando tan lento que otras personas lo han notado, o lo contrario: tan inquieto/a que se ha estado moviendo mucho más de lo normal', null),
  (9, 'Pensamientos de que estaría mejor muerto/a o de hacerse daño de alguna manera', '{"gte": 1}'::jsonb)
) as item(order_index, prompt, risk_flag_rule);
