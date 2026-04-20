-- supabase/migrations/20260419000010_gdpr_erase.sql
-- Service-role only. Cascades hard-delete for right-to-erasure.
-- auth.users delete cascades to all child tables via ON DELETE CASCADE.
-- We replace audit_log.actor_id with a tombstone for tamper-evidence.

create or replace function gdpr_erase_user(target_user_id uuid)
returns void
language plpgsql
security definer   -- runs as owner (service role), bypasses RLS
set search_path = public
as $$
declare
  tombstone_id uuid := '00000000-0000-0000-0000-000000000000';
begin
  -- Replace actor_id in audit_log to preserve tamper-evidence without PII
  update audit_log
    set actor_id = tombstone_id
    where actor_id = target_user_id;

  -- Hard-delete the auth user; all child tables cascade
  delete from auth.users where id = target_user_id;
end;
$$;

-- Only callable by service role (no grant to authenticated or anon)
revoke all on function gdpr_erase_user(uuid) from public, authenticated, anon;
