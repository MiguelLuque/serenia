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

-- Expand only: close_session_atomic keeps its authenticated grant until the
-- contract migration (20261115083553) revokes it.

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
  timing jsonb;
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
  timing=jsonb_build_object(
    'serverNow',floor(extract(epoch from stamp)*1000)::bigint,
    'expiresAt',floor(extract(epoch from expires_at)*1000)::bigint
  );
  if p_reason='time_limit' and stamp<expires_at then
    return jsonb_build_object(
      'closed',false,
      'reason','not_expired',
      'timing',timing
    );
  end if;

  if exists(
    select 1 from chat_turns
    where session_id=s.id and status='generating' and lease_until>stamp
  ) then
    return jsonb_build_object(
      'closed',false,
      'reason','turn_pending',
      'timing',timing
    );
  end if;

  select request_id,attempts
  into unresolved_request_id,unresolved_attempt
  from chat_turns
  where session_id=s.id and (status='failed' or (status='generating' and lease_until<=stamp))
  order by request_id
  limit 1;
  if found and (
    p_confirm_request_id is distinct from unresolved_request_id
    or p_confirm_attempt is distinct from unresolved_attempt
  ) then
    return jsonb_build_object(
      'closed',false,
      'reason','turn_unresolved',
      'requestId',unresolved_request_id,
      'attempt',unresolved_attempt,
      'timing',timing
    );
  end if;

  perform close_session_atomic(s.id,s.user_id,p_reason);
  return jsonb_build_object('closed',true,'newlyClosed',true);
end
$$;

revoke all on function public.close_session_from_chat_view(uuid,text,text,integer) from public,anon,service_role;
grant execute on function public.close_session_from_chat_view(uuid,text,text,integer) to authenticated;
