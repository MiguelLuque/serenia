-- Store a categorized response only when it answers the immediately preceding
-- server-stored safety prompt. The marker is never accepted from the caller.

do $preflight$
declare
  internal_id oid := to_regprocedure(
    'public.begin_chat_turn_after_onboarding(uuid,uuid,text,text,boolean,boolean)'
  );
  public_id oid := to_regprocedure(
    'public.begin_chat_turn(uuid,uuid,text,text,boolean,boolean)'
  );
  p pg_proc%rowtype;
begin
  if to_regclass('public.chat_turns') is null
    or to_regclass('public.risk_events') is null then
    raise exception 'Conversation safety routing tables are missing';
  end if;
  if internal_id is null or public_id is null
    or (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='begin_chat_turn_after_onboarding') <> 1
    or (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='begin_chat_turn') <> 1 then
    raise exception 'Unexpected chat turn RPC signatures or overloads';
  end if;

  select * into p from pg_proc where oid=internal_id;
  if pg_get_userbyid(p.proowner)<>'postgres'
    or p.proacl is distinct from array['postgres=X/postgres']::aclitem[]
    or p.prosecdef is distinct from false
    or p.provolatile<>'v'
    or p.prolang <> (select oid from pg_language where lanname='plpgsql')
    or p.prorettype <> 'jsonb'::regtype
    or p.proargnames is distinct from array[
      'p_session_id','p_user_id','p_request_id','p_text','p_crisis','p_urgent'
    ]::text[]
    or p.pronargdefaults<>2
    or p.proconfig is distinct from array['search_path=public, pg_temp']::text[]
    or md5(p.prosrc)<>'8274fd5d25d0978815fa71a0f1620f55' then
    raise exception 'Unexpected begin_chat_turn_after_onboarding baseline';
  end if;

  select * into p from pg_proc where oid=public_id;
  if pg_get_userbyid(p.proowner)<>'postgres'
    or p.proacl is distinct from array['postgres=X/postgres','service_role=X/postgres']::aclitem[]
    or p.prosecdef is distinct from true
    or p.provolatile<>'v'
    or p.prolang <> (select oid from pg_language where lanname='plpgsql')
    or p.prorettype <> 'jsonb'::regtype
    or p.proargnames is distinct from array[
      'p_session_id','p_user_id','p_request_id','p_text','p_crisis','p_urgent'
    ]::text[]
    or p.pronargdefaults<>2
    or p.proconfig is distinct from array['search_path=public, pg_temp']::text[]
    or md5(p.prosrc)<>'fbf4197e0424eced6330a226e411829c' then
    raise exception 'Unexpected public begin_chat_turn baseline';
  end if;
end
$preflight$;

alter table public.chat_turns
  add column safety_answer text,
  add column safety_answer_risk_type public.risk_type,
  add constraint chat_turns_safety_answer_category
    check (safety_answer is null or safety_answer in ('affirmative','negative','unclear','skip')),
  add constraint chat_turns_safety_answer_type_pair
    check ((safety_answer is null) = (safety_answer_risk_type is null)),
  add constraint chat_turns_safety_answer_type_allowed
    check (safety_answer_risk_type is null
      or safety_answer_risk_type in ('suicidal_ideation','self_harm','crisis_other'));

comment on column public.chat_turns.safety_answer is
  'Server-validated category answering the immediately preceding versioned safety prompt; not a clinical assessment.';
comment on column public.chat_turns.safety_answer_risk_type is
  'Risk topic taken from the server-stored prompt answered by safety_answer; not a diagnosis.';

-- Prevent duplicate turn-linked safety events even if a future retry path is
-- changed. Existing unrelated conversation events remain unaffected.
create unique index risk_events_chat_safety_request_unique
  on public.risk_events (
    session_id,
    (payload_json->>'request_id'),
    (payload_json->>'signal')
  )
  where source_type='conversation'
    and session_id is not null
    and payload_json->>'signal' in ('textual_crisis','safety_clarification_affirmative');

-- Drop the wrapper first, then its internal function. PostgreSQL function
-- identity includes argument types; leaving the old overload beside defaults
-- makes calls with the old argument shape ambiguous.
drop function public.begin_chat_turn(uuid,uuid,text,text,boolean,boolean);
drop function public.begin_chat_turn_after_onboarding(uuid,uuid,text,text,boolean,boolean);

