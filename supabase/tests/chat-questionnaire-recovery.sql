-- All fixtures are synthetic. SQL actor claims are a shim, not JWT proof.
begin;
create function pg_temp.expect_failure(sql text) returns void language plpgsql as $$
begin
 begin execute sql;
 exception when insufficient_privilege or check_violation or lock_not_available then return;
 end;
 raise exception 'REGRESSION: accepted %',sql;
end $$;
insert into conversations(id,user_id) values('10000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001');
insert into clinical_sessions(id,user_id,conversation_id) values('20000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000012');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select pg_temp.expect_failure('select * from chat_turns');
select pg_temp.expect_failure('select * from assessment_jobs');
select pg_temp.expect_failure($q$select begin_chat_turn('20000000-0000-0000-0000-000000000012',auth.uid(),'forge','text',false)$q$);
select pg_temp.expect_failure($q$select submit_questionnaire_atomic(gen_random_uuid(),auth.uid(),'[]','{}',null)$q$);
select pg_temp.expect_failure($q$select create_session_atomic('00000000-0000-0000-0000-000000000002')$q$);
select touch_session_atomic('20000000-0000-0000-0000-000000000012');
select pg_temp.expect_failure($q$select get_chat_turn_recovery('20000000-0000-0000-0000-000000000002')$q$);
do $$ begin if get_chat_turn_recovery('20000000-0000-0000-0000-000000000012') is not null then raise exception 'Invented recovery state'; end if; end $$;
set local role service_role;
do $$ declare qi questionnaire_instances%rowtype; ci questionnaire_instances%rowtype; answers jsonb; result jsonb; claim jsonb; tok uuid; next_claim jsonb; jobs integer;
begin
 select * into qi from create_questionnaire_atomic('20000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000012','PHQ9','Synthetic regression');
 select jsonb_agg(jsonb_build_object('itemOrder',order_index,'valueNumeric',0,'valueRaw','0') order by order_index) into answers from questionnaire_items where questionnaire_id=qi.questionnaire_id;
 result='{"totalScore":0,"severityBand":"minimal","subscores":{},"flags":[],"requiresReview":false}';
 perform pg_temp.expect_failure(format('select submit_questionnaire_atomic(%L,%L,%L,%L,null)',qi.id,qi.user_id,'[]',result));
 if exists(select 1 from questionnaire_answers where instance_id=qi.id) then raise exception 'Partial answers committed'; end if;
 perform pg_temp.expect_failure(format('select submit_questionnaire_atomic(%L,%L,%L,%L,null)',qi.id,qi.user_id,jsonb_set(answers,'{0,valueRaw}','"3"'),result));
 -- Failure after answers/result/state writes must roll all of them back.
 perform pg_temp.expect_failure(format('select submit_questionnaire_atomic(%L,%L,%L,%L,%L)',qi.id,qi.user_id,answers,result,'invalid'));
 if exists(select 1 from questionnaire_answers where instance_id=qi.id) or exists(select 1 from questionnaire_results where instance_id=qi.id) or (select status from questionnaire_instances where id=qi.id)<>'proposed' then raise exception 'Atomic scoring rollback failed'; end if;
 perform submit_questionnaire_atomic(qi.id,qi.user_id,answers,result,null);
 perform submit_questionnaire_atomic(qi.id,qi.user_id,answers,result,null);
 if (select count(*) from questionnaire_answers where instance_id=qi.id)<>9 or (select count(*) from questionnaire_results where instance_id=qi.id)<>1 then raise exception 'Retry duplicates'; end if;
 perform pg_temp.expect_failure(format('select submit_questionnaire_atomic(%L,%L,%L,%L,null)',qi.id,qi.user_id,jsonb_set(answers,'{0,valueNumeric}','1'),result));
 -- A scored primary must not block CSSRS; safety replaces a pending primary.
 select * into ci from create_questionnaire_atomic(qi.session_id,qi.user_id,qi.conversation_id,'GAD7','Synthetic followup');
 select * into qi from create_questionnaire_atomic(qi.session_id,qi.user_id,qi.conversation_id,'CSSRS','Synthetic safety priority');
 if (select status from questionnaire_instances where id=ci.id)<>'cancelled' then raise exception 'CSSRS did not take priority'; end if;
 select jsonb_agg(jsonb_build_object('itemOrder',order_index,'valueNumeric',0,'valueRaw','No') order by order_index) into answers from questionnaire_items where questionnaire_id=qi.questionnaire_id;
 result='{"totalScore":0,"severityBand":"negative","subscores":{},"flags":[],"requiresReview":false}';
 perform pg_temp.expect_failure(format('select submit_questionnaire_atomic(%L,%L,%L,%L,null)',qi.id,qi.user_id,jsonb_set(jsonb_set(answers,'{6,valueNumeric}','1'),'{6,valueRaw}','"Sí"'),result));
 perform submit_questionnaire_atomic(qi.id,qi.user_id,answers,result,null);

 claim=begin_chat_turn(qi.session_id,qi.user_id,'one','Quiero matarme esta noche',true); tok=(claim->>'token')::uuid;
 perform pg_temp.expect_failure(format('select begin_chat_turn(%L,%L,%L,%L,false)',qi.session_id,qi.user_id,'one','Quiero matarme esta noche'));
 if close_chat_turn(qi.session_id,'one',tok,'user_request') then raise exception 'Closed without proposal'; end if;
 perform finish_chat_turn(qi.session_id,'one',tok,'[{"type":"text","text":"¿Quieres cerrar?"}]','[]','user_request');
 next_claim=begin_chat_turn(qi.session_id,qi.user_id,'two','No',false);
 if close_chat_turn(qi.session_id,'two',(next_claim->>'token')::uuid,'user_request') then raise exception 'Closed without consent'; end if;
 perform finish_chat_turn(qi.session_id,'two',(next_claim->>'token')::uuid,'[{"type":"text","text":"Continuamos"}]','[]');
 next_claim=begin_chat_turn(qi.session_id,qi.user_id,'three','Sí',false);
 if close_chat_turn(qi.session_id,'three',(next_claim->>'token')::uuid,'user_request') then raise exception 'Old proposal reused'; end if;
 perform finish_chat_turn(qi.session_id,'three',(next_claim->>'token')::uuid,'[{"type":"text","text":"¿Quieres cerrar?"}]','[]','time_limit');
 next_claim=begin_chat_turn(qi.session_id,qi.user_id,'four','Sí',false); tok=(next_claim->>'token')::uuid;
 if close_chat_turn(qi.session_id,'four',tok,'user_request') then raise exception 'Changed proposal reason accepted'; end if;
 if not close_chat_turn(qi.session_id,'four',tok,'time_limit') then raise exception 'Explicit consent rejected'; end if;
 -- Check tool only authorizes; assistant + closure + outbox commit together.
 if (select status from clinical_sessions where id=qi.session_id)<>'open' then raise exception 'Tool committed premature close'; end if;
 perform pg_temp.expect_failure(format('select finish_chat_turn(%L,%L,%L,%L,%L,null,%L)',qi.session_id,'four',tok,'[]','[]','time_limit'));
 if (select status from clinical_sessions where id=qi.session_id)<>'open' or exists(select 1 from assessment_jobs where session_id=qi.session_id) then raise exception 'Failed assistant persistence committed closure/outbox'; end if;
 perform finish_chat_turn(qi.session_id,'four',tok,'[{"type":"text","text":"Cierre"}]','[]',null,'time_limit');
 if (select status from clinical_sessions where id=qi.session_id)<>'closed' or (select status from conversations where id=qi.conversation_id)<>'closed' then raise exception 'Atomic close diverged'; end if;
 if not (begin_chat_turn(qi.session_id,qi.user_id,'four','Sí',false)->>'replay')::boolean then raise exception 'Completed turn not replayed'; end if;
 if (select count(*) from messages where session_id=qi.session_id and role='user')<>4 or (select count(*) from risk_events where session_id=qi.session_id and source_type='conversation')<>1 then raise exception 'Duplicate messages/risk'; end if;
 select count(*) into jobs from claim_assessment_jobs(10,qi.session_id);
 if jobs<>1 then raise exception 'Missing durable job'; end if;
 select count(*) into jobs from claim_assessment_jobs(10,qi.session_id);
 if jobs<>0 then raise exception 'Duplicate job claim'; end if;
