-- supabase/migrations/20260426000001_assessments_clinical_notes.sql
--
-- Plan 7 T-B — Notas del clínico durante revisión.
--
-- `clinical_notes` es un campo de texto libre que el clínico puede rellenar
-- al editar/revisar un informe. Es DISTINTO de `rejection_reason`:
--
--   * `rejection_reason` aplica solo cuando `status='rejected'` y captura
--     POR QUÉ se rechaza un draft. Persistido por `rejectAssessmentAction`.
--
--   * `clinical_notes` es independiente del rechazo — el clínico puede
--     añadir notas en cualquier informe (draft revisado, modificado o
--     rechazado) para enriquecer el contexto clínico.
--
-- Cuando el informe es de `status='rejected'` y el clínico pulsa
-- "Regenerar", T-B copia AMBOS campos al `rejectionContext` que recibe el
-- workflow `generateAssessmentWorkflow`, para que el LLM tenga toda la
-- guía clínica al producir el nuevo draft.
--
-- Decisión humana #14 (Plan 7): las `clinical_notes` son **visibles al
-- agente IA en sesiones futuras del paciente**, vía el bloque de contexto
-- Tier A inyectado al system prompt — implementación en Plan 7 T-1
-- (fuera de scope de T-B, que solo persiste el campo y lo expone al
-- editor/visor del clínico).

alter table assessments
  add column if not exists clinical_notes text;

comment on column assessments.clinical_notes is
  'Notas del clínico añadidas durante revisión/edición. Distintas del rejection_reason (que aplica solo a status=rejected). Visibles al agente IA en sesiones futuras del paciente vía contexto Tier A — ver Plan 7 T-1 + chat-flow.md.';
