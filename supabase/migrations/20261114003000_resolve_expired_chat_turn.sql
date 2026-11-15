-- Explicit resolution is a barrier against in-flight turn effects, not a
-- replacement for the non-blocking recovery read. Busy is indeterminate.
-- This catalogue check does not drain old in-flight transactions or exclude
-- concurrent DDL; hosted rollout must establish both conditions separately.
do $prerequisite$
declare expected record; routine record; routine_id oid;
begin
 for expected in select * from (values
   ('public.begin_chat_turn_after_onboarding(uuid,uuid,text,text,boolean,boolean)','8274fd5d25d0978815fa71a0f1620f55','b8a8cd379330a568c54c6b16ea694557',false),
   ('public.close_chat_turn(uuid,text,uuid,text)','c386d88a25ff96879b35bf5dcb0f0c18','b0976be5038678c3ded8e2c12f1b9805',true),
   ('public.create_questionnaire_atomic(uuid,uuid,uuid,text,text,text,uuid)','5f857b986077d321cbb86a10788a181b','9b0339b5a994c0a9a6317cfc79cf03fc',true),
   ('public.finish_chat_turn(uuid,text,uuid,jsonb,jsonb,text,text)','2214956164b484f8029eb58a158dc195','c962ac6c40083be389fbd667ac7c2e22',true)
 ) as fingerprints(signature, body_md5, definition_md5, service_grant)
 loop
  routine_id=to_regprocedure(expected.signature);
  select * into routine from pg_proc where oid=routine_id;
  if not found
   or (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname=routine.proname)<>1
   or pg_get_userbyid(routine.proowner)<>'postgres'
   or routine.proacl is distinct from
      (case when expected.service_grant then array['postgres=X/postgres','service_role=X/postgres']::aclitem[]
      else array['postgres=X/postgres']::aclitem[] end)
   or md5(routine.prosrc)<>expected.body_md5
   or md5(pg_get_functiondef(routine_id))<>expected.definition_md5 then
   raise exception 'Unexpected chat resolution prerequisite: %', expected.signature;
  end if;
 end loop;
end
$prerequisite$;

-- Only extend the reviewed recovery projection; reject drift rather than
-- overwriting a different installed definition or privilege contract.
do $recovery_baseline$
declare p pg_proc%rowtype; target oid:=to_regprocedure('public.get_chat_turn_recovery(uuid)');
begin
 select * into p from pg_proc where oid=target;
 if not found or (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='get_chat_turn_recovery')<>1
  or pg_get_userbyid(p.proowner)<>'postgres'
  or p.proacl is distinct from array['postgres=X/postgres','authenticated=X/postgres']::aclitem[]
  or p.prosecdef is distinct from true or p.provolatile<>'v'
  or p.prolang <> (select oid from pg_language where lanname='plpgsql')
  or p.prorettype <> 'jsonb'::regtype or p.proargnames is distinct from array['p_session_id']::text[]
  or p.pronargdefaults<>0 or p.proconfig is distinct from array['search_path=public, pg_temp']::text[]
  or md5(p.prosrc)<>'ea480a99bd82c66e4f7be9d5590c3652' then
   raise exception 'Unexpected chat recovery baseline';
 end if;
end
$recovery_baseline$;

create or replace function public.get_chat_turn_recovery(p_session_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t chat_turns%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from clinical_sessions where id=p_session_id and user_id=auth.uid()) then raise exception 'Owned session required' using errcode='42501'; end if;
 select * into t from chat_turns where session_id=p_session_id and user_id=auth.uid() and status in ('generating','failed') order by created_at desc limit 1;
 if not found then return null; end if;
 return jsonb_build_object('requestId',t.request_id,'userMessageId',t.user_message_id,'text',t.text,'status',t.status,'canRetry',t.attempts<3 and (t.status='failed' or t.lease_until<=now()),'leaseUntil',t.lease_until,'attempt',t.attempts);
end $$;

do $recovery_readback$
declare p pg_proc%rowtype; target oid:=to_regprocedure('public.get_chat_turn_recovery(uuid)');
begin
 select * into p from pg_proc where oid=target;
 if not found or (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='get_chat_turn_recovery')<>1
  or pg_get_userbyid(p.proowner)<>'postgres'
  or p.proacl is distinct from array['postgres=X/postgres','authenticated=X/postgres']::aclitem[]
  or p.prosecdef is distinct from true or p.provolatile<>'v'
  or p.prolang <> (select oid from pg_language where lanname='plpgsql')
  or p.prorettype <> 'jsonb'::regtype or p.proargnames is distinct from array['p_session_id']::text[]
  or p.pronargdefaults<>0 or p.proconfig is distinct from array['search_path=public, pg_temp']::text[]
  or md5(p.prosrc)<>'e3a18d92dcb447ff73a4d684ac80d2d0' then
   raise exception 'Unexpected chat recovery readback';
 end if;
end
$recovery_readback$;

create function public.resolve_expired_chat_turn(p_session_id uuid, p_request_id text, p_expected_attempt integer)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare s clinical_sessions%rowtype; t chat_turns%rowtype; owner_id uuid:=auth.uid();
begin
 if owner_id is null or p_request_id is null or p_request_id !~ '^[A-Za-z0-9_-]{1,100}$' or p_expected_attempt is null or p_expected_attempt<1
    or not exists(select 1 from clinical_sessions where id=p_session_id and user_id=owner_id) then
  raise exception 'Owned session required' using errcode='42501';
 end if;
 begin
  select * into s from clinical_sessions where id=p_session_id and user_id=owner_id for update nowait;
  if not found then raise exception 'Owned session required' using errcode='42501'; end if;
  if s.status<>'open' then return 'closed'; end if;
  select * into t from chat_turns where session_id=s.id and user_id=owner_id and request_id=p_request_id for update nowait;
  if not found then return 'unknown'; end if;
  if t.attempts<>p_expected_attempt then return 'stale'; end if;
  if t.status in ('failed','completed','interrupted') then return t.status; end if;
  if t.status<>'generating' then raise exception 'Invalid turn state' using errcode='23514'; end if;
  if t.lease_until>clock_timestamp() then return 'active'; end if;
  update chat_turns set status='failed',token=gen_random_uuid(),error_code='lease_expired'
   where session_id=s.id and request_id=t.request_id and user_id=owner_id;
  return 'failed';
 exception when lock_not_available then return 'busy'; end;
end $$;
revoke all on function public.resolve_expired_chat_turn(uuid,text,integer) from public,anon,service_role;
grant execute on function public.resolve_expired_chat_turn(uuid,text,integer) to authenticated;