end $$;

-- A stale owner cannot finalize a retried turn. New turns cannot overtake
-- an unresolved failure, preserving the conversation sequence.
reset role;
insert into conversations(id,user_id) values('10000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000002');
insert into clinical_sessions(id,user_id,conversation_id,opened_at) values('20000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000013',now()-interval '61 minutes');
set local role service_role;
do $$ declare first jsonb; retry jsonb; sid uuid:='20000000-0000-0000-0000-000000000013'; uid uuid:='00000000-0000-0000-0000-000000000002'; token uuid;
begin
 first=begin_chat_turn(sid,uid,'last','Quiero matarme esta noche',true);
 token=(first->>'token')::uuid;
 perform fail_chat_turn(sid,'last',token,'persist_failed');
 perform pg_temp.expect_failure(format('select begin_chat_turn(%L,%L,%L,%L,false)',sid,uid,'new','different'));
 retry=begin_chat_turn(sid,uid,'last','Quiero matarme esta noche',true);
 perform pg_temp.expect_failure(format('select finish_chat_turn(%L,%L,%L,%L,%L)',sid,'last',token,'[{"type":"text","text":"stale"}]','[]'));
 perform finish_chat_turn(sid,'last',(retry->>'token')::uuid,'[{"type":"text","text":"Línea 024"}]','[]',null,'crisis_detected');
 if (select closure_reason from clinical_sessions where id=sid)<>'crisis_detected' or (select count(*) from messages where session_id=sid and role='user')<>1 then raise exception 'Expired crisis/retry lost'; end if;
 -- Simulate enqueue failure; durable context survives release and next claim.
 select j.token into token from claim_assessment_jobs(1,sid) j;
 perform update_assessment_job(sid,token,'failed');
 update assessment_jobs set available_at=now() where session_id=sid;
 if (select count(*) from claim_assessment_jobs(1,sid))<>1 then raise exception 'Failed enqueue not recovered'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
