-- supabase/migrations/20260423000002_assessments_rejection_reason.sql
--
-- Plan 5 T6: when a clinician rejects an AI-drafted assessment, we want
-- to capture *why*. Add a free-text `rejection_reason` column on
-- `assessments`. Nullable because it only applies to rows whose
-- `status = 'rejected'`; every other row leaves it NULL.

alter table assessments
  add column if not exists rejection_reason text;
