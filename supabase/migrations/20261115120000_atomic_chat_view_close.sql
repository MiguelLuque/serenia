-- Fail closed unless this migration is replacing the exact reviewed hosted
-- implementation. In particular, do not silently revoke or replace an
-- unexpected SECURITY DEFINER routine or discard a new PostgREST overload.
do $preflight$
declare
  close_id oid := to_regprocedure('public.close_session_atomic(uuid,uuid,text)');
  p pg_proc%rowtype;
begin
  if close_id is null
    or (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='close_session_atomic')<>1 then
    raise exception 'Unexpected close-session baseline';
  end if;

  select * into p from pg_proc where oid=close_id;
  if pg_get_userbyid(p.proowner)<>'postgres'
    or p.proacl is distinct from array['postgres=X/postgres','authenticated=X/postgres','service_role=X/postgres']::aclitem[]
    or p.prosecdef is distinct from true
    or p.provolatile<>'v'
    or p.prolang <> (select oid from pg_language where lanname='plpgsql')
    or p.prorettype <> 'void'::regtype
    or p.proargnames is distinct from array['p_session_id','p_user_id','p_reason']::text[]
    or p.pronargdefaults<>0
    or p.proconfig is distinct from array['search_path=public, pg_temp']::text[]
    or md5(p.prosrc)<>'382ab2a18a7528ba6bce8ae1ed2eb38e'
    or has_function_privilege('anon',close_id,'EXECUTE')
    or not has_function_privilege('authenticated',close_id,'EXECUTE')
    or not has_function_privilege('service_role',close_id,'EXECUTE')
    or exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='close_session_from_chat_view') then
    raise exception 'Unexpected close-session baseline';
  end if;
end
$preflight$;

