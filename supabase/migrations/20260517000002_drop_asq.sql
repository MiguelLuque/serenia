-- supabase/migrations/20260517000002_drop_asq.sql
--
-- Plan 8 Fase 1 T1.7 — Borrar ASQ de BD. Sustituido por C-SSRS (T1.4).
-- ASQ ya no existe en código (lib/shared/questionnaires/{scoring,registry}.ts).
--
-- Pre-launch (Plan 8): no hay instancias activas de ASQ en BD (T0.1 wipe
-- limpió toda data de paciente). Se borran solo la definition + sus 5 items.
-- El CASCADE de la FK questionnaire_items.questionnaire_id se encarga de
-- limpiar items. Si por algún motivo quedaran questionnaire_instances
-- huérfanas, también caen en cascada.

delete from questionnaire_definitions where code = 'ASQ';
