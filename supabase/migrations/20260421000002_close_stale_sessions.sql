-- supabase/migrations/20260421000002_close_stale_sessions.sql
--
-- Idempotent bulk cleanup for sessions abandoned by the user.
-- The app already closes stale sessions lazily via getOrResolveActiveSession().
-- This function exists so a future scheduled job (Supabase pg_cron or external
-- worker) can run it to keep the table tidy without depending on user traffic.

create or replace function close_stale_sessions(threshold_minutes integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update clinical_sessions
  set status = 'closed',
      closed_at = now(),
      closure_reason = 'inactivity'
  where status = 'open'
    and last_activity_at < now() - make_interval(mins => threshold_minutes);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function close_stale_sessions(integer) from public;
