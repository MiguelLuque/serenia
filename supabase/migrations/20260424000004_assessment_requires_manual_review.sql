-- supabase/migrations/20260424000004_assessment_requires_manual_review.sql
--
-- Plan 7 T6 — Robust async assessment generation via Vercel Workflow DevKit.
--
-- When `generateAssessmentWorkflow` exhausts its retries (LLM down,
-- structured-output schema reject, gateway 5xx), the catch branch persists
-- a row with this new status. The clinician inbox surfaces these rows so
-- the failure is visible and the clinician can trigger a manual regenerate
-- (T-B). Without this enum value the failure path silently dropped the row
-- and the session never reached the inbox.

alter type assessment_status add value if not exists 'requires_manual_review';
