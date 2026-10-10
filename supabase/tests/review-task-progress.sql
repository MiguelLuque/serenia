\set ON_ERROR_STOP on
-- Isolate fixtures so existing authorization/concurrency checks are unchanged.
begin;
insert into clinical_sessions(id,conversation_id,user_id,status)
select ('20000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
 '10000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-0000-000000000001','closed'
from generate_series(5,9) n;
insert into assessments(id,user_id,session_id,assessment_type,summary_json)
select ('30000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000001',
 ('20000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
 'closure',case when n in (5,7,9) then '{"proposed_tasks":[{"descripcion":"Synthetic agreement","nota":null}]}'::jsonb else '{"proposed_tasks":[]}'::jsonb end
from generate_series(5,9) n;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$
declare n integer; sid uuid; aid uuid; bid uuid; tid uuid;
 progress text; original_summary jsonb; snapshot jsonb; replacement uuid;
 retry uuid; next_revision uuid; rejected boolean; before_count integer;
begin
 for n in select unnest(array[5,7]) loop
  sid=('20000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid;
  aid=('30000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid;
  bid=('30000000-0000-0000-0000-' || lpad((n+1)::text,12,'0'))::uuid;
  progress=case when n=5 then 'cumplida' else 'parcial' end;
  select summary_json into original_summary from assessments where id=aid;
  perform review_assessment_atomic(sid,aid,'confirm');
  select id into tid from patient_tasks where acordada_en_assessment_id=aid;
  -- Session B records progress against the task originally agreed in A.
  perform review_assessment_atomic(
   ('20000000-0000-0000-0000-' || lpad((n+1)::text,12,'0'))::uuid,
   bid,'modify','{"proposed_tasks":[]}',null,
   jsonb_build_array(jsonb_build_object('id',tid,'estado',progress,'nota','Synthetic progress')));
  select to_jsonb(t) into snapshot from patient_tasks t where id=tid;
  replacement=review_assessment_atomic(sid,aid,'modify',original_summary,'Only notes changed');
  retry=review_assessment_atomic(sid,aid,'modify',original_summary,'Only notes changed');
  if replacement<>retry then raise exception 'note edit retry changed revision ID'; end if;
  if (select to_jsonb(t) from patient_tasks t where id=tid) is distinct from snapshot then
   raise exception 'PROGRESS REGRESSION: % task identity/state/history changed on note-only edit',progress;
  end if;
  if (select count(*) from patient_tasks where acordada_en_session_id=sid)<>1 then
   raise exception 'PROGRESS REGRESSION: % task duplicated on note-only edit',progress;
  end if;
  if exists(select 1 from patient_tasks where acordada_en_session_id=sid and estado='pendiente') then
   raise exception 'PROGRESS REGRESSION: % task reopened as pending',progress;
  end if;
  -- Changed agreements after progress must fail with an actionable message,
  -- leaving both the live revision and all lifecycle fields unchanged.
  select count(*) into before_count from assessments;
  rejected=false;
  begin
   perform review_assessment_atomic(sid,replacement,'modify',
    '{"proposed_tasks":[{"descripcion":"Changed agreement","nota":null}]}','Incompatible edit');
  exception when check_violation then
   if sqlerrm not like 'Task agreements have later progress;%' then raise; end if;
   rejected=true;
  end;
  if not rejected then raise exception 'PROGRESS REGRESSION: changed agreements silently replaced % task',progress; end if;
  if (select count(*) from assessments)<>before_count or not exists(select 1 from assessments where id=replacement and status='reviewed_modified') then raise exception 'incompatible edit left a partial revision'; end if;
  if (select to_jsonb(t) from patient_tasks t where id=tid) is distinct from snapshot then raise exception 'incompatible edit changed task history'; end if;
  -- Editing a revision whose proposals were preserved must remain possible.
  next_revision=review_assessment_atomic(sid,replacement,'modify',original_summary,'Another note edit');
  if not exists(select 1 from assessments where id=next_revision and status='reviewed_modified') then raise exception 'next note edit unavailable'; end if;
  if (select to_jsonb(t) from patient_tasks t where id=tid) is distinct from snapshot then raise exception 'next note edit changed task'; end if;
 end loop;
 -- Tasks replaced internally in A have no later-session progress and must not
 -- prevent subsequent legitimate agreement edits in A.
 sid='20000000-0000-0000-0000-000000000009'; aid='30000000-0000-0000-0000-000000000009';
 perform review_assessment_atomic(sid,aid,'confirm');
 replacement=review_assessment_atomic(sid,aid,'modify','{"proposed_tasks":[{"descripcion":"First changed agreement"}]}');
 next_revision=review_assessment_atomic(sid,replacement,'modify','{"proposed_tasks":[{"descripcion":"Second changed agreement"}]}');
 retry=review_assessment_atomic(sid,replacement,'modify','{"proposed_tasks":[{"descripcion":"Second changed agreement"}]}');
 if next_revision<>retry then raise exception 'agreement edit retry changed ID'; end if;
 if (select count(*) from patient_tasks where acordada_en_session_id=sid and closed_at is null)<>1 or
    (select count(*) from patient_tasks where acordada_en_session_id=sid)<>3 then raise exception 'internal replacement blocked or lost history'; end if;
end $$;
reset role;
rollback;
