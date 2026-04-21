-- supabase/migrations/20260421000004_clinical_sessions_single_open.sql
--
-- Enforce single active session per user at the database level.
-- Complements the check in startSessionAction by making concurrent
-- duplicate-create attempts fail with a unique-constraint error.

drop index if exists clinical_sessions_user_open_idx;

create unique index clinical_sessions_user_open_idx
  on clinical_sessions(user_id)
  where status = 'open';
