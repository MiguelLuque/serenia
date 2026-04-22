-- supabase/migrations/20260423000001_rls_clinician_write.sql
--
-- Plan 5 T1: extend RLS so clinicians (is_clinician() = true) can read
-- patient-owned clinical data and write assessment-review rows.
--
-- These policies are ADDITIVE to the owner policies defined in
-- 20260419000008_rls_owner_only.sql. Postgres RLS is permissive by
-- default: if either the owner policy OR the clinician policy passes,
-- the row is visible/writable.
--
-- `questionnaire_definitions` and `questionnaire_items` are intentionally
-- skipped: 20260419000009_rls_public_and_restricted.sql already grants
-- SELECT to every authenticated user, so a clinician-specific policy
-- would be redundant.

-- -----------------------------------------------------------------------
-- SELECT policies for clinicians
-- -----------------------------------------------------------------------

create policy "clinical_sessions_select_clinician"
  on clinical_sessions for select
  using (is_clinician());

-- Clinicians see ALL messages in any conversation, including non
-- user-visible system/tool messages — they need the full transcript
-- for review.
create policy "messages_select_clinician"
  on messages for select
  using (is_clinician());

create policy "conversations_select_clinician"
  on conversations for select
  using (is_clinician());

create policy "questionnaire_instances_select_clinician"
  on questionnaire_instances for select
  using (is_clinician());

create policy "questionnaire_answers_select_clinician"
  on questionnaire_answers for select
  using (is_clinician());

create policy "questionnaire_results_select_clinician"
  on questionnaire_results for select
  using (is_clinician());

create policy "assessments_select_clinician"
  on assessments for select
  using (is_clinician());

create policy "risk_events_select_clinician"
  on risk_events for select
  using (is_clinician());

-- -----------------------------------------------------------------------
-- INSERT policy for assessments: clinicians insert new versions whose
-- user_id is the patient's (not auth.uid()). The existing
-- assessments_insert_own policy requires user_id = auth.uid(), so we
-- add a separate clinician policy with a looser check.
-- -----------------------------------------------------------------------

create policy "assessments_insert_clinician"
  on assessments for insert
  with check (is_clinician());

-- -----------------------------------------------------------------------
-- UPDATE policy for assessments: clinicians update status / mark rows
-- as superseded when producing a reviewed version.
-- -----------------------------------------------------------------------

create policy "assessments_update_clinician"
  on assessments for update
  using (is_clinician())
  with check (is_clinician());
