"""Deterministic lease interleavings on the database gate's disposable container."""
from concurrent.futures import ThreadPoolExecutor
import time
import uuid


def run_chat_lease_regressions(query):
    def value(sql):
        return query(sql).splitlines()[2].strip()



    def wait_for(predicate, label):
        deadline = time.monotonic() + 12
        while time.monotonic() < deadline:
            if value(f'select {predicate};') == 't':
                return
            time.sleep(.03)
        raise RuntimeError(f'Chat lease barrier not observed: {label}')

    def blocked(worker, blocker):
        return f"""exists(select 1 from pg_stat_activity a cross join pg_stat_activity b
           where a.application_name='{worker}' and b.application_name='{blocker}'
             and b.pid=any(pg_blocking_pids(a.pid)))"""

    def cancel_blocker():
        query("select pg_cancel_backend(pid) from pg_stat_activity where application_name='lease-blocker';")

    def expected_cancel(sql):
        try:
            query(sql)
        except RuntimeError as exc:
            if 'canceling statement due to user request' not in str(exc):
                raise
        else:
            raise RuntimeError('Chat lease blocker ended before cancellation')

    def prepare(with_proposal=False, with_turn=True):
        uid = str(uuid.uuid4())
        query(f"""insert into auth.users(id) values('{uid}');
            update user_profiles set informal_name='Synthetic',pronouns='elle',birth_date='1990-01-01',
              reason_for_consulting='Synthetic test reason' where user_id='{uid}';
            insert into consents(user_id,consent_version,server_recorded,payload_json)
              values('{uid}','technical-draft-2026-10-11',true,'{{"birthDate":"1990-01-01"}}');""")
        sid, cid = str(uuid.uuid4()), str(uuid.uuid4())
        query(f"""insert into conversations(id,user_id) values('{cid}','{uid}');
            insert into clinical_sessions(id,user_id,conversation_id) values('{sid}','{uid}','{cid}');""")
        if with_proposal:
            prior = value(f"select begin_chat_turn('{sid}','{uid}','prior','Fictional prior')->>'token';")
            query(f"""select finish_chat_turn('{sid}','prior','{prior}',
                '[{{"type":"text","text":"Fictional proposal"}}]','[]','user_request');""")
        if not with_turn:
            return sid, cid, uid, None
        token = value(f"select begin_chat_turn('{sid}','{uid}','lease-race','Sí')->>'token';")
        return sid, cid, uid, token

    def questionnaire_call(sid, cid, uid, token):
        return f"select create_questionnaire_atomic('{sid}','{uid}','{cid}','PHQ9','Synthetic race','lease-race','{token}');"

    def persisted(sid):
        return value(f"""select t.status || '|' || s.status || '|' ||
            (select count(*) from questionnaire_instances where session_id=s.id) || '|' ||
            (select count(*) from messages where session_id=s.id and role='assistant'
             and parts @> '[{{"type":"text","text":"Fictional final response"}}]'::jsonb)
            from chat_turns t join clinical_sessions s on s.id=t.session_id
            where t.session_id='{sid}' and t.request_id='lease-race';""")

    def start_blocker(pool, statement):
        return pool.submit(expected_cancel, f"""set application_name='lease-blocker';
            begin; {statement} select pg_sleep(30); rollback;""")

    def wait_until_sleeping():
        wait_for("""exists(select 1 from pg_stat_activity
            where application_name='lease-blocker' and wait_event='PgSleep')""", 'blocker holds row')

    def expect_stale(sql, expected):
        try:
            query(sql)
        except RuntimeError as exc:
            if f'42501: {expected}' not in str(exc):
                raise
        else:
            raise RuntimeError(f'Expired chat RPC accepted: {expected}')

    for operation in ('questionnaire', 'finish', 'close'):
        for lock_target in ('session', 'turn'):
            sid, cid, uid, token = prepare(with_proposal=operation == 'close')
            lock_sql = (
                f"select id from clinical_sessions where id='{sid}' for update;"
                if lock_target == 'session' else
                f"select request_id from chat_turns where session_id='{sid}' and request_id='lease-race' for update;"
            )
            operations = {
                'questionnaire': questionnaire_call(sid, cid, uid, token),
                'finish': f"""select finish_chat_turn('{sid}','lease-race','{token}',
                    '[{{"type":"text","text":"Fictional final response"}}]','[]');""",
                'close': f"select close_chat_turn('{sid}','lease-race','{token}','user_request');",
            }
            with ThreadPoolExecutor(max_workers=2) as pool:
                query(f"""update chat_turns set lease_until=clock_timestamp()+interval '5 seconds'
                    where session_id='{sid}' and request_id='lease-race';""")
                blocker = start_blocker(pool, lock_sql)
                try:
                    wait_until_sleeping()
                    worker = pool.submit(expect_stale,
                        "\\set VERBOSITY verbose\nset application_name='lease-worker'; set role service_role;\n" + operations[operation],
                        'Expired turn' if operation == 'finish' else 'Stale turn owner')
                    wait_for(f"""({blocked('lease-worker', 'lease-blocker')}) and
                        (select lease_until>clock_timestamp() from chat_turns where session_id='{sid}' and request_id='lease-race')""",
                        f'{operation} waits for {lock_target} before expiry')
                    wait_for(f"(select lease_until<=clock_timestamp() from chat_turns where session_id='{sid}' and request_id='lease-race')", 'lease expiry')
                finally:
                    cancel_blocker()
                    blocker.result()
                worker.result()
            if persisted(sid) != 'generating|open|0|0':
                raise RuntimeError(f'Expired {operation} left durable effects after {lock_target} wait')

    for claim in ("profile wait", "admission", "retry"):
        retry = claim == "retry"
        sid, _, uid, previous_token = prepare(with_turn=retry)
        if retry:
            query(f"""update chat_turns set lease_until=clock_timestamp()+interval '2 seconds'
                where session_id='{sid}' and request_id='lease-race';""")
        if claim == "profile wait":
            query(f"insert into profile_settings(user_id,enabled) values('{uid}',false);")
            lock_sql = f"select user_id from profile_settings where user_id='{uid}' for update;"
        else:
            lock_sql = f"select id from clinical_sessions where id='{sid}' for update;"
        with ThreadPoolExecutor(max_workers=2) as pool:
            blocker = start_blocker(pool, lock_sql)
            try:
                wait_until_sleeping()
                claimant = pool.submit(query, f"""set application_name='lease-worker'; set role service_role;
                    select begin_chat_turn('{sid}','{uid}','lease-race','Sí');""")
                wait_for(blocked('lease-worker', 'lease-blocker'), f'{claim} waits for row')
                wait_for("""exists(select 1 from pg_stat_activity where application_name='lease-worker'
                    and clock_timestamp()-xact_start>=interval '3 seconds')""", 'claim lock consumes time')
                released_at = value('select clock_timestamp();')
            finally:
                cancel_blocker()
                blocker.result()
            claimant.result()
        fresh = value(f"""select (lease_until >= '{released_at}'::timestamptz+interval '2 minutes'
              and (select last_activity_at from clinical_sessions where id='{sid}')>='{released_at}'::timestamptz
              and token::text<>'{previous_token}' and attempts={2 if retry else 1}
              and (select count(*) from messages where session_id='{sid}' and role='user')=1)
            from chat_turns where session_id='{sid}' and request_id='lease-race';""")
        if fresh != 't':
            raise RuntimeError(f'Chat {claim} used time before releasing its blocker or changed retry identity')
        if claim == "profile wait":
            query(f"delete from profile_settings where user_id='{uid}';")

    # Pause creation after authorization at INSERT, while the turn lock must
    # prevent the independent fail transaction from publishing a terminal state.
    sid, cid, uid, token = prepare()
    query(f"""create function public.test_block_questionnaire_insert() returns trigger
        language plpgsql as $$ begin
          if new.session_id='{sid}' then perform pg_advisory_xact_lock(992301); end if;
          return new;
        end $$;
        create trigger test_block_questionnaire_insert before insert on questionnaire_instances
        for each row execute function public.test_block_questionnaire_insert();""")
    try:
        with ThreadPoolExecutor(max_workers=3) as pool:
            blocker = start_blocker(pool, 'select pg_advisory_xact_lock(992301);')
            try:
                wait_until_sleeping()
                creator = pool.submit(query, "set application_name='lease-worker'; set role service_role;" + questionnaire_call(sid, cid, uid, token))
                wait_for(blocked('lease-worker', 'lease-blocker'), 'creation reached INSERT')
                failure = pool.submit(query, f"""set application_name='lease-failure'; set role service_role;
                    select fail_chat_turn('{sid}','lease-race','{token}','turn_failed');""")
                wait_for(f"""({blocked('lease-failure', 'lease-worker')}) or
                    (select status='failed' from chat_turns where session_id='{sid}')""", 'failure attempted')
                receipt = query(f"""set role authenticated;
                    set request.jwt.claim.sub='{uid}';
                    set statement_timeout='750ms';
                    select get_chat_turn_recovery('{sid}')->>'status' as recovery_status;""")
                if 'generating' not in receipt:
                    raise RuntimeError('Authenticated recovery did not observe the live turn during the lock')
                if persisted(sid) != 'generating|open|0|0':
                    raise RuntimeError('Failure became visible before questionnaire creation committed')
            finally:
                cancel_blocker()
                blocker.result()
            creator.result()
            failure.result()
        if persisted(sid) != 'failed|open|1|0':
            raise RuntimeError('Failure and earlier questionnaire creation did not both persist')
    finally:
        query("""drop trigger test_block_questionnaire_insert on questionnaire_instances;
            drop function public.test_block_questionnaire_insert();""")
    print('PASS chat lease fencing after session/turn locks and concurrent questionnaire/failure')
