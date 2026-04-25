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
--
-- IMPORTANT: this migration must remain isolated. `ALTER TYPE ... ADD VALUE`
-- in Postgres ≥12 runs inside the migration's BEGIN/COMMIT transaction, but
-- the new value is **not visible to other statements in the same
-- transaction**. Do NOT add `INSERT ... 'requires_manual_review'` here — it
-- would fail. New uses go in a follow-up migration.

alter type assessment_status add value if not exists 'requires_manual_review';

-- Idempotency contract for `generateAssessmentWorkflow` — three callers
-- (closeSession, getOrResolveActiveSession lazy-close, cron stale-sweep) can
-- enqueue the same workflow concurrently. The workflow's `assessmentExists`
-- step closes most races, but a partial unique index on `(session_id)` for
-- `assessment_type='closure'` is the BD-level guarantee. Both
-- `persistAssessmentStep` and `recordManualReviewStep` already trap 23505 as
-- a graceful "duplicate ignored". Without this index the trap never fires
-- and racey workflows would insert two rows.
--
-- Why partial:
--  * `assessment_type='follow_up'` (or others) can have multiple rows per
--    session by design — unique only applies to `closure`.
--  * `superseded` and `rejected` rows are intentionally history kept for
--    audit. The Plan 5 versioning flow creates a new row + marks the old as
--    `superseded` when the clinician edits a draft, so we must allow N
--    superseded rows per session. Same for clinician rejection (followed by
--    a regenerated draft via T-B).
--
-- The result: at most ONE "live" closure row per session at any time
-- (draft_ai | reviewed_confirmed | reviewed_modified | requires_manual_review
-- | pending_clinician_review).

create unique index if not exists assessments_session_closure_live_unique
  on assessments (session_id)
  where assessment_type = 'closure'
    and status not in ('superseded', 'rejected');
