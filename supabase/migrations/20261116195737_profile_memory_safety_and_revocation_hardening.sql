-- Persist whether a source was explicitly admitted for profile memory.
-- Existing messages stay ineligible; historical in-flight jobs are fenced off.
alter table public.messages
  add column profile_memory_eligible boolean not null default false;

alter table public.profile_extraction_jobs
  drop constraint profile_extraction_jobs_error_code_check;
alter table public.profile_extraction_jobs
  add constraint profile_extraction_jobs_error_code_check
  check(error_code in ('processing_failed','claims_exhausted','consent_withdrawn','source_ineligible'));

update public.profile_extraction_jobs j
set status='cancelled',token=gen_random_uuid(),lease_until=null,
    error_code='source_ineligible',updated_at=clock_timestamp()
from public.messages m
where m.id=j.source_message_id
  and j.status in ('pending','enqueued','running')
  and not m.profile_memory_eligible;

create or replace function public.profile_source_immutable() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if row(new.id,new.parts,new.role,new.session_id,new.conversation_id,new.created_at,new.profile_memory_eligible)
    is distinct from row(old.id,old.parts,old.role,old.session_id,old.conversation_id,old.created_at,old.profile_memory_eligible)
    and exists(select 1 from public.profile_extraction_jobs where source_message_id=old.id) then
    raise exception 'Profile source is immutable' using errcode='23514';
  end if;
  return new;
end $$;

create or replace function public.enqueue_profile_source() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid; cfg public.profile_settings%rowtype;
begin
  if new.role<>'user' or new.session_id is null or not new.profile_memory_eligible then return new; end if;
  select s.user_id into uid from public.clinical_sessions s
    join public.conversations c on c.id=s.conversation_id and c.user_id=s.user_id
    where s.id=new.session_id and s.conversation_id=new.conversation_id;
  if uid is null then raise exception 'Profile source ownership mismatch' using errcode='23514'; end if;
  select * into cfg from public.profile_settings where user_id=uid for update;
  if not found or not cfg.enabled then return new; end if;
  insert into public.profile_extraction_jobs(user_id,source_message_id,session_id,conversation_id,source_created_at,consent_epoch)
    values(uid,new.id,new.session_id,new.conversation_id,new.created_at,cfg.consent_epoch)
    on conflict(source_message_id) do nothing;
  return new;
end $$;

create or replace function public.validate_profile_source() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if not exists(
    select 1 from public.messages m
    where m.id=new.source_message_id and m.role='user' and m.profile_memory_eligible
      and m.session_id=new.session_id and m.conversation_id=new.conversation_id and m.created_at=new.source_created_at
  ) then
    raise exception 'Profile source must be eligible user content' using errcode='23514';
  end if;
  return new;
end $$;

-- Preserve the existing onboarding gate, safety handling, and turn replay.
-- Session locking makes the pre-existing-turn check race-free and prevents a
-- retry of a pre-consent message from becoming a new memory source.
drop function public.begin_chat_turn(
  uuid,uuid,text,text,boolean,boolean,public.risk_type,text,public.risk_type,boolean,text
);

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
  p_safety_answer_required boolean default false,
  p_safety_answer_prompt_request_id text default null,
  p_profile_memory_eligible boolean default false
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  turn_result jsonb;
  cfg public.profile_settings%rowtype;
  source_id uuid;
  existing_turn boolean;
  profile_source_eligible boolean := false;