-- Completed recovery is null; it must never reveal another patient's turn.
do $$ begin if get_chat_turn_recovery('20000000-0000-0000-0000-000000000013') is not null then raise exception 'Completed turn exposed as recovery'; end if; end $$;
select pg_temp.expect_failure($q$select get_chat_turn_recovery('20000000-0000-0000-0000-000000000012')$q$);
reset role;

-- A specific new crisis can preempt a live/failed lease without a second LLM.
-- Its deterministic mode survives persistence failure and restart/retry.
insert into conversations(id,user_id) values('10000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000001');
insert into clinical_sessions(id,user_id,conversation_id) values('20000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000014');
set local role service_role;
do $$ declare first jsonb; urgent jsonb; retry jsonb; sid uuid:='20000000-0000-0000-0000-000000000014'; uid uuid:='00000000-0000-0000-0000-000000000001'; token uuid;
begin
 first=begin_chat_turn(sid,uid,'waiting','Hola',false);
 token=(first->>'token')::uuid;
 urgent=begin_chat_turn(sid,uid,'urgent','Quiero matarme esta noche',true,true);
 if not (urgent->>'urgent')::boolean then raise exception 'Urgent turn not deterministic'; end if;
 if (select status from chat_turns where session_id=sid and request_id='waiting')<>'interrupted' then raise exception 'Previous lease not interrupted'; end if;
 perform pg_temp.expect_failure(format('select finish_chat_turn(%L,%L,%L,%L,%L)',sid,'waiting',token,'[{"type":"text","text":"stale"}]','[]'));
 perform pg_temp.expect_failure(format('select create_questionnaire_atomic(%L,%L,%L,%L,%L,%L,%L)',sid,uid,'10000000-0000-0000-0000-000000000014','PHQ9','Stale tool','waiting',token));
 perform pg_temp.expect_failure(format('select close_chat_turn(%L,%L,%L,%L)',sid,'waiting',token,'crisis_detected'));
 perform fail_chat_turn(sid,'waiting',token,'late_failure');
 if (select status from chat_turns where session_id=sid and request_id='waiting')<>'interrupted' then raise exception 'Stale failure revived interrupted turn'; end if;
 perform pg_temp.expect_failure(format('select begin_chat_turn(%L,%L,%L,%L,false)',sid,uid,'waiting','Hola'));
 perform fail_chat_turn(sid,'urgent',(urgent->>'token')::uuid,'persist_failed');
 retry=begin_chat_turn(sid,uid,'urgent','Quiero matarme esta noche',true,true);
 if not (retry->>'urgent')::boolean then raise exception 'Urgent retry lost deterministic mode'; end if;
 perform finish_chat_turn(sid,'urgent',(retry->>'token')::uuid,'[{"type":"text","text":"Línea 024"}]','[]');
 if not (begin_chat_turn(sid,uid,'urgent','Quiero matarme esta noche',true,true)->>'replay')::boolean then raise exception 'Urgent replay missing'; end if;
 if (select count(*) from risk_events where session_id=sid)<>1 or (select count(*) from messages where session_id=sid and role='user')<>2 or (select count(*) from messages where session_id=sid and role='assistant')<>1 then raise exception 'Urgent retry duplicated writes'; end if;
 if (select status from clinical_sessions where id=sid)<>'open' then raise exception 'Urgent interruption imposed new closure criteria'; end if;
