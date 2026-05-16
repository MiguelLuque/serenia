-- supabase/migrations/20260503000002_seed_bai.sql
--
-- Plan 8 Fase 1 T1.2 — Seed BAI (Inventario de Ansiedad de Beck) en es-ES.
-- Versión cuadernillo facilitada por @psicologo el 2026-05-02 (PDF en
-- handoff fuera del repo). Detalle clínico y copy en
-- docs/agents/questionnaires/bai.md.
--
-- Bandas firmadas por Pablo el 2026-05-03 — DESVIACIÓN DEL PLAN ORIGINAL:
-- el plan listaba 4 bandas (0-7 / 8-15 / 16-25 / 26-63), Pablo firmó 3:
--   0-21 mínimo / 22-35 moderado / 36-63 severo.
-- Documentado en ADR-024 punto 2.
--
-- 21 ítems con escala 0-3 (En absoluto / Levemente / Moderadamente /
-- Severamente). Sin flags de riesgo (no hay ítem suicidalidad).
--
-- Disparo: solo tras GAD-7 banda moderate o superior (score ≥10), y por
-- defecto antes que STAI.
--
-- Nota de licensing (ADR-024 punto 13): BAI es instrumento comercial con
-- copyright de Pearson. La licencia digital se gestionará con Pearson antes
-- del lanzamiento real. Pre-launch operamos bajo el cuadernillo facilitado
-- por el clínico responsable.

with bai as (
  insert into questionnaire_definitions (
    code, name, domain, version, language, scoring_strategy, source_reference, instructions_json
  ) values (
    'BAI',
    'BAI — Inventario de Ansiedad de Beck',
    'anxiety',
    '1.0',
    'es-ES',
    'sum',
    'Beck AT, Steer RA (1988). BAI. Cuadernillo es-ES facilitado por @psicologo 2026-05-02.',
    jsonb_build_object(
      'header', 'A continuación encontrarás una lista de síntomas comunes de la ansiedad. Lee cada uno de los ítems atentamente, e indica cuánto te ha afectado en la última semana incluyendo hoy.',
      'lookback_days', 7,
      'score_range', jsonb_build_array(0, 63),
      'bands', jsonb_build_object(
        'minimal', jsonb_build_array(0, 21),
        'moderate', jsonb_build_array(22, 35),
        'severe', jsonb_build_array(36, 63)
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
  bai.id, i.order_index, i.prompt, 'single_choice',
  '[{"value":0,"label":"En absoluto"},{"value":1,"label":"Levemente"},{"value":2,"label":"Moderadamente"},{"value":3,"label":"Severamente"}]'::jsonb,
  '{}'::jsonb,
  null
from bai, (values
  (1, 'Torpe o entumecido.'),
  (2, 'Acalorado.'),
  (3, 'Con temblor en las piernas.'),
  (4, 'Incapaz de relajarse.'),
  (5, 'Con temor a que ocurra lo peor.'),
  (6, 'Mareado, o que se le va la cabeza.'),
  (7, 'Con latidos del corazón fuertes y acelerados.'),
  (8, 'Inestable.'),
  (9, 'Atemorizado o asustado.'),
  (10, 'Nervioso.'),
  (11, 'Con sensación de bloqueo.'),
  (12, 'Con temblores en las manos.'),
  (13, 'Inquieto, inseguro.'),
  (14, 'Con miedo a perder el control.'),
  (15, 'Con sensación de ahogo.'),
  (16, 'Con temor a morir.'),
  (17, 'Con miedo.'),
  (18, 'Con problemas digestivos.'),
  (19, 'Con desvanecimientos.'),
  (20, 'Con rubor facial.'),
  (21, 'Con sudores, fríos o calientes.')
) as i(order_index, prompt);
