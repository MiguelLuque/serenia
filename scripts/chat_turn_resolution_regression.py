"""Owned turn resolution against the disposable database gate's PostgreSQL."""
from concurrent.futures import ThreadPoolExecutor
import time
import uuid


def run_chat_turn_resolution_regressions(query):
    def value(sql):
        return query(sql).splitlines()[2].strip()

    def wait_for(predicate, label):
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            if value(f'select {predicate};') == 't':
                return
            time.sleep(.05)
        raise RuntimeError(f'Resolution barrier not observed: {label}')

    def expect_denied(sql):
        try:
            query('\\set VERBOSITY verbose\n' + sql)
        except RuntimeError as exc:
            if '42501' not in str(exc):
                raise
        else:
            raise RuntimeError('Resolution unexpectedly authorized')

    uid, foreign, cid, sid = (str(uuid.uuid4()) for _ in range(4))
    query(f"""insert into auth.users(id) values('{uid}'),('{foreign}');
        update user_profiles set informal_name='Synthetic',pronouns='elle',birth_date='1990-01-01',
          reason_for_consulting='Synthetic test reason' where user_id='{uid}';
        insert into consents(user_id,consent_version,server_recorded,payload_json)
          values('{uid}','technical-draft-2026-10-11',true,'{{"birthDate":"1990-01-01"}}');
        insert into conversations(id,user_id) values('{cid}','{uid}');
        insert into clinical_sessions(id,user_id,conversation_id) values('{sid}','{uid}','{cid}');""")
    token = value(f"select begin_chat_turn('{sid}','{uid}','race','Fictional input',false)->>'token';")
    owner = f"set role authenticated; set request.jwt.claim.sub='{uid}'; set statement_timeout='2s';"
    def resolve(request='race', attempt=1):
        return value(owner + f"select resolve_expired_chat_turn('{sid}','{request}',{attempt});")
    def stored_token():
        return value(f"select token from chat_turns where session_id='{sid}' and request_id='race';")

    expect_denied(f"set role anon; select resolve_expired_chat_turn('{sid}','race',1);")
    expect_denied(f"set role service_role; select resolve_expired_chat_turn('{sid}','race',1);")
    expect_denied(f"set role authenticated; select resolve_expired_chat_turn('{sid}','race',1);")
    expect_denied(owner + f"select resolve_expired_chat_turn('{sid}','bad id',1);")
    expect_denied(owner + f"select resolve_expired_chat_turn('{sid}','race',0);")
    expect_denied(owner + f"select resolve_expired_chat_turn('{sid}','race',null);")
    expect_denied(f"set role authenticated; set request.jwt.claim.sub='{foreign}'; select resolve_expired_chat_turn('{sid}','race',1);")
    if resolve() != 'active' or stored_token() != token or resolve('missing') != 'unknown':
        raise RuntimeError('Live or missing turn resolution changed state')
    if value(owner + f"select get_chat_turn_recovery('{sid}')->>'attempt';") != '1':
        raise RuntimeError('Recovery did not expose the current generation')

    def blocker(sql):
        try:
            query(f"set application_name='resolution-blocker'; begin; {sql} select pg_sleep(30); rollback;")
        except RuntimeError as exc:
            if 'canceling statement due to user request' not in str(exc):
                raise
        else:
            raise RuntimeError('Resolution blocker unexpectedly ended')

    with ThreadPoolExecutor(max_workers=1) as pool:
        held = pool.submit(blocker, f"select request_id from chat_turns where session_id='{sid}' and request_id='race' for update;")
        try:
            wait_for("exists(select 1 from pg_stat_activity where application_name='resolution-blocker' and wait_event='PgSleep')", 'turn locked')
            if resolve() != 'busy':
                raise RuntimeError('Busy turn did not return busy')
        finally:
            query("select pg_cancel_backend(pid) from pg_stat_activity where application_name='resolution-blocker';")
            held.result()

    query(f"update chat_turns set lease_until=clock_timestamp()+interval '8 seconds' where session_id='{sid}' and request_id='race';")
    with ThreadPoolExecutor(max_workers=1) as pool:
        creator = pool.submit(query, f"""set application_name='resolution-creator'; begin; set local role service_role;
            select id from create_questionnaire_atomic('{sid}','{uid}','{cid}','PHQ9','Synthetic race','race','{token}');
            select pg_sleep(25); commit;""")
        wait_for("exists(select 1 from pg_stat_activity where application_name='resolution-creator' and wait_event='PgSleep')", 'creation before commit')
        wait_for(f"(select lease_until<=clock_timestamp() from chat_turns where session_id='{sid}' and request_id='race')", 'lease expired')
        if resolve() != 'busy' or value(f"select count(*) from questionnaire_instances where session_id='{sid}';") != '0':
            raise RuntimeError('Uncommitted creator not reported busy')
        # Wake the synthetic creator without cancelling its transaction: PostgreSQL
        # cannot interrupt pg_sleep without aborting it, so let it commit naturally.
        creator.result(timeout=30)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: resolve(), range(2)))
    if 'failed' not in results or any(result not in ('failed', 'busy') for result in results):
        raise RuntimeError('Concurrent expired turn resolution failed: ' + repr(results))
    fenced = stored_token()
    if fenced == token or resolve() != 'failed' or stored_token() != fenced:
        raise RuntimeError('Resolution not idempotent or token not fenced')
    if value(f"select count(*) from questionnaire_instances where session_id='{sid}';") != '1':
        raise RuntimeError('Earlier committed questionnaire missing')
    expect_denied(f"set role service_role; select create_questionnaire_atomic('{sid}','{uid}','{cid}','GAD7','Synthetic stale','race','{token}');")

    retry = value(f"select begin_chat_turn('{sid}','{uid}','race','Fictional input',false)->>'token';")
    query(f"""select finish_chat_turn('{sid}','race','{retry}',
       '[{{"type":"text","text":"Fictional reply"}}]','[]');""")
    if resolve(attempt=1) != 'stale':
        raise RuntimeError('Old generation observed terminal state of later retry')
    if resolve(attempt=2) != 'completed' or stored_token() != retry:
        raise RuntimeError('Completed turn changed during resolution')
    if value(f"select jsonb_array_length(response_parts) from chat_turns where session_id='{sid}' and request_id='race';") != '1':
        raise RuntimeError('Completed answer missing')
    # A timed-out old resolution can arrive after a retry using the same ID.
    # Even if the retry lease has expired, its generation must remain intact.
    old = value(f"select begin_chat_turn('{sid}','{uid}','version-race','Fictional version',false)->>'token';")
    query(f"update chat_turns set lease_until=clock_timestamp()-interval '1 second' where session_id='{sid}' and request_id='version-race';")
    if resolve('version-race', 1) != 'failed':
        raise RuntimeError('First generation not resolved')
    new = value(f"select begin_chat_turn('{sid}','{uid}','version-race','Fictional version',false)->>'token';")
    query(f"update chat_turns set lease_until=clock_timestamp()-interval '1 second' where session_id='{sid}' and request_id='version-race';")
    if new == old or resolve('version-race', 1) != 'stale':
        raise RuntimeError('Old resolution affected new generation')
    if value(f"select status || '|' || token::text || '|' || attempts from chat_turns where session_id='{sid}' and request_id='version-race';") != f'generating|{new}|2':
        raise RuntimeError('Old resolution mutated new generation')
    if resolve('version-race', 2) != 'failed':
        raise RuntimeError('Current generation not resolved')
    last = value(f"select begin_chat_turn('{sid}','{uid}','version-race','Fictional version',false)->>'token';")
    query(f"select finish_chat_turn('{sid}','version-race','{last}','[{{\"type\":\"text\",\"text\":\"Final\"}}]','[]');")
    value(f"select begin_chat_turn('{sid}','{uid}','exhausted','Fictional final attempt',false)->>'token';")
    query(f"update chat_turns set attempts=3,lease_until=clock_timestamp()-interval '1 second' where session_id='{sid}' and request_id='exhausted';")
    if resolve('exhausted', 3) != 'failed':
        raise RuntimeError('Exhausted turn not fenced')
    recovery = value(owner + f"select get_chat_turn_recovery('{sid}')->>'canRetry';")
    if recovery != 'false':
        raise RuntimeError('Exhausted turn became retryable')
    query(f"set role service_role; select close_session_atomic('{sid}','{uid}','user_request');")
    if resolve('exhausted') != 'closed':
        raise RuntimeError('Closed session not reported')

    # An admitted creation can also roll back. The resolver must report busy
    # while its transaction is open and fence the old token once it ends.
    rollback_sid, rollback_cid = str(uuid.uuid4()), str(uuid.uuid4())
    query(f"""insert into conversations(id,user_id) values('{rollback_cid}','{uid}');
        insert into clinical_sessions(id,user_id,conversation_id)
        values('{rollback_sid}','{uid}','{rollback_cid}');""")
    rollback_token = value(f"select begin_chat_turn('{rollback_sid}','{uid}','rolled-back','Fictional rollback',false)->>'token';")
    query(f"update chat_turns set lease_until=clock_timestamp()+interval '8 seconds' where session_id='{rollback_sid}' and request_id='rolled-back';")
    rollback_resolve = owner + f"select resolve_expired_chat_turn('{rollback_sid}','rolled-back',1);"
    with ThreadPoolExecutor(max_workers=1) as pool:
        creator = pool.submit(query, f"""set application_name='resolution-rollback-creator'; begin; set local role service_role;
            select id from create_questionnaire_atomic('{rollback_sid}','{uid}','{rollback_cid}','PHQ9','Synthetic rollback','rolled-back','{rollback_token}');
            select pg_sleep(15); rollback;""")
        try:
            wait_for("exists(select 1 from pg_stat_activity where application_name='resolution-rollback-creator' and wait_event='PgSleep')", 'rollback creator holds locks')
            wait_for(f"(select lease_until<=clock_timestamp() from chat_turns where session_id='{rollback_sid}' and request_id='rolled-back')", 'rollback creator lease expired')
            if value(rollback_resolve) != 'busy':
                raise RuntimeError('Rollback creator not reported busy')
            if value(f"select count(*) from questionnaire_instances where session_id='{rollback_sid}';") != '0':
                raise RuntimeError('Uncommitted rollback questionnaire was visible')
            creator.result(timeout=20)
        finally:
            if not creator.done():
                query("select pg_cancel_backend(pid) from pg_stat_activity where application_name='resolution-rollback-creator';")
                try:
                    creator.result(timeout=5)
                except RuntimeError as exc:
                    if 'canceling statement due to user request' not in str(exc):
                        raise
    if value(rollback_resolve) != 'failed':
        raise RuntimeError('Rolled-back creator turn not resolved')
    rollback_fenced = value(f"select token from chat_turns where session_id='{rollback_sid}' and request_id='rolled-back';")
    if rollback_fenced == rollback_token or value(rollback_resolve) != 'failed' or value(f"select token from chat_turns where session_id='{rollback_sid}' and request_id='rolled-back';") != rollback_fenced:
        raise RuntimeError('Rolled-back creator token not fenced idempotently')
    if value(f"select count(*) from questionnaire_instances where session_id='{rollback_sid}';") != '0':
        raise RuntimeError('Rolled-back questionnaire persisted')
    expect_denied(f"set role service_role; select create_questionnaire_atomic('{rollback_sid}','{uid}','{rollback_cid}','PHQ9','Synthetic stale','rolled-back','{rollback_token}');")
    print('PASS owned resolution, busy locks, late commit/rollback, fencing, idempotency, exhaustion and closure')
