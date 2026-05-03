-- supabase/migrations/20260503000001_seed_bdi2.sql
--
-- Plan 8 Fase 1 T1.1 — Seed BDI-II (Inventario de Depresión de Beck-II) en es-ES.
-- Versión cuadernillo facilitada por @psicologo el 2026-05-02 (PDF en
-- handoff fuera del repo). Detalle clínico y copy en
-- docs/agents/questionnaires/bdi2.md.
--
-- Bandas firmadas por Pablo el 2026-05-03 (sin desviación del plan):
--   0-13 mín / 14-19 leve / 20-28 moderado / 29-63 severo.
--
-- Items 16 (sueño) y 18 (apetito) tienen 7 opciones (0, 1a, 1b, 2a, 2b, 3a, 3b)
-- con `value` numérico colapsado (1a y 1b = 1, etc.) para que el scorer reciba
-- siempre un entero 0-3.
--
-- Item 9 (pensamientos suicidas) tiene risk_flag_rule {gte:1}, igual que PHQ-9
-- item 9. Cualquier valor ≥1 dispara flag `suicidality`.
--
-- Nota de licensing (ADR-024 punto 13): BDI-II es instrumento comercial con
-- copyright de Pearson. La licencia digital se gestionará con Pearson antes
-- del lanzamiento real con usuarios externos. Pre-launch operamos bajo el
-- cuadernillo facilitado por el clínico responsable que supervisa el caso.