end $$;
reset role;

-- The ordinary turn cap must not suppress a fresh explicit safety signal.
set local role service_role;
do $$ declare sid uuid:='20000000-0000-0000-0000-000000000014'; uid uuid:='00000000-0000-0000-0000-000000000001'; claim jsonb;
begin
 for n in 3..80 loop
  claim=begin_chat_turn(sid,uid,'cap-'||n,'Synthetic turn',false);
  perform finish_chat_turn(sid,'cap-'||n,(claim->>'token')::uuid,'[{"type":"text","text":"Synthetic reply"}]','[]');
 end loop;
 perform pg_temp.expect_failure(format('select begin_chat_turn(%L,%L,%L,%L,false)',sid,uid,'over','ordinary'));
 claim=begin_chat_turn(sid,uid,'safety-over-cap','Quiero matarme esta noche',true,true);
 if not (claim->>'urgent')::boolean then raise exception 'Turn cap allowed another LLM'; end if;
 perform finish_chat_turn(sid,'safety-over-cap',(claim->>'token')::uuid,'[{"type":"text","text":"Línea 024"}]','[]');
 if (select count(*) from risk_events where session_id=sid)<>2 then raise exception 'Turn cap suppressed safety signal'; end if;
end $$;
reset role;

-- Owner-only recovery exposes just the unresolved request and retry window.
set local role service_role;
select begin_chat_turn('20000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000001','recover-urgent','Voy a matarme',true,true);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$ declare r jsonb; begin
 r=get_chat_turn_recovery('20000000-0000-0000-0000-000000000014');
 if r->>'requestId'<>'recover-urgent' or r->>'text'<>'Voy a matarme' or r->>'status'<>'generating' or (r->>'canRetry')::boolean then raise exception 'Live recovery contract incorrect'; end if;
end $$;
set local role service_role;
select fail_chat_turn('20000000-0000-0000-0000-000000000014','recover-urgent',(select token from chat_turns where request_id='recover-urgent'),'synthetic failure');
set local role authenticated;
do $$ declare r jsonb; begin
 r=get_chat_turn_recovery('20000000-0000-0000-0000-000000000014');
 if r->>'status'<>'failed' or not (r->>'canRetry')::boolean then raise exception 'Failed recovery contract incorrect'; end if;
end $$;
set local role service_role;
update chat_turns set attempts=3 where request_id='recover-urgent';
set local role authenticated;
do $$ begin
 if (get_chat_turn_recovery('20000000-0000-0000-0000-000000000014')->>'canRetry')::boolean then raise exception 'Exhausted recovery retryable'; end if;
end $$;
reset role;

