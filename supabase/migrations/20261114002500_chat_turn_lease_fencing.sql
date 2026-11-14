-- Fence chat effects using session -> turn lock order. A competing fail
-- updates the same turn row, so it cannot publish failure ahead of an
-- already-authorized questionnaire transaction. Read the wall clock only
-- after row locks are acquired, since lock waits can outlive a lease.

-- Fingerprints come from the preceding local migrations on PostgreSQL 17.6.
do $baseline$
declare expected record; routine record; routine_id oid;
begin
 for expected in select * from (values
   ('public.begin_chat_turn_after_onboarding(uuid,uuid,text,text,boolean,boolean)','cb51c0fdb8039f9bf29b97dfb89f4c06','d9e17930c934aa505decc933e87f692c',false),
   ('public.close_chat_turn(uuid,text,uuid,text)','3c319138867a6b592c20f3dc0affc1d0','6fd4dec5945aad52157cbb8098840848',true),
   ('public.create_questionnaire_atomic(uuid,uuid,uuid,text,text,text,uuid)','e573ef47b91428d4437fdcd3a7853eeb','32dd1c3af53804d8ec5d2785e02aa76b',true),
   ('public.finish_chat_turn(uuid,text,uuid,jsonb,jsonb,text,text)','7bfd3c3a7cb837c07fb597c320b99fc1','dffdac3d62f4464a060e6763cef9d725',true)
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
   raise exception 'Unexpected chat lease baseline: %', expected.signature;
  end if;
 end loop;
end
$baseline$;

create or replace function create_questionnaire_atomic(p_session_id uuid,p_user_id uuid,p_conversation_id uuid,p_code text,p_reason text,p_request_id text default null,p_token uuid default null)
returns questionnaire_instances language plpgsql set search_path=public,pg_temp as $$
declare t chat_turns%rowtype; s clinical_sessions%rowtype; q questionnaire_definitions%rowtype; i questionnaire_instances%rowtype;
begin
 select * into s from clinical_sessions where id=p_session_id and user_id=p_user_id and conversation_id=p_conversation_id for update;
 if not found or s.status<>'open' then raise exception 'Open owned session required' using errcode='42501'; end if;
 if p_request_id is not null then
  select * into t from chat_turns where session_id=s.id and request_id=p_request_id and token=p_token for update;
  if not found or t.status<>'generating' or t.lease_until<=clock_timestamp() then
   raise exception 'Stale turn owner' using errcode='42501';
  end if;
 end if;
 select * into q from questionnaire_definitions where code=p_code and is_active and not is_clinician_rated;
 if not found then raise exception 'Patient questionnaire required' using errcode='23514'; end if;
 if p_request_id is not null then
  select * into i from questionnaire_instances where session_id=s.id and chat_request_id=p_request_id and questionnaire_id=q.id;
  if found then return i; end if;
 end if;
 if p_code='CSSRS' then
  select * into i from questionnaire_instances where session_id=s.id and questionnaire_id=q.id and status in ('proposed','in_progress') order by created_at desc limit 1;
  if found then return i; end if;
  update questionnaire_instances set status='cancelled' where session_id=s.id and status in ('proposed','in_progress');
 else
  select * into i from questionnaire_instances where session_id=s.id and status in ('proposed','in_progress') order by created_at desc limit 1;
  if found then return i; end if;
 end if;
 insert into questionnaire_instances(user_id,session_id,conversation_id,questionnaire_id,triggered_by,status,trigger_reason,chat_request_id)
 values(s.user_id,s.id,s.conversation_id,q.id,'ai','proposed',p_reason,p_request_id) returning * into i;
 return i;
end $$;

create or replace function finish_chat_turn(p_session_id uuid,p_request_id text,p_token uuid,p_parts jsonb,p_chunks jsonb,p_proposal text default null,p_close_reason text default null)
returns void language plpgsql set search_path=public,pg_temp as $$
declare t chat_turns%rowtype; s clinical_sessions%rowtype;
begin
 select * into s from clinical_sessions where id=p_session_id for update;
 select * into t from chat_turns where session_id=s.id and request_id=p_request_id and token=p_token for update;
 if not found then raise exception 'Stale turn owner' using errcode='42501'; end if;
 if t.status='completed' then return; end if;
 if s.status<>'open' then raise exception 'Session closed' using errcode='42501'; end if;
 if t.status<>'generating' or t.lease_until<=clock_timestamp() then raise exception 'Expired turn' using errcode='42501'; end if;
 if p_close_reason is not null then
  if not (p_close_reason='time_limit' and s.opened_at<=now()-interval '1 hour') and not close_chat_turn(s.id,t.request_id,t.token,p_close_reason) then raise exception 'Closure not authorized' using errcode='42501'; end if;
 end if;
 if jsonb_typeof(p_parts) is distinct from 'array' or jsonb_array_length(p_parts)=0 or jsonb_typeof(p_chunks) is distinct from 'array' then raise exception 'Empty response' using errcode='23514'; end if;
 insert into messages(conversation_id,session_id,role,parts) values(s.conversation_id,s.id,'assistant',p_parts);
 update chat_turns set status='completed',response_parts=p_parts,response_chunks=p_chunks,error_code=null where session_id=s.id and request_id=t.request_id;
 -- The own-turn close commits the assistant first, then seals the transcript
 -- and creates its outbox in this same transaction. No worker sees a gap.
 if p_close_reason is not null then perform close_session_atomic(s.id,t.user_id,p_close_reason); end if;
 delete from session_close_proposals where session_id=s.id;
 if p_proposal is not null and p_close_reason is null and s.status='open' then insert into session_close_proposals values(s.id,t.request_id,p_proposal); end if;
end $$;

create or replace function close_chat_turn(p_session_id uuid,p_request_id text,p_token uuid,p_reason text)
returns boolean language plpgsql set search_path=public,pg_temp as $$
declare s clinical_sessions%rowtype; t chat_turns%rowtype;
begin
 select * into s from clinical_sessions where id=p_session_id for update;
 select * into t from chat_turns where session_id=s.id and request_id=p_request_id and token=p_token for update;
 if not found or t.status<>'generating' or t.lease_until<=clock_timestamp() then raise exception 'Stale turn owner' using errcode='42501'; end if;
 if p_reason in ('user_request','time_limit') then
  perform 1 from session_close_proposals where session_id=s.id and request_id=t.previous_request_id and reason=p_reason;
  if not found or trim(t.text) !~* '^(s[ií](,?\s+(cerramos|quiero cerrar( la sesi[oó]n)?))?|de acuerdo|vale|acepto|cerramos|quiero cerrar( la sesi[oó]n)?)[.!\s]*$' then return false; end if;
 elsif p_reason='crisis_detected' then
  if not exists(select 1 from risk_events where session_id=s.id and ((payload_json->>'request_id'=t.request_id and payload_json->>'signal'='textual_crisis') or (source_type='questionnaire' and severity='critical'))) then return false; end if;
 else return false;
 end if;
 return true;
end $$;

create or replace function begin_chat_turn_after_onboarding(p_session_id uuid,p_user_id uuid,p_request_id text,p_text text,p_crisis boolean default false,p_urgent boolean default false)
returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare s clinical_sessions%rowtype; t chat_turns%rowtype; mid uuid; prev text; urgent boolean:=false; lease_stamp timestamptz;
begin
 select * into s from clinical_sessions where id=p_session_id and user_id=p_user_id for update;
 if not found then raise exception 'Owned session required' using errcode='42501'; end if;
 select * into t from chat_turns where session_id=s.id and request_id=p_request_id for update;
 lease_stamp=clock_timestamp();
 if found then
  if t.text<>p_text then raise exception 'Conflicting request ID' using errcode='23514'; end if;
  if t.status='completed' then return jsonb_build_object('replay',true,'chunks',t.response_chunks); end if;
  if t.status='interrupted' then raise exception 'Turn interrupted by urgent signal' using errcode='23514'; end if;
  if t.status='generating' and t.lease_until>lease_stamp then raise exception 'turn_in_progress' using errcode='55P03'; end if;
  if t.attempts>=3 then raise exception 'turn_attempts_exhausted' using errcode='23514'; end if;
 else
  if s.status<>'open' then raise exception 'Session closed' using errcode='23514'; end if;
 end if;
 if exists(select 1 from chat_turns where session_id=s.id and request_id<>p_request_id and status in ('generating','failed')) then
  if not p_crisis or not p_urgent or t.request_id is not null then raise exception 'Resolve previous turn first' using errcode='55P03'; end if;
  -- A fresh, specific safety signal may interrupt an unresolved turn. Fence
  -- its owner and answer deterministically; never start a second LLM call.
  update chat_turns set status='interrupted',token=gen_random_uuid(),lease_until=lease_stamp,error_code='urgent_signal' where session_id=s.id and status in ('generating','failed');
  urgent=true;
 end if;
 if t.request_id is null then
  if (select count(*) from chat_turns where session_id=s.id)>=80 then
   if not p_crisis or not p_urgent then raise exception 'turn_limit' using errcode='23514'; end if;
   urgent=true;
  end if;
  select request_id into prev from chat_turns where session_id=s.id order by created_at desc limit 1;
  insert into messages(conversation_id,session_id,role,parts) values(s.conversation_id,s.id,'user',jsonb_build_array(jsonb_build_object('type','text','text',p_text))) returning id into mid;
  insert into chat_turns(session_id,request_id,user_id,text,user_message_id,previous_request_id,status,lease_until,urgent_response) values(s.id,p_request_id,p_user_id,p_text,mid,prev,'generating',clock_timestamp()+interval '2 minutes',urgent) returning * into t;
  if p_crisis then
   insert into risk_events(user_id,session_id,conversation_id,risk_type,severity,source_type,payload_json) values(s.user_id,s.id,s.conversation_id,'suicidal_ideation','high','conversation',jsonb_build_object('request_id',p_request_id,'signal','textual_crisis'));
  end if;
 else
  update chat_turns set status='generating',token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes',attempts=attempts+1,error_code=null where session_id=s.id and request_id=p_request_id returning * into t;
 end if;
 update clinical_sessions set last_activity_at=clock_timestamp() where id=s.id;
 return jsonb_build_object('replay',false,'token',t.token,'userMessageId',t.user_message_id,'urgent',t.urgent_response);
end $$;

do $readback$
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
   raise exception 'Unexpected chat lease readback: %', expected.signature;
  end if;
 end loop;
end
$readback$;