with bdi as (
  insert into questionnaire_definitions (
    code, name, domain, version, language, scoring_strategy, source_reference, instructions_json
  ) values (
    'BDI2',
    'BDI-II — Inventario de Depresión de Beck-II',
    'depression',
    '1.0',
    'es-ES',
    'sum',
    'Beck AT, Steer RA, Brown GK (1996). BDI-II. Cuadernillo es-ES facilitado por @psicologo 2026-05-02.',
    jsonb_build_object(
      'header', 'Por favor, lee con atención cada uno de los 21 grupos. Elige el enunciado que mejor describa cómo te has sentido las últimas 2 semanas, incluyendo hoy. Si varios enunciados de un mismo grupo te parecen igualmente apropiados, marca el más alto.',
      'lookback_days', 14,
      'score_range', jsonb_build_array(0, 63),
      'bands', jsonb_build_object(
        'minimal', jsonb_build_array(0, 13),
        'mild', jsonb_build_array(14, 19),
        'moderate', jsonb_build_array(20, 28),
        'severe', jsonb_build_array(29, 63)
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
  bdi.id, i.order_index, i.prompt, 'single_choice',
  i.options_json, '{}'::jsonb, i.risk_flag_rule
from bdi, (values
  (1, 'Tristeza',
    '[
      {"value":0,"label":"No me siento triste."},
      {"value":1,"label":"Me siento triste gran parte del tiempo."},
      {"value":2,"label":"Me siento triste todo el tiempo."},
      {"value":3,"label":"Me siento tan triste o soy tan infeliz que no puedo soportarlo."}
    ]'::jsonb,
    null::jsonb),
  (2, 'Pesimismo',
    '[
      {"value":0,"label":"No estoy desalentado respecto de mi futuro."},
      {"value":1,"label":"Me siento más desalentado respecto de mi futuro que lo que solía estarlo."},
      {"value":2,"label":"No espero que las cosas funcionen para mí."},
      {"value":3,"label":"Siento que no hay esperanza para mi futuro y que sólo puede empeorar."}
    ]'::jsonb,
    null),
  (3, 'Fracaso',
    '[
      {"value":0,"label":"No me siento como un fracasado."},
      {"value":1,"label":"He fracasado más de lo que hubiera debido."},
      {"value":2,"label":"Cuando miro hacia atrás, veo muchos fracasos."},
      {"value":3,"label":"Siento que como persona soy un fracaso total."}
    ]'::jsonb,
    null),
  (4, 'Pérdida de placer',
    '[
      {"value":0,"label":"Obtengo tanto placer como siempre por las cosas de las que disfruto."},
      {"value":1,"label":"No disfruto tanto de las cosas como solía hacerlo."},
      {"value":2,"label":"Obtengo muy poco placer de las cosas que solía disfrutar."},
      {"value":3,"label":"No puedo obtener ningún placer de las cosas de las que solía disfrutar."}
    ]'::jsonb,
    null),
  (5, 'Sentimientos de culpa',
    '[
      {"value":0,"label":"No me siento particularmente culpable."},
      {"value":1,"label":"Me siento culpable respecto de varias cosas que he hecho o que debería haber hecho."},
      {"value":2,"label":"Me siento bastante culpable la mayor parte del tiempo."},
      {"value":3,"label":"Me siento culpable todo el tiempo."}
    ]'::jsonb,
    null),
  (6, 'Sentimientos de castigo',
    '[
      {"value":0,"label":"No siento que esté siendo castigado."},
      {"value":1,"label":"Siento que tal vez pueda ser castigado."},
      {"value":2,"label":"Espero ser castigado."},
      {"value":3,"label":"Siento que estoy siendo castigado."}
    ]'::jsonb,
    null),
  (7, 'Disconformidad con uno mismo',
    '[
      {"value":0,"label":"Siento acerca de mí lo mismo que siempre."},
      {"value":1,"label":"He perdido la confianza en mí mismo."},
      {"value":2,"label":"Estoy decepcionado conmigo mismo."},
      {"value":3,"label":"No me gusto a mí mismo."}
    ]'::jsonb,
    null),
  (8, 'Autocrítica',
    '[
      {"value":0,"label":"No me critico ni me culpo más de lo habitual."},
      {"value":1,"label":"Estoy más crítico conmigo mismo de lo que solía estarlo."},
      {"value":2,"label":"Me critico a mí mismo por todos mis errores."},
      {"value":3,"label":"Me culpo a mí mismo por todo lo malo que sucede."}
    ]'::jsonb,
    null),
  (9, 'Pensamientos o deseos suicidas',
    '[
      {"value":0,"label":"No tengo ningún pensamiento de matarme."},
      {"value":1,"label":"He tenido pensamientos de matarme, pero no lo haría."},
      {"value":2,"label":"Querría matarme."},
      {"value":3,"label":"Me mataría si tuviera la oportunidad de hacerlo."}
    ]'::jsonb,
    '{"gte":1,"reason":"suicidality"}'::jsonb),
  (10, 'Llanto',
    '[
      {"value":0,"label":"No lloro más de lo que solía hacerlo."},
      {"value":1,"label":"Lloro más de lo que solía hacerlo."},
      {"value":2,"label":"Lloro por cualquier pequeñez."},
      {"value":3,"label":"Siento ganas de llorar pero no puedo."}
    ]'::jsonb,
    null),
  (11, 'Agitación',
    '[
      {"value":0,"label":"No estoy más inquieto o tenso que lo habitual."},
      {"value":1,"label":"Me siento más inquieto o tenso que lo habitual."},
      {"value":2,"label":"Estoy tan inquieto o agitado que me es difícil quedarme quieto."},
      {"value":3,"label":"Estoy tan inquieto o agitado que tengo que estar siempre en movimiento o haciendo algo."}
    ]'::jsonb,
    null),
  (12, 'Pérdida de interés',
    '[
      {"value":0,"label":"No he perdido el interés en otras actividades o personas."},
      {"value":1,"label":"Estoy menos interesado que antes en otras personas o cosas."},
      {"value":2,"label":"He perdido casi todo el interés en otras personas o cosas."},
      {"value":3,"label":"Me es difícil interesarme por algo."}
    ]'::jsonb,
    null),
  (13, 'Indecisión',
    '[
      {"value":0,"label":"Tomo mis propias decisiones tan bien como siempre."},
      {"value":1,"label":"Me resulta más difícil que de costumbre tomar decisiones."},
      {"value":2,"label":"Encuentro mucha más dificultad que antes para tomar decisiones."},
      {"value":3,"label":"Tengo problemas para tomar cualquier decisión."}
    ]'::jsonb,
    null),
  (14, 'Desvalorización',
    '[
      {"value":0,"label":"No siento que yo no sea valioso."},
      {"value":1,"label":"No me considero a mí mismo tan valioso y útil como solía considerarme."},
      {"value":2,"label":"Me siento menos valioso cuando me comparo con otros."},
      {"value":3,"label":"Siento que no valgo nada."}
    ]'::jsonb,
    null),
  (15, 'Pérdida de energía',
    '[
      {"value":0,"label":"Tengo tanta energía como siempre."},
      {"value":1,"label":"Tengo menos energía que la que solía tener."},
      {"value":2,"label":"No tengo suficiente energía para hacer demasiado."},
      {"value":3,"label":"No tengo energía suficiente para hacer nada."}
    ]'::jsonb,
    null),
  (16, 'Cambios en los hábitos de sueño',
    '[
      {"value":0,"label":"No he experimentado ningún cambio en mis hábitos de sueño."},
      {"value":1,"label":"Duermo un poco más que lo habitual."},
      {"value":1,"label":"Duermo un poco menos que lo habitual."},
      {"value":2,"label":"Duermo mucho más que lo habitual."},
      {"value":2,"label":"Duermo mucho menos que lo habitual."},
      {"value":3,"label":"Duermo la mayor parte del día."},
      {"value":3,"label":"Me despierto 1-2 horas más temprano y no puedo volver a dormirme."}
    ]'::jsonb,
    null),
  (17, 'Irritabilidad',
    '[
      {"value":0,"label":"No estoy tan irritable que lo habitual."},
      {"value":1,"label":"Estoy más irritable que lo habitual."},
      {"value":2,"label":"Estoy mucho más irritable que lo habitual."},
      {"value":3,"label":"Estoy irritable todo el tiempo."}
    ]'::jsonb,
    null),
  (18, 'Cambios en el apetito',
    '[
      {"value":0,"label":"No he experimentado ningún cambio en mi apetito."},
      {"value":1,"label":"Mi apetito es un poco menor que lo habitual."},
      {"value":1,"label":"Mi apetito es un poco mayor que lo habitual."},
      {"value":2,"label":"Mi apetito es mucho menor que antes."},
      {"value":2,"label":"Mi apetito es mucho mayor que lo habitual."},
      {"value":3,"label":"No tengo apetito en absoluto."},
      {"value":3,"label":"Quiero comer todo el día."}
    ]'::jsonb,
    null),
  (19, 'Dificultad de concentración',
    '[
      {"value":0,"label":"Puedo concentrarme tan bien como siempre."},
      {"value":1,"label":"No puedo concentrarme tan bien como habitualmente."},
      {"value":2,"label":"Me es difícil mantener la mente en algo por mucho tiempo."},
      {"value":3,"label":"Encuentro que no puedo concentrarme en nada."}
    ]'::jsonb,
    null),
  (20, 'Cansancio o fatiga',
    '[
      {"value":0,"label":"No estoy más cansado o fatigado que lo habitual."},
      {"value":1,"label":"Me fatigo o me canso más fácilmente que lo habitual."},
      {"value":2,"label":"Estoy demasiado fatigado o cansado para hacer muchas de las cosas que solía hacer."},
      {"value":3,"label":"Estoy demasiado fatigado o cansado para hacer la mayoría de las cosas que solía hacer."}
    ]'::jsonb,
    null),
  (21, 'Pérdida de interés en el sexo',
    '[
      {"value":0,"label":"No he notado ningún cambio reciente en mi interés por el sexo."},
      {"value":1,"label":"Estoy menos interesado en el sexo de lo que solía estarlo."},
      {"value":2,"label":"Estoy mucho menos interesado en el sexo."},
      {"value":3,"label":"He perdido completamente el interés en el sexo."}
    ]'::jsonb,
    null)
) as i(order_index, prompt, options_json, risk_flag_rule);
