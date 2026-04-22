-- supabase/migrations/20260423000003_assessments_reviewed_by_auth_users.sql
--
-- Plan 5 hotfix: `assessments.reviewed_by` originally FK'd to the v1.5 stub
-- `clinicians` table, but the clinician panel is gated by
-- `user_profiles.role = 'clinician'` and the server actions pass
-- `auth.users.id` as the reviewer. Repoint the FK to `auth.users(id)` so the
-- inserts/updates from the review flow succeed.

alter table assessments
  drop constraint if exists fk_assessments_reviewed_by;

alter table assessments
  add constraint fk_assessments_reviewed_by
  foreign key (reviewed_by)
  references auth.users(id)
  on delete set null;
