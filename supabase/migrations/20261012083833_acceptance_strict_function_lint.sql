-- Preserve function contracts and grants; satisfy strict plpgsql_check warnings.
create or replace function gdpr_erase_user(target_user_id uuid)
returns void
language plpgsql
security definer   -- runs as owner (service role), bypasses RLS
set search_path = public
as $$
declare
  tombstone_id uuid := '00000000-0000-0000-0000-000000000000'::uuid;
begin
  -- Replace actor_id in audit_log to preserve tamper-evidence without PII
  update audit_log
    set actor_id = tombstone_id
    where actor_id = target_user_id;

  -- Hard-delete the auth user; all child tables cascade
  delete from auth.users where id = target_user_id;
end;
$$;


create or replace function close_chat_turn(p_session_id uuid,p_request_id text,p_token uuid,p_reason text)
returns boolean language plpgsql set search_path=public,pg_temp as $$
declare s clinical_sessions%rowtype; t chat_turns%rowtype;
begin
 select * into s from clinical_sessions where id=p_session_id for update;
 select * into t from chat_turns where session_id=s.id and request_id=p_request_id and token=p_token and status='generating' and lease_until>now() for update;
 if not found then raise exception 'Stale turn owner' using errcode='42501'; end if;
 if p_reason in ('user_request','time_limit') then
  perform 1 from session_close_proposals where session_id=s.id and request_id=t.previous_request_id and reason=p_reason;
  if not found or trim(t.text) !~* '^(s[ií](,?\s+(cerramos|quiero cerrar( la sesi[oó]n)?))?|de acuerdo|vale|acepto|cerramos|quiero cerrar( la sesi[oó]n)?)[.!\s]*$' then return false; end if;
 elsif p_reason='crisis_detected' then
  if not exists(select 1 from risk_events where session_id=s.id and ((payload_json->>'request_id'=t.request_id and payload_json->>'signal'='textual_crisis') or (source_type='questionnaire' and severity='critical'))) then return false; end if;
 else return false;
 end if;
 return true;
end $$;
