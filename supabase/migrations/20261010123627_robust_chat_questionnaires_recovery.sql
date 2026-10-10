-- Request/outbox state is private operational data; explicit grants do not
-- depend on installation-specific default privileges (Data API / PostgREST).
create table chat_turns (
 session_id uuid not null references clinical_sessions(id) on delete cascade,
 request_id text not null check(length(request_id) between 1 and 100),
 user_id uuid not null references auth.users(id) on delete cascade,
 text text not null check(length(trim(text)) between 1 and 6000),
 user_message_id uuid not null references messages(id) on delete cascade,
 previous_request_id text,
 status text not null check(status in ('generating','completed','failed','interrupted')),
 token uuid not null default gen_random_uuid(),
 lease_until timestamptz not null,
 attempts integer not null default 1 check(attempts between 1 and 3),
 response_parts jsonb, response_chunks jsonb, error_code text,
 urgent_response boolean not null default false,
 created_at timestamptz not null default clock_timestamp(),
 primary key(session_id,request_id),
 foreign key(session_id,user_id) references clinical_sessions(id,user_id) on delete cascade
);
create table session_close_proposals (
 session_id uuid primary key references clinical_sessions(id) on delete cascade,
 request_id text not null,
 reason text not null check(reason in ('user_request','time_limit')),
 foreign key(session_id,request_id) references chat_turns(session_id,request_id) on delete cascade
);
create table assessment_jobs (
 session_id uuid primary key references clinical_sessions(id) on delete cascade,
 context_json jsonb,
 status text not null default 'pending' check(status in ('pending','enqueued','running','completed','exhausted')),
 token uuid, lease_until timestamptz, available_at timestamptz not null default now(),
 attempts integer not null default 0 check(attempts between 0 and 5),
 run_id text, last_error text, updated_at timestamptz not null default now()
);
alter table chat_turns enable row level security;
alter table session_close_proposals enable row level security;
alter table assessment_jobs enable row level security;
revoke all on chat_turns,session_close_proposals,assessment_jobs from public,anon,authenticated;
grant select,insert,update,delete on chat_turns,session_close_proposals,assessment_jobs to service_role;
alter table messages alter column created_at set default clock_timestamp();
create index assessment_jobs_available on assessment_jobs(available_at) where status in ('pending','enqueued','running');
alter table questionnaire_instances add column submission_json jsonb;
alter table questionnaire_instances add column chat_request_id text;
create unique index questionnaire_turn_code_unique on questionnaire_instances(session_id,chat_request_id,questionnaire_id) where chat_request_id is not null;

create function create_session_atomic(p_user_id uuid) returns clinical_sessions
language plpgsql security definer set search_path=public,pg_temp as $$
declare s clinical_sessions%rowtype; cid uuid; phase integer;
begin
 if auth.uid() is null or auth.uid()<>p_user_id then raise exception 'Unauthorized' using errcode='42501'; end if;
 perform 1 from user_profiles where user_id=p_user_id for update;
 if not found then raise exception 'Profile required' using errcode='23514'; end if;
 select * into s from clinical_sessions where user_id=p_user_id and status='open';
 if found then return s; end if;
 select least(count(*)+1,8) into phase from clinical_sessions where user_id=p_user_id and status='closed';
 insert into conversations(user_id) values(p_user_id) returning id into cid;
 insert into clinical_sessions(user_id,conversation_id,protocol_phase) values(p_user_id,cid,phase) returning * into s;
 return s;
end $$;
revoke all on function create_session_atomic(uuid) from public,anon,service_role;
grant execute on function create_session_atomic(uuid) to authenticated;

