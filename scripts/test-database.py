#!/usr/bin/env python3
"""Portable PostgreSQL regression harness. No remote URLs, volumes or patient data.

Uses the locally installed postgres:17.6-bookworm image. auth.uid() is a test
shim, not a test of GoTrue/JWT/PostgREST. Each migration is its own transaction.
"""
import argparse
import pathlib
import subprocess
import uuid
import json
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--baseline-security', action='store_true', help='Historical baseline without the two nonportable data operations or hardening migration')
parser.add_argument('--baseline-chat', action='store_true', help='Task 1 schema with Task 2 regressions and no Task 2 migration')
parser.add_argument('--baseline-flows', action='store_true', help='Task 2 schema with Task 3 functional regressions')
args = parser.parse_args()
name = 'serenia-sql-test-' + uuid.uuid4().hex[:12]

def docker(*argv, sql=None, check=True):
    return subprocess.run(['rtk', 'proxy', 'docker', *argv], input=sql, text=True, capture_output=True, check=check)

def query(sql):
    result = docker('exec', '-i', name, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', sql=sql, check=False)
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return result.stdout

try:
    docker('run', '--detach', '--rm', '--name', name, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data:rw', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17.6-bookworm')
    import time
    for _ in range(80):
        # The image's temporary initialization server uses sockets only, then
        # restarts. TCP readiness waits for the final server, avoiding a race.
        if docker('exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', check=False).returncode == 0:
            break
        time.sleep(.25)
    else:
        raise RuntimeError('PostgreSQL startup timed out:\n' + docker('logs', name, check=False).stdout)
    query((ROOT / 'supabase/tests/bootstrap.sql').read_text())
    for path in sorted((ROOT / 'supabase/migrations').glob('*.sql')):
        if args.baseline_flows and 'patient_flows_acceptance' in path.name:
            continue
        if args.baseline_chat and 'robust_chat_questionnaires_recovery' in path.name:
            continue
        if args.baseline_security and (path.name.startswith('202610') or path.name.startswith('20260502000004') or path.name.startswith('20260502000005')):
            continue
        try:
            if 'robust_chat_questionnaires_recovery' in path.name:
                # New table grants must survive a hosted installation without
                # bootstrap's historical permissive default privileges.
                query('alter default privileges in schema public revoke all on tables from anon,authenticated,service_role;')
            query('BEGIN;\n' + path.read_text() + '\nCOMMIT;')
        except RuntimeError as error:
            raise RuntimeError(f'Migration {path.name}: {error}') from error
    print('PASS migrations from empty auth.users')
    # Keep the temporary must_deny helper and fixtures on one SQL connection.
    query((ROOT / 'supabase/tests/authorization-review.sql').read_text() + '\n' +
          (ROOT / 'supabase/tests/relationships.sql').read_text() + '\n' +
          (ROOT / 'supabase/tests/review-task-progress.sql').read_text())
    print('PASS authorization, ownership, closure, review, rollback and regeneration')
    print('PASS elevated cross-parent writes and foreign inherited task rollback')
    print('PASS review preserves completed/partial tasks and rejects incompatible agreements')
    # Replay the two repaired historical data migrations against existing rows:
    # preserve accounts/clinician roles and repair only a missing profile.
    query("delete from user_profiles where user_id='00000000-0000-0000-0000-000000000002';")
    query((ROOT / 'supabase/migrations/20260502000004_wipe_legacy_test_data.sql').read_text())
    query((ROOT / 'supabase/migrations/20260502000005_restore_preserved_profiles.sql').read_text())
    query((ROOT / 'supabase/migrations/20260502000005_restore_preserved_profiles.sql').read_text())
    query("""do $$ begin
      if (select count(*) from auth.users)<>3 then raise exception 'historical repair changed accounts'; end if;
      if (select count(*) from user_profiles)<>3 then raise exception 'historical repair invented or lost profiles'; end if;
      if not exists(select 1 from user_profiles where user_id='00000000-0000-0000-0000-000000000002' and role='patient') then raise exception 'missing profile not repaired safely'; end if;
      if not exists(select 1 from user_profiles where user_id='00000000-0000-0000-0000-000000000003' and role='clinician') then raise exception 'historical repair changed clinician'; end if;
      if (select count(*) from clinical_sessions)<>2 then raise exception 'historical wipe lost sessions'; end if;
    end $$;""")
    print('PASS historical repair preserves accounts, roles, sessions and patient default')
    query((ROOT / 'supabase/tests/patient-flows.sql').read_text())
    print('PASS adult acceptance and private report projections')
    parity = json.loads((ROOT / 'tests/fixtures/risk-parity.json').read_text())
    def literal(value):
        return 'null' if value is None else "'" + str(value).replace("'", "''") + "'"
    for v in parity['vectors']:
        latest = max((e['createdAt'] for e in v['events']), default=None)
        high = max((e['createdAt'] for e in v['events'] if e['severity']=='high'), default=None)
        prev = v['previous'] or {}
        params = [v['reviewedAt'],v['suicidality'],None,latest,high,prev.get('closedAt'),prev.get('closureReason'),parity['now']]
        terms = [literal(x) for x in params]
        terms[2] = 'true' if any(e['severity']=='critical' for e in v['events']) else 'false'
        query("do $$ begin if derive_patient_risk_state_sql(" + ','.join(terms) + ")<>" + literal(v['expected']) + " then raise exception 'SQL risk parity failed: " + v['name'] + "'; end if; end $$;")
    for item in json.loads((ROOT / 'tests/fixtures/assessment-risk-parity.json').read_text()):
        query("do $$ begin if assessment_summary_valid_for_risk(" + literal(json.dumps(item['summary'])) + "::jsonb) is distinct from " + ('true' if item['expected'] else 'false') + " then raise exception 'Full schema parity failed: " + item['name'] + "'; end if; end $$;")
    query((ROOT / 'supabase/tests/clinician-inbox-page.sql').read_text())
    print('PASS globally prioritized bounded inbox, old pending pagination, snapshots and 12 SQL/TypeScript parity vectors')
    # Non-binding synthetic acknowledgement for existing Task 2 actor fixtures.
    query("update user_profiles set informal_name='Synthetic',pronouns='elle',birth_date='1990-01-01',reason_for_consulting='Synthetic test reason'; insert into consents(user_id,consent_version,server_recorded,payload_json) select user_id,'technical-draft-2026-10-11',true,'{\"birthDate\":\"1990-01-01\"}'::jsonb from user_profiles;")
    # Two independent database connections compete for the same row lock.
    actor = "set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);"
    session = '20000000-0000-0000-0000-000000000002'
    assessment = '30000000-0000-0000-0000-000000000002'
    query(f"update assessments set status='draft_ai',summary_json='{{\"proposed_tasks\":[{{\"descripcion\":\"Concurrent task\"}}]}}' where id='{assessment}';")
    confirm = actor + f"select review_assessment_atomic('{session}','{assessment}','confirm');"
    modify = actor + f"select review_assessment_atomic('{session}','{assessment}','modify','{{\"proposed_tasks\":[{{\"descripcion\":\"Concurrent replacement\"}}]}}');"
    with ThreadPoolExecutor(max_workers=2) as pool:
        attempts = [pool.submit(query, sql) for sql in [confirm, modify]]
        for attempt in attempts:
            try:
                attempt.result()
            except RuntimeError as error:
                if 'Assessment already changed; reload' not in str(error):
                    raise
    query(f"""do $$ begin
      if (select count(*) from assessments where session_id='{session}' and status not in ('superseded','rejected')) <> 1 then raise exception 'concurrent live versions'; end if;
      if (select count(*) from patient_tasks where acordada_en_session_id='{session}' and closed_at is null) <> 1 then raise exception 'concurrent active tasks'; end if;
    end $$;""")
    # Identical modify retries return the same revision, including two concurrent callers.
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(query, [modify, modify]))
    if results[0] != results[1]:
        raise RuntimeError('Concurrent retry returned different revision IDs')
    print('PASS concurrent confirm/modify and duplicate modify retry')
    query((ROOT / 'supabase/tests/chat-questionnaire-recovery.sql').read_text())
    print('PASS atomic questionnaire validation/retry/rollback, CSSRS priority, chat consent/leases and durable recovery')
    # Independent connections contend for the same questionnaire/turn/job.
    sid = '20000000-0000-0000-0000-000000000020'
    cid = '10000000-0000-0000-0000-000000000020'
    uid = '00000000-0000-0000-0000-000000000001'
    query(f"insert into conversations(id,user_id) values('{cid}','{uid}'); insert into clinical_sessions(id,user_id,conversation_id) values('{sid}','{uid}','{cid}');")
    server = 'set role service_role;'
    quiz = server + f"select create_questionnaire_atomic('{sid}','{uid}','{cid}','PHQ9','Synthetic concurrency');"
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(query, [quiz, quiz]))
    query(f"do $$ begin if (select count(*) from questionnaire_instances where session_id='{sid}')<>1 then raise exception 'Concurrent duplicate quiz'; end if; end $$;")
    submission = server + f"""select submit_questionnaire_atomic(
      (select id from questionnaire_instances where session_id='{sid}'),'{uid}',
      (select jsonb_agg(jsonb_build_object('itemOrder',order_index,'valueNumeric',2,'valueRaw','2') order by order_index) from questionnaire_items where questionnaire_id=(select questionnaire_id from questionnaire_instances where session_id='{sid}')),
      '{{"totalScore":18,"severityBand":"moderately_severe","subscores":{{}},"flags":[{{"itemOrder":9,"reason":"suicidality"}}],"requiresReview":true}}','high');"""
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(query, [submission, submission]))
    query(f"do $$ begin if (select count(*) from questionnaire_results r join questionnaire_instances i on i.id=r.instance_id where i.session_id='{sid}')<>1 or (select count(*) from risk_events where session_id='{sid}')<>1 then raise exception 'Concurrent scoring duplicated effects'; end if; end $$;")
    turn = server + f"select begin_chat_turn('{sid}','{uid}','same','Quiero matarme esta noche',true);"
    successes = 0
    with ThreadPoolExecutor(max_workers=2) as pool:
        for attempt in [pool.submit(query, turn), pool.submit(query, turn)]:
            try:
                attempt.result(); successes += 1
            except RuntimeError as error:
                if 'turn_in_progress' not in str(error): raise
    if successes != 1: raise RuntimeError('Concurrent generation lease not exclusive')
    urgent = server + f"select begin_chat_turn('{sid}','{uid}','urgent','Voy a quitarme la vida',true,true);"
    old_token = query(f"select token from chat_turns where session_id='{sid}' and request_id='same';").splitlines()[2].strip()
    successes = 0
    with ThreadPoolExecutor(max_workers=2) as pool:
        for attempt in [pool.submit(query, urgent), pool.submit(query, urgent)]:
            try:
                attempt.result(); successes += 1
            except RuntimeError as error:
                if 'turn_in_progress' not in str(error): raise
    if successes != 1: raise RuntimeError('Urgent concurrent claim not exclusive')
    query(server + f"""do $$ begin
      begin
        perform finish_chat_turn('{sid}','same','{old_token}','[{{"type":"text","text":"stale"}}]','[]');
        raise exception 'Interrupted owner persisted';
      exception when insufficient_privilege then null; end;
    end $$;""")
    query(server + f"""select finish_chat_turn('{sid}','urgent',(select token from chat_turns where session_id='{sid}' and request_id='urgent'),'[{{"type":"text","text":"Línea 024"}}]','[]',null,'crisis_detected');""")
    claim = server + f"select count(*) from claim_assessment_jobs(1,'{sid}');"
    with ThreadPoolExecutor(max_workers=2) as pool:
        claims = list(pool.map(query, [claim, claim]))
    query(f"do $$ begin if (select attempts from assessment_jobs where session_id='{sid}')<>1 or (select count(*) from messages where session_id='{sid}' and role='user')<>2 then raise exception 'Concurrent chat/outbox duplicate'; end if; end $$;")
    begin_worker = server + f"select update_assessment_job('{sid}',(select token from assessment_jobs where session_id='{sid}'),'start');"
    with ThreadPoolExecutor(max_workers=2) as pool:
        starts = list(pool.map(query, [begin_worker, begin_worker]))
    import re
    if sum(bool(re.search(r'\n\s+t\s*\n', result)) for result in starts) != 1:
        raise RuntimeError('Concurrent workflow starts not exclusive')
    complete = server + f"select finish_assessment_job('{sid}',(select token from assessment_jobs where session_id='{sid}'),'draft_ai','{{}}');"
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(query, [complete, complete]))
    query(f"do $$ begin if (select count(*) from assessments where session_id='{sid}' and status='draft_ai')<>1 or (select status from assessment_jobs where session_id='{sid}')<>'completed' then raise exception 'Concurrent completion duplicate/lost job'; end if; end $$;")
    print('PASS concurrent quiz create/score, urgent chat fencing, assessment enqueue/worker claim and atomic completion')
    # Force the stale candidate close to wait behind renewed activity. Observe
    # pg_sleep only after touch acquired the session lock; no timing guess.
    race_sid = '20000000-0000-0000-0000-000000000021'
    race_cid = '10000000-0000-0000-0000-000000000021'
    query(f"insert into conversations(id,user_id) values('{race_cid}','{uid}'); insert into clinical_sessions(id,user_id,conversation_id,last_activity_at) values('{race_sid}','{uid}','{race_cid}',now()-interval '31 minutes');")
    touch_actor = f"set role authenticated; select set_config('request.jwt.claim.sub','{uid}',false);"
    with ThreadPoolExecutor(max_workers=1) as pool:
        touching = pool.submit(query, f"set application_name='serenia-touch-race'; begin; {touch_actor} select touch_session_atomic('{race_sid}'); select pg_sleep(1); commit;")
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            observed = query("select count(*) from pg_stat_activity where application_name='serenia-touch-race' and wait_event='PgSleep';")
            if re.search(r'\n\s+1\s*\n', observed): break
            time.sleep(.02)
        else: raise RuntimeError('Touch lock barrier not observed')
        try:
            query(server + f"select close_session_atomic('{race_sid}','{uid}','inactivity');")
        except RuntimeError as error:
            if 'Session activity resumed' not in str(error): raise
        else: raise RuntimeError('Stale inactivity close won after renewed activity')
        touching.result()
    query(f"do $$ begin if (select status from clinical_sessions where id='{race_sid}')<>'open' or exists(select 1 from assessment_jobs where session_id='{race_sid}') then raise exception 'Stale inactivity job created'; end if; end $$;")
    print('PASS concurrent touch/inactivity lock revalidation preserves active session without outbox')
finally:
    docker('rm', '--force', name, check=False)