begin
  perform 1 from public.user_profiles where user_id=p_user_id for share;
  if not public.patient_onboarding_ready(p_user_id) then
    raise exception 'Current adult onboarding required' using errcode='23514';
  end if;

  perform 1 from public.clinical_sessions where id=p_session_id and user_id=p_user_id for update;
  select exists(
    select 1 from public.chat_turns
    where session_id=p_session_id and user_id=p_user_id and request_id=p_request_id
  ) into existing_turn;

  -- Acquire the consent mutex before the inner admission RPC creates its
  -- lease. Waiting until after admission would age the lease while blocked.
  if not existing_turn
    and p_profile_memory_eligible is true
    and not coalesce(p_crisis,false) and not coalesce(p_urgent,false) and p_direct_risk_type is null
    and p_safety_answer is null and p_safety_answer_required is false
    and p_safety_answer_risk_type is null and p_safety_answer_prompt_request_id is null then
    select * into cfg from public.profile_settings where user_id=p_user_id for update;
    profile_source_eligible := found and cfg.enabled is true;
  end if;

  turn_result := public.begin_chat_turn_after_onboarding(
    p_session_id,p_user_id,p_request_id,p_text,p_crisis,p_urgent,
    p_direct_risk_type,p_safety_answer,p_safety_answer_risk_type,
    p_safety_answer_required,p_safety_answer_prompt_request_id
  );

  if existing_turn or coalesce((turn_result->>'replay')::boolean,false)
    or not profile_source_eligible
    or coalesce(p_crisis,false) or coalesce(p_urgent,false) or p_direct_risk_type is not null
    or p_safety_answer is not null or p_safety_answer_required is true
    or p_safety_answer_risk_type is not null or p_safety_answer_prompt_request_id is not null then
    return turn_result;
  end if;

  source_id := nullif(turn_result->>'userMessageId','')::uuid;
  if source_id is null then return turn_result; end if;

  update public.messages m
  set profile_memory_eligible=true
  where m.id=source_id and m.role='user' and m.session_id=p_session_id
    and exists(select 1 from public.clinical_sessions s
      where s.id=m.session_id and s.user_id=p_user_id and s.conversation_id=m.conversation_id);
  if not found then raise exception 'Admitted profile source unavailable' using errcode='23514'; end if;

  insert into public.profile_extraction_jobs(user_id,source_message_id,session_id,conversation_id,source_created_at,consent_epoch)
  select p_user_id,m.id,m.session_id,m.conversation_id,m.created_at,cfg.consent_epoch
  from public.messages m
  where m.id=source_id and m.profile_memory_eligible
  on conflict(source_message_id) do nothing;

  return turn_result;
end
$$;

revoke all on function public.begin_chat_turn(
  uuid,uuid,text,text,boolean,boolean,public.risk_type,text,public.risk_type,boolean,text,boolean
) from public,anon,authenticated,service_role;
grant execute on function public.begin_chat_turn(
  uuid,uuid,text,text,boolean,boolean,public.risk_type,text,public.risk_type,boolean,text,boolean
) to service_role;

-- Final provider-call preflight. This is deliberately separate from start:
-- consent may be withdrawn while source and target reads are in progress.
create function public.authorize_profile_model_call(p_job_id uuid,p_token uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.profile_extraction_jobs%rowtype;
begin
  j := public.lock_profile_job(p_job_id,p_token);
  if j.status<>'running' then
    raise exception 'Profile claim stale' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.messages m
    where m.id=j.source_message_id and m.role='user' and m.profile_memory_eligible
      and m.session_id=j.session_id and m.conversation_id=j.conversation_id and m.created_at=j.source_created_at
  ) then
    raise exception 'Profile source unavailable' using errcode='42501';
  end if;
  return true;
end $$;
revoke all on function public.authorize_profile_model_call(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.authorize_profile_model_call(uuid,uuid) to service_role;

do $readback$
declare
  begin_id oid := to_regprocedure('public.begin_chat_turn(uuid,uuid,text,text,boolean,boolean,public.risk_type,text,public.risk_type,boolean,text,boolean)');
  authorize_id oid := to_regprocedure('public.authorize_profile_model_call(uuid,uuid)');
  begin_proc pg_proc%rowtype;
  authorize_proc pg_proc%rowtype;
begin
  if begin_id is null or authorize_id is null
    or (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='begin_chat_turn')<>1
    or (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='authorize_profile_model_call')<>1 then
    raise exception 'Profile safety RPC overload readback failed';
  end if;
  select * into begin_proc from pg_proc where oid=begin_id;
  select * into authorize_proc from pg_proc where oid=authorize_id;
  if not begin_proc.prosecdef or begin_proc.proconfig is distinct from array['search_path=public, pg_temp']
    or has_function_privilege('anon',begin_id,'execute')
    or has_function_privilege('authenticated',begin_id,'execute')
    or not has_function_privilege('service_role',begin_id,'execute')
    or not authorize_proc.prosecdef or authorize_proc.proconfig is distinct from array['search_path=public, pg_temp']
    or has_function_privilege('anon',authorize_id,'execute')
    or has_function_privilege('authenticated',authorize_id,'execute')
    or not has_function_privilege('service_role',authorize_id,'execute') then
    raise exception 'Profile safety RPC security readback failed';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='messages'
      and column_name='profile_memory_eligible' and is_nullable='NO' and column_default='false') then
    raise exception 'Profile source eligibility column readback failed';
  end if;
end
$readback$;