create function public.begin_chat_turn_after_onboarding(
  p_session_id uuid,
  p_user_id uuid,
  p_request_id text,
  p_text text,
  p_crisis boolean default false,
  p_urgent boolean default false,
  p_direct_risk_type public.risk_type default null,
  p_safety_answer text default null,
  p_safety_answer_risk_type public.risk_type default null,
  p_safety_answer_required boolean default false
)
returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare
  s clinical_sessions%rowtype;
  t chat_turns%rowtype;
  prev_turn chat_turns%rowtype;
  mid uuid;
  prev text;
  marker_type text;
  marker_version text;
  marker_count integer := 0;
  urgent boolean := false;
  direct_signal boolean := false;
  effective_direct_risk_type public.risk_type;
  effective_safety_answer text;
  effective_safety_answer_risk_type public.risk_type;
  effective_safety_answer_required boolean := false;
  turn_exists boolean := false;
  lease_stamp timestamptz;
begin
  if p_direct_risk_type is not null
    and p_direct_risk_type not in ('suicidal_ideation','self_harm','crisis_other') then
    raise exception 'Unsupported direct risk type' using errcode='23514';
  end if;
  direct_signal := p_crisis or p_direct_risk_type is not null;
  effective_direct_risk_type := coalesce(
    p_direct_risk_type,
    case when p_crisis then 'suicidal_ideation'::public.risk_type end
  );
  if p_urgent and not direct_signal then
    raise exception 'Urgent turn requires a direct safety signal' using errcode='23514';
  end if;

  if not direct_signal then
    if (p_safety_answer is null) is distinct from (p_safety_answer_risk_type is null)
      or p_safety_answer_required is distinct from (p_safety_answer is not null) then
      raise exception 'Safety answer candidate and requirement must be supplied together' using errcode='23514';
    end if;
    if p_safety_answer is not null
      and p_safety_answer not in ('affirmative','negative','unclear','skip') then
      raise exception 'Unsupported safety answer category' using errcode='23514';
    end if;
    if p_safety_answer_risk_type is not null
      and p_safety_answer_risk_type not in ('suicidal_ideation','self_harm','crisis_other') then
      raise exception 'Unsupported safety answer risk type' using errcode='23514';
    end if;
    effective_safety_answer := p_safety_answer;
    effective_safety_answer_risk_type := p_safety_answer_risk_type;
    effective_safety_answer_required := p_safety_answer_required;
  end if;

  select * into s
  from public.clinical_sessions
  where id=p_session_id and user_id=p_user_id
  for update;
  if not found then
    raise exception 'Owned session required' using errcode='42501';
  end if;

  select * into t
  from public.chat_turns
  where session_id=s.id and request_id=p_request_id
  for update;
  turn_exists := found;
  lease_stamp := clock_timestamp();

  if turn_exists then
    if t.text<>p_text then
      raise exception 'Conflicting request ID' using errcode='23514';
    end if;
    if t.status='completed' then
      return jsonb_build_object(
        'replay',true,
        'chunks',t.response_chunks,
        'safetyAnswer',t.safety_answer,
        'safetyAnswerRiskType',t.safety_answer_risk_type
      );
    end if;
    if t.status='interrupted' then
      raise exception 'Turn interrupted by urgent signal' using errcode='23514';
    end if;
    if not direct_signal and (t.safety_answer is distinct from effective_safety_answer
      or t.safety_answer_risk_type is distinct from effective_safety_answer_risk_type) then
      raise exception 'Retry cannot change the first safety answer' using errcode='23514';
    end if;
    if t.status='generating' and t.lease_until>lease_stamp then
      raise exception 'turn_in_progress' using errcode='55P03';
    end if;
    if t.attempts>=3 then
      raise exception 'turn_attempts_exhausted' using errcode='23514';
    end if;

    update public.chat_turns
    set status='generating',token=gen_random_uuid(),
        lease_until=clock_timestamp()+interval '2 minutes',
        attempts=attempts+1,error_code=null
    where session_id=s.id and request_id=p_request_id
    returning * into t;
  else
    if s.status<>'open' then
      raise exception 'Session closed' using errcode='23514';
    end if;

    select * into prev_turn
    from public.chat_turns
    where session_id=s.id
    order by created_at desc, request_id desc
    limit 1
    for update;
    if found then
      prev := prev_turn.request_id;
      if prev_turn.status='completed'
        and jsonb_typeof(prev_turn.response_parts)='array' then
        select count(*)::integer,
          min(part#>>'{data,riskType}'),
          min(part#>>'{data,version}')
        into marker_count, marker_type, marker_version
        from jsonb_array_elements(prev_turn.response_parts) as response_part(part)
        where part->>'type'='data-safety-prompt';
      end if;
    end if;

    -- An explicit current disclosure takes priority over an outstanding
    -- prompt. It is recorded once with its own topic; no moderate answer event
    -- is also created. Otherwise every pending prompt requires a category.
    if marker_count>0 then
      if marker_count<>1 or marker_version is distinct from '1'
        or marker_type is null
        or marker_type not in ('suicidal_ideation','self_harm','crisis_other') then
        if not direct_signal then
          raise exception 'Invalid server safety prompt marker' using errcode='23514';
        end if;
      elsif direct_signal then
        -- Preserve a valid answer classification when a direct signal is also
        -- present, but the explicit signal remains the only risk event.
        if p_safety_answer_required
          and p_safety_answer in ('affirmative','negative','unclear','skip')
          and p_safety_answer_risk_type::text=marker_type then
          effective_safety_answer := p_safety_answer;
          effective_safety_answer_risk_type := p_safety_answer_risk_type;
          effective_safety_answer_required := true;
        end if;
      elsif not effective_safety_answer_required
        or effective_safety_answer is null
        or marker_type is distinct from effective_safety_answer_risk_type::text then
        raise exception 'Safety answer required for the immediately preceding prompt' using errcode='23514';
      end if;
    elsif not direct_signal and (effective_safety_answer_required or effective_safety_answer is not null) then
      raise exception 'No immediately preceding safety prompt authorizes this answer' using errcode='23514';
    end if;

    if exists(
      select 1 from public.chat_turns
      where session_id=s.id and request_id<>p_request_id and status in ('generating','failed')
    ) then
      if not direct_signal or not p_urgent or turn_exists then
        raise exception 'Resolve previous turn first' using errcode='55P03';
      end if;
      -- Keep the existing session -> turn lock order. A fresh direct signal
      -- can fence an unresolved response and receive deterministic handling.
      update public.chat_turns
      set status='interrupted',token=gen_random_uuid(),lease_until=lease_stamp,error_code='urgent_signal'
      where session_id=s.id and status in ('generating','failed');
      urgent := true;
    end if;

    if (select count(*) from public.chat_turns where session_id=s.id)>=80 then
      if not direct_signal or not p_urgent then
        raise exception 'turn_limit' using errcode='23514';
      end if;
      urgent := true;
    end if;

    insert into public.messages(conversation_id,session_id,role,parts)
    values (
      s.conversation_id,s.id,'user',
      jsonb_build_array(jsonb_build_object('type','text','text',p_text))
    ) returning id into mid;

    insert into public.chat_turns(
      session_id,request_id,user_id,text,user_message_id,previous_request_id,
      status,lease_until,urgent_response,safety_answer,safety_answer_risk_type
    ) values (
      s.id,p_request_id,p_user_id,p_text,mid,prev,'generating',
      clock_timestamp()+interval '2 minutes',urgent,
      effective_safety_answer,
      effective_safety_answer_risk_type
    ) returning * into t;

    if direct_signal then
      insert into public.risk_events(
        user_id,session_id,conversation_id,risk_type,severity,source_type,payload_json
      ) values (
        s.user_id,s.id,s.conversation_id,effective_direct_risk_type,'high','conversation',
        jsonb_build_object(
          'request_id',p_request_id,
          'signal','textual_crisis',
          'needs_clinician_review',true,
          'interpretation','provisional_text_signal_not_diagnosis'
        )
      );
    end if;

    if not direct_signal and effective_safety_answer_required and effective_safety_answer='affirmative' then
      insert into public.risk_events(
        user_id,session_id,conversation_id,risk_type,severity,source_type,payload_json
      ) values (
        s.user_id,s.id,s.conversation_id,effective_safety_answer_risk_type,'moderate','conversation',
        jsonb_build_object(
          'request_id',p_request_id,
          'prompt_request_id',prev,
          'signal','safety_clarification_affirmative',
          'answer','affirmative',
          'needs_clinician_review',true,
          'interpretation','provisional_text_signal_not_diagnosis'
        )
      );
    end if;
  end if;

  update public.clinical_sessions set last_activity_at=clock_timestamp() where id=s.id;
  return jsonb_build_object(
    'replay',false,
    'token',t.token,
    'userMessageId',t.user_message_id,
    'urgent',t.urgent_response,
    'safetyAnswer',t.safety_answer,
    'safetyAnswerRiskType',t.safety_answer_risk_type
  );
end
$$;

revoke all on function public.begin_chat_turn_after_onboarding(
  uuid,uuid,text,text,boolean,boolean,public.risk_type,text,public.risk_type,boolean
) from public,anon,authenticated,service_role;

create function public.begin_chat_turn(
  p_session_id uuid,
  p_user_id uuid,
  p_request_id text,
  p_text text,
  p_crisis boolean default false,
  p_urgent boolean default false,
  p_direct_risk_type public.risk_type default null,
  p_safety_answer text default null,
  p_safety_answer_risk_type public.risk_type default null,
  p_safety_answer_required boolean default false
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  -- Preserve the patient-onboarding gate and keep this RPC server-only.
  perform 1 from public.user_profiles where user_id=p_user_id for share;
  if not public.patient_onboarding_ready(p_user_id) then
    raise exception 'Current adult onboarding required' using errcode='23514';
  end if;
  return public.begin_chat_turn_after_onboarding(
    p_session_id,p_user_id,p_request_id,p_text,p_crisis,p_urgent,
    p_direct_risk_type,p_safety_answer,p_safety_answer_risk_type,p_safety_answer_required
  );
end
$$;

revoke all on function public.begin_chat_turn(
  uuid,uuid,text,text,boolean,boolean,public.risk_type,text,public.risk_type,boolean
) from public,anon,authenticated,service_role;
grant execute on function public.begin_chat_turn(
  uuid,uuid,text,text,boolean,boolean,public.risk_type,text,public.risk_type,boolean
) to service_role;

do $readback$
declare
  internal_id oid := to_regprocedure(
    'public.begin_chat_turn_after_onboarding(uuid,uuid,text,text,boolean,boolean,public.risk_type,text,public.risk_type,boolean)'
  );
  public_id oid := to_regprocedure(
    'public.begin_chat_turn(uuid,uuid,text,text,boolean,boolean,public.risk_type,text,public.risk_type,boolean)'
  );
  p pg_proc%rowtype;
begin
  if internal_id is null or public_id is null
    or (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='begin_chat_turn_after_onboarding')<>1
    or (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='begin_chat_turn')<>1 then
    raise exception 'Conversation safety RPC overload readback failed';
  end if;

  select * into p from pg_proc where oid=internal_id;
  if pg_get_userbyid(p.proowner)<>'postgres'
    or p.proacl is distinct from array['postgres=X/postgres']::aclitem[]
    or p.prosecdef is distinct from false
    or p.provolatile<>'v'
    or p.prolang <> (select oid from pg_language where lanname='plpgsql')
    or p.prorettype <> 'jsonb'::regtype
    or p.proargnames is distinct from array[
      'p_session_id','p_user_id','p_request_id','p_text','p_crisis','p_urgent',
      'p_direct_risk_type','p_safety_answer','p_safety_answer_risk_type','p_safety_answer_required'
    ]::text[]
    or p.pronargdefaults<>6
    or p.proconfig is distinct from array['search_path=public, pg_temp']::text[]
    or md5(p.prosrc)<>'136e68882142503adf1465453c78ecee' then
    raise exception 'Conversation safety internal RPC readback failed';
  end if;

  select * into p from pg_proc where oid=public_id;
  if pg_get_userbyid(p.proowner)<>'postgres'
    or p.proacl is distinct from array['postgres=X/postgres','service_role=X/postgres']::aclitem[]
    or p.prosecdef is distinct from true
    or p.provolatile<>'v'
    or p.prolang <> (select oid from pg_language where lanname='plpgsql')
    or p.prorettype <> 'jsonb'::regtype
    or p.proargnames is distinct from array[
      'p_session_id','p_user_id','p_request_id','p_text','p_crisis','p_urgent',
      'p_direct_risk_type','p_safety_answer','p_safety_answer_risk_type','p_safety_answer_required'
    ]::text[]
    or p.pronargdefaults<>6
    or p.proconfig is distinct from array['search_path=public, pg_temp']::text[]
    or md5(p.prosrc)<>'45eb5b4684261193207bcee6ce6496d4' then
    raise exception 'Conversation safety public RPC readback failed';
  end if;
end
$readback$;