-- Serialize view-driven session closure with accepted turn admission. A
-- browser-side recovery read is useful for display but cannot be the close
-- authorization check because a turn may be admitted immediately afterward.
create or replace function public.close_session_atomic(p_session_id uuid,p_user_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s clinical_sessions%rowtype; c conversations%rowtype; stamp timestamptz;
begin
  if current_setting('role',true)<>'service_role' and (auth.uid() is null or auth.uid()<>p_user_id) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if p_reason is null or p_reason not in ('user_request','time_limit','crisis_detected','inactivity') then
    raise exception 'Invalid closure reason' using errcode='23514';
  end if;
  select * into s from clinical_sessions where id=p_session_id and user_id=p_user_id for update;
  if not found then raise exception 'Session not found' using errcode='42501'; end if;

  if s.status<>'closed' then
    if s.status<>'open' then raise exception 'Invalid closure transition' using errcode='23514'; end if;
    -- Keep the global lock order session -> unresolved turns -> conversation.
    perform 1 from chat_turns where session_id=s.id and status in ('generating','failed') order by request_id for update;
    stamp=clock_timestamp();
    if p_reason='inactivity' and exists(select 1 from chat_turns where session_id=s.id and status in ('generating','failed')) then
      raise exception 'Unresolved chat turn' using errcode='23514';
    end if;
    if p_reason='inactivity' and s.last_activity_at>stamp-interval '30 minutes' then
      raise exception 'Session activity resumed' using errcode='23514';
    end if;
  end if;

  select * into c from conversations where id=s.conversation_id and user_id=s.user_id for update;
  if not found then raise exception 'Conversation ownership mismatch' using errcode='23514'; end if;
  if s.status<>'closed' then
    if s.status<>'open' or c.status<>'active' then
      raise exception 'Invalid closure transition' using errcode='23514';
    end if;
    stamp=clock_timestamp();
    update clinical_sessions set status='closed',closed_at=stamp,closure_reason=p_reason where id=s.id;
    update conversations set status='closed',ended_at=stamp where id=c.id;
  end if;
  -- Any accepted turn loses its token before the outbox becomes visible.
  update chat_turns set status='interrupted',token=gen_random_uuid(),lease_until=clock_timestamp(),error_code='session_closed'
    where session_id=s.id and status in ('generating','failed');
  delete from session_close_proposals where session_id=s.id;
  insert into assessment_jobs(session_id) values(s.id) on conflict do nothing;
end
$$;

-- Patient-facing closure must go through the serialized view RPC below.
revoke all on function public.close_session_atomic(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.close_session_atomic(uuid,uuid,text) to service_role;

-- PostgREST identifies RPC overloads by their argument names and types. Remove
-- the boolean acknowledgement contract so stale clients cannot retain it.
drop function if exists public.close_session_from_chat_view(uuid,text,boolean);

create function public.close_session_from_chat_view(
  p_session_id uuid,
  p_reason text,
  p_confirm_request_id text default null,
  p_confirm_attempt integer default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  s clinical_sessions%rowtype;
  stamp timestamptz;
  expires_at timestamptz;
  has_live_turn boolean;
  has_unresolved_turn boolean;
  unresolved_request_id text;
  unresolved_attempt integer;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized' using errcode='42501';
  end if;
  if p_reason is null or p_reason not in ('user_request','time_limit') then
    raise exception 'Invalid closure reason' using errcode='23514';
  end if;
  if (p_confirm_request_id is null) is distinct from (p_confirm_attempt is null) then
    raise exception 'Invalid closure confirmation' using errcode='23514';
  end if;
  if p_confirm_request_id is not null and (
    p_confirm_request_id !~ '^[A-Za-z0-9_-]{1,100}$'
    or p_confirm_attempt not between 1 and 3
  ) then
    raise exception 'Invalid closure confirmation' using errcode='23514';
  end if;

  select * into s
  from clinical_sessions
  where id=p_session_id and user_id=auth.uid()
  for update;
  if not found then
    raise exception 'Owned session required' using errcode='42501';
  end if;
  if s.status<>'open' then
    return jsonb_build_object('closed',true,'newlyClosed',false);
  end if;

  -- Match every turn writer's lock order (session, then turn). fail_chat_turn
  -- updates only the turn, so explicitly lock unresolved rows before reading
  -- their state as well. Read the clock after lock waits complete.
  perform 1
  from chat_turns
  where session_id=s.id and status in ('generating','failed')
  order by request_id
  for update;

  stamp=clock_timestamp();
  expires_at=s.opened_at + interval '1 hour';
  if p_reason='time_limit' and stamp<expires_at then
    return jsonb_build_object(
      'closed',false,
      'reason','not_expired',
      'timing',jsonb_build_object(
        'serverNow',floor(extract(epoch from stamp)*1000)::bigint,
        'expiresAt',floor(extract(epoch from expires_at)*1000)::bigint
      )
    );
  end if;

  select exists(
    select 1 from chat_turns
    where session_id=s.id and status='generating' and lease_until>stamp
  ) into has_live_turn;
  if has_live_turn then
    return jsonb_build_object(
      'closed',false,
      'reason','turn_pending',
      'timing',jsonb_build_object(
        'serverNow',floor(extract(epoch from stamp)*1000)::bigint,
        'expiresAt',floor(extract(epoch from expires_at)*1000)::bigint
      )
    );
  end if;

  select request_id,attempts
  into unresolved_request_id,unresolved_attempt
  from chat_turns
  where session_id=s.id and (status='failed' or (status='generating' and lease_until<=stamp))
  order by request_id
  limit 1;
  has_unresolved_turn := found;
  if has_unresolved_turn and (
    p_confirm_request_id is distinct from unresolved_request_id
    or p_confirm_attempt is distinct from unresolved_attempt
  ) then
    return jsonb_build_object(
      'closed',false,
      'reason','turn_unresolved',
      'requestId',unresolved_request_id,
      'attempt',unresolved_attempt,
      'timing',jsonb_build_object(
        'serverNow',floor(extract(epoch from stamp)*1000)::bigint,
        'expiresAt',floor(extract(epoch from expires_at)*1000)::bigint
      )
    );
  end if;

  perform close_session_atomic(s.id,s.user_id,p_reason);
  return jsonb_build_object('closed',true,'newlyClosed',true);
end
$$;

revoke all on function public.close_session_from_chat_view(uuid,text,text,integer) from public,anon,service_role;
grant execute on function public.close_session_from_chat_view(uuid,text,text,integer) to authenticated;
