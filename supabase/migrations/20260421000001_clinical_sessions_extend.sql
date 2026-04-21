-- supabase/migrations/20260421000001_clinical_sessions_extend.sql

alter table clinical_sessions
  add column last_activity_at timestamptz not null default now();

create index clinical_sessions_user_open_idx
  on clinical_sessions(user_id)
  where status = 'open';

create index clinical_sessions_last_activity_idx
  on clinical_sessions(last_activity_at)
  where status = 'open';

create policy "clinical_sessions_select_clinician"
  on clinical_sessions for select
  using (is_clinician());
