-- Plan 8 T0.4 / ADR-018: cuestionarios clinician-rated (Hamilton).
--
-- Por defecto, el cuestionario lo rellena el paciente. Cuando
-- is_clinician_rated=true, lo administra el clínico desde el panel
-- y el paciente NO lo ve. La policy `questionnaire_answers_insert_clinician`
-- permite al clínico insertar respuestas aunque la
-- questionnaire_instances.user_id ≠ auth.uid(); la policy existente
-- `qa_insert_own` (autoinforme paciente-rated) sigue intacta.
--
-- HAM-D será el primer cuestionario clinician-rated en Plan 8 Fase 7;
-- por eso el default es false y todas las definitions ya seedeadas
-- (PHQ-9, GAD-7, ASQ) permanecen como paciente-rated.

alter table questionnaire_definitions
  add column if not exists is_clinician_rated boolean not null default false;

comment on column questionnaire_definitions.is_clinician_rated is
  'Si true, el cuestionario lo administra el clínico (no el paciente). HAM-D será el primer cuestionario de este tipo en Plan 8 Fase 7.';

-- Política para inserts hechos por clínicos sobre cuestionarios
-- clinician-rated. Complementaria — NO sustituye — a `qa_insert_own`.
-- La policy existente sigue cubriendo el caso paciente-rated
-- (instance.user_id = auth.uid()).
create policy questionnaire_answers_insert_clinician
  on questionnaire_answers
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from questionnaire_instances qi
      join questionnaire_definitions qd on qd.id = qi.questionnaire_id
      where qi.id = questionnaire_answers.instance_id
        and qd.is_clinician_rated = true
        and is_clinician()
    )
  );
