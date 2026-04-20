-- supabase/seed/asq.sql
-- ASQ: 4 yes/no items + 1 acuity question if any positive.
-- Based on NIMH ASQ structure (adapted for ES use).

insert into questionnaire_definitions
  (code, name, domain, version, language, scoring_strategy, source_reference, instructions_json)
values (
  'ASQ',
  'Cuestionario de Evaluación de la Conducta Suicida',
  'risk',
  '1.0',
  'es-ES',
  'conditional',
  'Horowitz LM et al. Ask Suicide-Screening Questions (ASQ). NIMH.',
  '{"preamble": "En las últimas semanas, ¿ha tenido alguno de los siguientes pensamientos?"}'
);

with def as (select id from questionnaire_definitions where code = 'ASQ')
insert into questionnaire_items
  (questionnaire_id, order_index, prompt, response_type, options_json, numeric_value_map_json, is_required, risk_flag_rule)
select
  def.id,
  item.order_index,
  item.prompt,
  item.response_type,
  item.options_json::jsonb,
  item.value_map::jsonb,
  true,
  item.risk_flag_rule::jsonb
from def, (values
  (1,
   '¿Ha deseado estar muerto/a o dormido/a y no volver a despertar?',
   'yes_no',
   '[{"label": "Sí", "value": "1"}, {"label": "No", "value": "0"}]',
   '{"1": 1, "0": 0}',
   '{"eq": 1}'),
  (2,
   '¿Ha tenido algún pensamiento de hacerse daño o quitarse la vida?',
   'yes_no',
   '[{"label": "Sí", "value": "1"}, {"label": "No", "value": "0"}]',
   '{"1": 1, "0": 0}',
   '{"eq": 1}'),
  (3,
   '¿Ha pensado en cómo podría hacerlo?',
   'yes_no',
   '[{"label": "Sí", "value": "1"}, {"label": "No", "value": "0"}]',
   '{"1": 1, "0": 0}',
   '{"eq": 1}'),
  (4,
   '¿Ha tenido alguna intención de actuar según esos pensamientos?',
   'yes_no',
   '[{"label": "Sí", "value": "1"}, {"label": "No", "value": "0"}]',
   '{"1": 1, "0": 0}',
   '{"eq": 1}'),
  (5,
   '¿Tiene pensado hacerse daño en el próximo mes? (Responda solo si ha respondido Sí a alguna pregunta anterior)',
   'yes_no',
   '[{"label": "Sí", "value": "1"}, {"label": "No", "value": "0"}]',
   '{"1": 1, "0": 0}',
   '{"eq": 1}')
) as item(order_index, prompt, response_type, options_json, value_map, risk_flag_rule);