-- Recovery adds only closed sessions missing any assessment; idempotent,
-- bounded, and it does not automatically regenerate rejected reports.
delete from assessment_jobs where session_id='20000000-0000-0000-0000-000000000013';
set local role service_role;
select recover_assessment_jobs(1);
do $$ begin
 if not exists(select 1 from assessment_jobs where session_id='20000000-0000-0000-0000-000000000013') then raise exception 'Closed missing assessment not recovered'; end if;
end $$;
reset role;

-- Regeneration atomically stores both supersession and the original reason /
-- clinician notes, including a crash before any Workflow dispatch.
insert into assessments(id,user_id,session_id,assessment_type,status,summary_json,rejection_reason,clinical_notes) values
 ('30000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000013','closure','rejected','{}','Synthetic rejection','Synthetic notes');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select regenerate_assessment_atomic('30000000-0000-0000-0000-000000000013','rejected');
reset role;
set local role service_role;
do $$ declare j assessment_jobs%rowtype; old_token uuid; begin
 select * into j from claim_assessment_jobs(1,'20000000-0000-0000-0000-000000000013');
 if j.context_json is distinct from '{"rejectionReason":"Synthetic rejection","clinicalNotes":"Synthetic notes"}'::jsonb then raise exception 'Regeneration lost clinical context'; end if;
 if not update_assessment_job(j.session_id,j.token,'start') or update_assessment_job(j.session_id,j.token,'start') then raise exception 'Duplicate worker started'; end if;
 update assessment_jobs set lease_until=now()-interval '1 second' where session_id=j.session_id;
 if update_assessment_job(j.session_id,j.token,'check') then raise exception 'Expired worker authorized'; end if;
 old_token=j.token;
 if finish_assessment_job(j.session_id,j.token,'draft_ai','{}') then raise exception 'Expired result committed'; end if;
 select * into j from claim_assessment_jobs(1,j.session_id);
 if j.context_json is distinct from '{"rejectionReason":"Synthetic rejection","clinicalNotes":"Synthetic notes"}'::jsonb then raise exception 'Recovery lost clinical context'; end if;
 if finish_assessment_job(j.session_id,old_token,'draft_ai','{}') or finish_assessment_job(j.session_id,old_token,'requires_manual_review','{}') then raise exception 'Stale manual result committed'; end if;
 perform update_assessment_job(j.session_id,j.token,'start');
 if not finish_assessment_job(j.session_id,j.token,'draft_ai','{"proposed_tasks":[]}') or not finish_assessment_job(j.session_id,j.token,'draft_ai','{"proposed_tasks":[]}') then raise exception 'Valid result/retry rejected'; end if;
 if (select count(*) from assessments where session_id=j.session_id and status='draft_ai')<>1 or (select status from assessment_jobs where session_id=j.session_id)<>'completed' then raise exception 'Result/job not committed atomically'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select review_assessment_atomic('20000000-0000-0000-0000-000000000013',(select id from assessments where session_id='20000000-0000-0000-0000-000000000013' and status='draft_ai'),'confirm');
reset role;
set local role service_role;
do $$ declare sid uuid:='20000000-0000-0000-0000-000000000013'; before_row jsonb; begin
 select to_jsonb(a) into before_row from assessments a where session_id=sid and status='reviewed_confirmed';
 perform finish_assessment_job(sid,(select token from assessment_jobs where session_id=sid),'draft_ai','{"late":true}');
 if before_row is distinct from (select to_jsonb(a) from assessments a where session_id=sid and status='reviewed_confirmed') then raise exception 'Late completion changed clinical review'; end if;
 -- Simulate the rejected authoritative state, without deleting its history.
 update assessments set status='rejected',rejection_reason='Synthetic late rejection' where session_id=sid and status='reviewed_confirmed';
 select to_jsonb(a) into before_row from assessments a where session_id=sid and status='rejected';
 perform finish_assessment_job(sid,(select token from assessment_jobs where session_id=sid),'requires_manual_review','{"late":true}');
 if before_row is distinct from (select to_jsonb(a) from assessments a where session_id=sid and status='rejected') then raise exception 'Late failure changed clinical rejection'; end if;
end $$;
reset role;
rollback;