create function touch_session_atomic(p_session_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 update clinical_sessions set last_activity_at=now() where id=p_session_id and user_id=auth.uid() and status='open';
 if not found then raise exception 'Open owned session required' using errcode='42501'; end if;
end $$;
revoke all on function touch_session_atomic(uuid) from public,anon,service_role;
grant execute on function touch_session_atomic(uuid) to authenticated;

create or replace function close_session_atomic(p_session_id uuid,p_user_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s clinical_sessions%rowtype; c conversations%rowtype; stamp timestamptz:=now();
begin
 if current_setting('role',true)<>'service_role' and (auth.uid() is null or auth.uid()<>p_user_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_reason is null or p_reason not in ('user_request','time_limit','crisis_detected','inactivity') then raise exception 'Invalid closure reason' using errcode='23514'; end if;
 select * into s from clinical_sessions where id=p_session_id and user_id=p_user_id for update;
 if not found then raise exception 'Session not found' using errcode='42501'; end if;
 select * into c from conversations where id=s.conversation_id and user_id=s.user_id for update;
 if not found then raise exception 'Conversation ownership mismatch' using errcode='23514'; end if;
 if s.status<>'closed' then
  if s.status<>'open' or c.status<>'active' then raise exception 'Invalid closure transition' using errcode='23514'; end if;
  update clinical_sessions set status='closed',closed_at=stamp,closure_reason=p_reason where id=s.id;
  update conversations set status='closed',ended_at=stamp where id=c.id;
 end if;
 insert into assessment_jobs(session_id) values(s.id) on conflict do nothing;
end $$;
revoke all on function close_session_atomic(uuid,uuid,text) from public,anon;
grant execute on function close_session_atomic(uuid,uuid,text) to authenticated,service_role;

-- Server-only operations are invokers with narrowly granted EXECUTE. Their
-- explicit owner is checked against locked parents even under service_role.
create function create_questionnaire_atomic(p_session_id uuid,p_user_id uuid,p_conversation_id uuid,p_code text,p_reason text,p_request_id text default null,p_token uuid default null)
returns questionnaire_instances language plpgsql set search_path=public,pg_temp as $$
declare s clinical_sessions%rowtype; q questionnaire_definitions%rowtype; i questionnaire_instances%rowtype;
begin
 select * into s from clinical_sessions where id=p_session_id and user_id=p_user_id and conversation_id=p_conversation_id for update;
 if not found or s.status<>'open' then raise exception 'Open owned session required' using errcode='42501'; end if;
 if p_request_id is not null and not exists(select 1 from chat_turns where session_id=s.id and request_id=p_request_id and token=p_token and status='generating' and lease_until>now()) then raise exception 'Stale turn owner' using errcode='42501'; end if;
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
revoke all on function create_questionnaire_atomic(uuid,uuid,uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function create_questionnaire_atomic(uuid,uuid,uuid,text,text,text,uuid) to service_role;

create function start_questionnaire_atomic(p_instance_id uuid,p_user_id uuid) returns void language plpgsql set search_path=public,pg_temp as $$
declare i questionnaire_instances%rowtype;
begin
 select * into i from questionnaire_instances where id=p_instance_id and user_id=p_user_id for update;
 if not found or not exists(select 1 from clinical_sessions where id=i.session_id and user_id=i.user_id and conversation_id=i.conversation_id and status='open') then raise exception 'Open owned parent required' using errcode='42501'; end if;
 if i.status='proposed' then update questionnaire_instances set status='in_progress',started_at=now() where id=i.id;
 elsif i.status<>'in_progress' then raise exception 'Questionnaire closed' using errcode='23514'; end if;
end $$;
revoke all on function start_questionnaire_atomic(uuid,uuid) from public,anon,authenticated;
grant execute on function start_questionnaire_atomic(uuid,uuid) to service_role;

create function submit_questionnaire_atomic(p_instance_id uuid,p_user_id uuid,p_answers jsonb,p_result jsonb,p_risk_severity text default null)
returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare i questionnaire_instances%rowtype; s clinical_sessions%rowtype; answer_doc jsonb; item questionnaire_items%rowtype; code text; n integer;
begin
 select cs.* into s from clinical_sessions cs join questionnaire_instances qi on qi.session_id=cs.id where qi.id=p_instance_id and qi.user_id=p_user_id and cs.user_id=p_user_id and cs.conversation_id=qi.conversation_id for update of cs;
 if not found then raise exception 'Owned parent required' using errcode='42501'; end if;
 select * into i from questionnaire_instances where id=p_instance_id and user_id=p_user_id for update;
 if i.status='scored' then
  if i.submission_json is distinct from p_answers then raise exception 'Conflicting retry' using errcode='23514'; end if;
  return jsonb_build_object('replayed',true);
 end if;
 if s.status<>'open' or i.status not in ('proposed','in_progress') then raise exception 'Questionnaire closed' using errcode='23514'; end if;
 if jsonb_typeof(p_answers) is distinct from 'array' or jsonb_typeof(p_result) is distinct from 'object' then raise exception 'Invalid submission' using errcode='23514'; end if;
 select count(*) into n from questionnaire_items where questionnaire_id=i.questionnaire_id;
 if jsonb_array_length(p_answers)<>n or (select count(distinct (value->>'itemOrder')::integer) from jsonb_array_elements(p_answers))<>n then raise exception 'Incomplete or duplicate answers' using errcode='23514'; end if;
 select q.code into code from questionnaire_definitions q where q.id=i.questionnaire_id;
 for answer_doc in select value from jsonb_array_elements(p_answers) loop
  select * into item from questionnaire_items where questionnaire_id=i.questionnaire_id and order_index=(answer_doc->>'itemOrder')::integer;
  if not found or not exists(select 1 from jsonb_array_elements(item.options_json) o where o->>'value'=answer_doc->>'valueNumeric' and answer_doc->>'valueRaw' in (o->>'value',o->>'label')) then raise exception 'Invalid option/raw value' using errcode='23514'; end if;
 end loop;
 if code='CSSRS' and (
  (exists(select 1 from jsonb_array_elements(p_answers) a where a->>'itemOrder'='2' and a->>'valueNumeric'='0') and exists(select 1 from jsonb_array_elements(p_answers) a where (a->>'itemOrder')::integer in (3,4,5) and a->>'valueNumeric'<>'0')) or
  (exists(select 1 from jsonb_array_elements(p_answers) a where a->>'itemOrder'='6' and a->>'valueNumeric'='0') and exists(select 1 from jsonb_array_elements(p_answers) a where a->>'itemOrder'='7' and a->>'valueNumeric'<>'0'))
 ) then raise exception 'Invalid CSSRS branch' using errcode='23514'; end if;
 insert into questionnaire_answers(instance_id,item_id,answer_raw,answer_numeric)
 select i.id,t.id,a->>'valueRaw',(a->>'valueNumeric')::integer from jsonb_array_elements(p_answers) a join questionnaire_items t on t.questionnaire_id=i.questionnaire_id and t.order_index=(a->>'itemOrder')::integer;
 insert into questionnaire_results(instance_id,total_score,severity_band,subscores_json,flags_json,requires_review)
 values(i.id,(p_result->>'totalScore')::integer,p_result->>'severityBand',p_result->'subscores',p_result->'flags',(p_result->>'requiresReview')::boolean);
 update questionnaire_instances set status='scored',submitted_at=now(),scored_at=now(),submission_json=p_answers where id=i.id;
 if p_risk_severity is not null then
  if p_risk_severity not in ('high','critical') then raise exception 'Invalid risk severity' using errcode='23514'; end if;
  insert into risk_events(user_id,session_id,conversation_id,risk_type,severity,source_type,payload_json)
  values(i.user_id,i.session_id,i.conversation_id,'suicidal_ideation',p_risk_severity::risk_severity,'questionnaire',jsonb_build_object('questionnaire_code',code,'instance_id',i.id,'flags',p_result->'flags','total_score',p_result->'totalScore','severity_band',p_result->'severityBand'));
 end if;
 return jsonb_build_object('replayed',false);
end $$;
revoke all on function submit_questionnaire_atomic(uuid,uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function submit_questionnaire_atomic(uuid,uuid,jsonb,jsonb,text) to service_role;

create function begin_chat_turn(p_session_id uuid,p_user_id uuid,p_request_id text,p_text text,p_crisis boolean default false,p_urgent boolean default false)
returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare s clinical_sessions%rowtype; t chat_turns%rowtype; mid uuid; prev text; urgent boolean:=false;
begin
 select * into s from clinical_sessions where id=p_session_id and user_id=p_user_id for update;
 if not found then raise exception 'Owned session required' using errcode='42501'; end if;
 select * into t from chat_turns where session_id=s.id and request_id=p_request_id for update;
 if found then
  if t.text<>p_text then raise exception 'Conflicting request ID' using errcode='23514'; end if;
  if t.status='completed' then return jsonb_build_object('replay',true,'chunks',t.response_chunks); end if;
  if t.status='interrupted' then raise exception 'Turn interrupted by urgent signal' using errcode='23514'; end if;
  if t.status='generating' and t.lease_until>now() then raise exception 'turn_in_progress' using errcode='55P03'; end if;
  if t.attempts>=3 then raise exception 'turn_attempts_exhausted' using errcode='23514'; end if;
 else
  if s.status<>'open' then raise exception 'Session closed' using errcode='23514'; end if;
 end if;
 if exists(select 1 from chat_turns where session_id=s.id and request_id<>p_request_id and status in ('generating','failed')) then
  if not p_crisis or not p_urgent or t.request_id is not null then raise exception 'Resolve previous turn first' using errcode='55P03'; end if;
  -- A fresh, specific safety signal may interrupt an unresolved turn. Fence
  -- its owner and answer deterministically; never start a second LLM call.
  update chat_turns set status='interrupted',token=gen_random_uuid(),lease_until=now(),error_code='urgent_signal' where session_id=s.id and status in ('generating','failed');
  urgent=true;
 end if;
 if t.request_id is null then
  if (select count(*) from chat_turns where session_id=s.id)>=80 then
   if not p_crisis or not p_urgent then raise exception 'turn_limit' using errcode='23514'; end if;
   urgent=true;
  end if;
  select request_id into prev from chat_turns where session_id=s.id order by created_at desc limit 1;
  insert into messages(conversation_id,session_id,role,parts) values(s.conversation_id,s.id,'user',jsonb_build_array(jsonb_build_object('type','text','text',p_text))) returning id into mid;
  insert into chat_turns(session_id,request_id,user_id,text,user_message_id,previous_request_id,status,lease_until,urgent_response) values(s.id,p_request_id,p_user_id,p_text,mid,prev,'generating',now()+interval '2 minutes',urgent) returning * into t;
  if p_crisis then
   insert into risk_events(user_id,session_id,conversation_id,risk_type,severity,source_type,payload_json) values(s.user_id,s.id,s.conversation_id,'suicidal_ideation','high','conversation',jsonb_build_object('request_id',p_request_id,'signal','textual_crisis'));
  end if;
 else
  update chat_turns set status='generating',token=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1,error_code=null where session_id=s.id and request_id=p_request_id returning * into t;
 end if;
 update clinical_sessions set last_activity_at=now() where id=s.id;
 return jsonb_build_object('replay',false,'token',t.token,'userMessageId',t.user_message_id,'urgent',t.urgent_response);
end $$;
revoke all on function begin_chat_turn(uuid,uuid,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function begin_chat_turn(uuid,uuid,text,text,boolean,boolean) to service_role;

create function finish_chat_turn(p_session_id uuid,p_request_id text,p_token uuid,p_parts jsonb,p_chunks jsonb,p_proposal text default null,p_close_reason text default null)
returns void language plpgsql set search_path=public,pg_temp as $$
declare t chat_turns%rowtype; s clinical_sessions%rowtype;
begin
 select * into s from clinical_sessions where id=p_session_id for update;
 select * into t from chat_turns where session_id=s.id and request_id=p_request_id and token=p_token for update;
 if not found then raise exception 'Stale turn owner' using errcode='42501'; end if;
 if t.status='completed' then return; end if;
 if t.status<>'generating' or t.lease_until<now() then raise exception 'Expired turn' using errcode='42501'; end if;
 if p_close_reason is not null then
  if not (p_close_reason='time_limit' and s.opened_at<=now()-interval '1 hour') and not close_chat_turn(s.id,t.request_id,t.token,p_close_reason) then raise exception 'Closure not authorized' using errcode='42501'; end if;
  perform close_session_atomic(s.id,t.user_id,p_close_reason);
 end if;
 if jsonb_typeof(p_parts) is distinct from 'array' or jsonb_array_length(p_parts)=0 or jsonb_typeof(p_chunks) is distinct from 'array' then raise exception 'Empty response' using errcode='23514'; end if;
 insert into messages(conversation_id,session_id,role,parts) values(s.conversation_id,s.id,'assistant',p_parts);
 update chat_turns set status='completed',response_parts=p_parts,response_chunks=p_chunks,error_code=null where session_id=s.id and request_id=t.request_id;
 delete from session_close_proposals where session_id=s.id;
 if p_proposal is not null and p_close_reason is null and s.status='open' then insert into session_close_proposals values(s.id,t.request_id,p_proposal); end if;
end $$;
revoke all on function finish_chat_turn(uuid,text,uuid,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function finish_chat_turn(uuid,text,uuid,jsonb,jsonb,text,text) to service_role;

create function fail_chat_turn(p_session_id uuid,p_request_id text,p_token uuid,p_error text) returns void language sql set search_path=public,pg_temp as $$
 update chat_turns set status='failed',error_code=p_error where session_id=p_session_id and request_id=p_request_id and token=p_token and status='generating';
$$;
revoke all on function fail_chat_turn(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function fail_chat_turn(uuid,text,uuid,text) to service_role;

-- Narrow recovery projection, never operational table SELECT for patients.
create function get_chat_turn_recovery(p_session_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t chat_turns%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from clinical_sessions where id=p_session_id and user_id=auth.uid()) then raise exception 'Owned session required' using errcode='42501'; end if;
 select * into t from chat_turns where session_id=p_session_id and user_id=auth.uid() and status in ('generating','failed') order by created_at desc limit 1;
 if not found then return null; end if;
 return jsonb_build_object('requestId',t.request_id,'text',t.text,'status',t.status,'canRetry',t.attempts<3 and (t.status='failed' or t.lease_until<=now()),'leaseUntil',t.lease_until);
end $$;
revoke all on function get_chat_turn_recovery(uuid) from public,anon,service_role;
grant execute on function get_chat_turn_recovery(uuid) to authenticated;

create function close_chat_turn(p_session_id uuid,p_request_id text,p_token uuid,p_reason text)
returns boolean language plpgsql set search_path=public,pg_temp as $$
declare s clinical_sessions%rowtype; t chat_turns%rowtype; proposal session_close_proposals%rowtype;
begin
 select * into s from clinical_sessions where id=p_session_id for update;
 select * into t from chat_turns where session_id=s.id and request_id=p_request_id and token=p_token and status='generating' and lease_until>now() for update;
 if not found then raise exception 'Stale turn owner' using errcode='42501'; end if;
 if p_reason in ('user_request','time_limit') then
  select * into proposal from session_close_proposals where session_id=s.id and request_id=t.previous_request_id and reason=p_reason;
  if not found or trim(t.text) !~* '^(s[ií](,?\s+(cerramos|quiero cerrar( la sesi[oó]n)?))?|de acuerdo|vale|acepto|cerramos|quiero cerrar( la sesi[oó]n)?)[.!\s]*$' then return false; end if;
 elsif p_reason='crisis_detected' then
  if not exists(select 1 from risk_events where session_id=s.id and ((payload_json->>'request_id'=t.request_id and payload_json->>'signal'='textual_crisis') or (source_type='questionnaire' and severity='critical'))) then return false; end if;
 else return false;
 end if;
 return true;
end $$;
revoke all on function close_chat_turn(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function close_chat_turn(uuid,text,uuid,text) to service_role;

create function recover_assessment_jobs(p_limit integer default 10) returns integer language plpgsql set search_path=public,pg_temp as $$
declare n integer;
begin
 insert into assessment_jobs(session_id)
 select s.id from clinical_sessions s where s.status='closed' and not exists(select 1 from assessments a where a.session_id=s.id and a.assessment_type='closure') and not exists(select 1 from assessment_jobs j where j.session_id=s.id) order by s.closed_at limit least(greatest(p_limit,1),20) on conflict do nothing;
 get diagnostics n=row_count; return n;
end $$;
revoke all on function recover_assessment_jobs(integer) from public,anon,authenticated;
grant execute on function recover_assessment_jobs(integer) to service_role;

create function claim_assessment_jobs(p_limit integer default 10,p_session_id uuid default null) returns setof assessment_jobs language plpgsql set search_path=public,pg_temp as $$
declare slots integer;
begin
 -- Global capacity protects cost across overlapping cron/manual dispatches,
 -- not just within a single process. Expired leases free their slots.
 perform pg_advisory_xact_lock(hashtext('serenia_assessment_job_capacity'));
 select greatest(0,2-count(*)) into slots from assessment_jobs where status in ('enqueued','running') and lease_until>now();
 if slots=0 then return; end if;
 return query with candidates as (
  select j.session_id from assessment_jobs j join clinical_sessions s on s.id=j.session_id
  where s.status='closed' and (p_session_id is null or j.session_id=p_session_id) and j.attempts<5 and j.available_at<=now()
   and (j.status='pending' or (j.status in ('enqueued','running') and j.lease_until<now()))
   and not exists(select 1 from assessments a where a.session_id=s.id and a.assessment_type='closure' and a.status not in ('superseded','rejected'))
  order by j.available_at limit least(greatest(p_limit,1),10,slots) for update of j skip locked
 ) update assessment_jobs j set status='enqueued',token=gen_random_uuid(),lease_until=now()+interval '10 minutes',attempts=j.attempts+1,updated_at=now()
 from candidates c where j.session_id=c.session_id returning j.*;
end $$;
revoke all on function claim_assessment_jobs(integer,uuid) from public,anon,authenticated;
grant execute on function claim_assessment_jobs(integer,uuid) to service_role;

create function update_assessment_job(p_session_id uuid,p_token uuid,p_action text,p_run_id text default null) returns boolean language plpgsql set search_path=public,pg_temp as $$
declare j assessment_jobs%rowtype;
begin
 select * into j from assessment_jobs where session_id=p_session_id and token=p_token for update;
 if not found then return false; end if;
 if p_action='start' then
  if j.status<>'enqueued' or j.lease_until<now() then return false; end if;
  update assessment_jobs set status='running',lease_until=now()+interval '30 minutes',updated_at=now() where session_id=j.session_id;
 elsif p_action='enqueued' then
  update assessment_jobs set run_id=p_run_id,updated_at=now() where session_id=j.session_id;
 elsif p_action='failed' then
  update assessment_jobs set status=case when attempts>=5 then 'exhausted' else 'pending' end,available_at=now()+interval '5 minutes',lease_until=null,last_error='enqueue_failed',updated_at=now() where session_id=j.session_id;
 elsif p_action='completed' then
  update assessment_jobs set status='completed',lease_until=null,updated_at=now() where session_id=j.session_id;
 elsif p_action='check' then return j.status='running' and j.lease_until>now();
 else raise exception 'Invalid job action' using errcode='23514';
 end if;
 return true;
end $$;
revoke all on function update_assessment_job(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function update_assessment_job(uuid,uuid,text,text) to service_role;

-- Fence the last write, not only generation: durable retries may resume
-- after a lease has expired or a clinician has requested regeneration.
create function finish_assessment_job(p_session_id uuid,p_token uuid,p_status text,p_summary jsonb)
returns boolean language plpgsql set search_path=public,pg_temp as $$
declare s clinical_sessions%rowtype; j assessment_jobs%rowtype;
begin
 select * into s from clinical_sessions where id=p_session_id and status='closed' for update;
 if not found or not exists(select 1 from conversations where id=s.conversation_id and user_id=s.user_id and status='closed') then raise exception 'Closed owned parent required' using errcode='42501'; end if;
 select * into j from assessment_jobs where session_id=s.id and token=p_token for update;
 if not found then return false; end if;
 if j.status='completed' then return true; end if;
 if j.status<>'running' or j.lease_until<=now() then return false; end if;
 if p_status not in ('draft_ai','requires_manual_review') or p_status is null or jsonb_typeof(p_summary) is distinct from 'object' then raise exception 'Invalid generated result' using errcode='23514'; end if;
 -- An existing result, including a clinician rejection, is authoritative.
 -- Superseded rows are the explicit regeneration context, never overwritten.
 if not exists(select 1 from assessments where session_id=s.id and assessment_type='closure' and status<>'superseded') then
  insert into assessments(user_id,session_id,assessment_type,status,generated_by,summary_json)
  values(s.user_id,s.id,'closure',p_status::assessment_status,'ai',p_summary);
 end if;
 update assessment_jobs set status='completed',lease_until=null,updated_at=now() where session_id=s.id;
 return true;
end $$;
revoke all on function finish_assessment_job(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function finish_assessment_job(uuid,uuid,text,jsonb) to service_role;

-- A regeneration claim and its clinical context commit together. Preserve
-- the Task 1 API and conditional restore; restore also cancels its pending job.
create or replace function regenerate_assessment_atomic(p_assessment_id uuid,p_expected_status text,p_restore boolean default false)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare a assessments%rowtype; sid uuid;
begin
 if auth.uid() is null or not is_clinician() then raise exception 'Clinician required' using errcode='42501'; end if;
 if p_expected_status is null or p_expected_status not in ('rejected','requires_manual_review') then raise exception 'Invalid regeneration status' using errcode='23514'; end if;
 select session_id into sid from assessments where id=p_assessment_id;
 perform 1 from clinical_sessions where id=sid and status='closed' for update;
 if not found then raise exception 'Closed session required' using errcode='23514'; end if;
 select * into a from assessments where id=p_assessment_id and assessment_type='closure' for update;
 if not found then raise exception 'Closure assessment required' using errcode='23514'; end if;
 if exists(select 1 from assessments where session_id=sid and assessment_type='closure' and id<>a.id and status not in ('superseded','rejected')) then return false; end if;
 if p_restore then
  if a.status<>'superseded' or a.regeneration_previous_status::text is distinct from p_expected_status or exists(select 1 from assessment_jobs where session_id=sid and status in ('enqueued','running')) then return false; end if;
  update assessments set status=regeneration_previous_status,regeneration_previous_status=null where id=a.id;
  delete from assessment_jobs where session_id=sid and status='pending';
 else
  if a.status::text<>p_expected_status then return false; end if;
  update assessments set regeneration_previous_status=status,status='superseded' where id=a.id;
  insert into assessment_jobs(session_id,context_json) values(sid,jsonb_build_object('rejectionReason',coalesce(a.rejection_reason,'Regeneración de informe que requiere revisión manual'),'clinicalNotes',a.clinical_notes))
  on conflict(session_id) do update set context_json=excluded.context_json,status='pending',token=null,attempts=0,run_id=null,last_error=null,lease_until=null,available_at=now(),updated_at=now();
 end if;
 return true;
end $$;
revoke all on function regenerate_assessment_atomic(uuid,text,boolean) from public,anon,service_role;
grant execute on function regenerate_assessment_atomic(uuid,text,boolean) to authenticated;
