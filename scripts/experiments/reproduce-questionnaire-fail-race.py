#!/usr/bin/env python3
"""Reproduce a known bug, or test a limited prototype in a disposable database.

The default succeeds when it reproduces the defect. --prototype changes only
the ephemeral database and tests one interleaving, not a complete correction.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess
import sys
import time
import uuid

if sys.argv[1:] not in ([], ["--prototype"]):
    raise SystemExit("Usage: reproduce-questionnaire-fail-race.py [--prototype]")
root = Path(__file__).resolve().parents[2]
prototype = sys.argv[1:] == ["--prototype"]
name = "serenia-lease-race-" + uuid.uuid4().hex[:12]
uid = "00000000-0000-0000-0000-000000000901"
cid = "10000000-0000-0000-0000-000000000901"
sid = "20000000-0000-0000-0000-000000000901"

def docker(*args, sql=None, check=True):
    proc = subprocess.run(["rtk", "proxy", "docker", *args], input=sql,
                          text=True, capture_output=True, timeout=45)
    if check and proc.returncode:
        raise RuntimeError(proc.stdout + proc.stderr)
    return proc

def query(sql, check=True):
    return docker("exec", "-i", name, "psql", "-XAtq", "-v", "ON_ERROR_STOP=1",
                  "-U", "postgres", sql=sql, check=check).stdout.strip()

def wait_for(sql, expected, label):
    deadline = time.monotonic() + 18
    while time.monotonic() < deadline:
        if query(sql) == expected:
            return
        time.sleep(.08)
    raise RuntimeError("Barrier not observed: " + label)

docker("run", "--detach", "--rm", "--pull", "never", "--name", name,
       "--network", "none", "--tmpfs", "/var/lib/postgresql/data:rw",
       "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17.6-bookworm")
try:
    for _ in range(80):
        if docker("exec", name, "pg_isready", "-h", "127.0.0.1", "-U",
                  "postgres", check=False).returncode == 0:
            break
        time.sleep(.25)
    else:
        raise RuntimeError("PostgreSQL startup timed out")
    query((root / "supabase/tests/bootstrap.sql").read_text())
    # Reproduce the historical baseline, excluding the candidate and later
    # migrations. These experiments are not current acceptance tests.
    migrations = sorted(path for path in (root / "supabase/migrations").glob("*.sql")
                        if path.name < "20261114002500")
    for path in migrations:
        try:
            query("BEGIN;\n" + path.read_text() + "\nCOMMIT;")
        except RuntimeError as exc:
            raise RuntimeError(f"{path.name}: {exc}") from exc
    if prototype:
        source = next(path for path in migrations if "robust_chat_questionnaires_recovery" in path.name).read_text()
        start = source.index("create function create_questionnaire_atomic(")
        end = source.index("revoke all on function create_questionnaire_atomic(", start)
        original = source[start:end]
        expected_body = original.split("as $$", 1)[1].rsplit("$$;", 1)[0].strip()
        current_body = query("select prosrc from pg_proc where oid='public.create_questionnaire_atomic(uuid,uuid,uuid,text,text,text,uuid)'::regprocedure;")
        if current_body != expected_body:
            raise RuntimeError("Current function differs from the expected prototype baseline")
        patched = original.replace("create function ", "create or replace function ", 1)
        patched = patched.replace("declare s ", "declare t chat_turns%rowtype; s ", 1)
        begin = patched.index(" if p_request_id is not null and not exists(")
        end = patched.index("\n", begin)
        patched = patched[:begin] + """ if p_request_id is not null then
  select * into t from chat_turns where session_id=s.id and request_id=p_request_id for update;
  if not found or t.token is distinct from p_token or t.status<>'generating' or t.lease_until<=clock_timestamp() then
   raise exception 'Stale turn owner' using errcode='42501';
  end if;
 end if;""" + patched[end:]
        from difflib import unified_diff
        print("".join(unified_diff(original.splitlines(True), patched.splitlines(True),
                                   fromfile="migration", tofile="local prototype")), flush=True)
        query(patched)
    print(query("select version();"), flush=True)
    print(f"Applied {len(migrations)} repository migrations", flush=True)
    query(f"""
        insert into auth.users(id) values('{uid}');
        update user_profiles set informal_name='Synthetic',pronouns='elle',
            birth_date='1990-01-01',reason_for_consulting='Synthetic test reason' where user_id='{uid}';
        insert into consents(user_id,consent_version,server_recorded,payload_json)
            values('{uid}','technical-draft-2026-10-11',true,'{{"birthDate":"1990-01-01"}}');
        insert into conversations(id,user_id) values('{cid}','{uid}');
        insert into clinical_sessions(id,user_id,conversation_id) values('{sid}','{uid}','{cid}');
    """)
    token = query(f"select begin_chat_turn('{sid}','{uid}','race','Fictional input',false)->>'token';")
    with ThreadPoolExecutor(max_workers=2) as pool:
        creator = pool.submit(query, f"""
            set application_name='serenia-fence-creator';
            begin;
            set local role service_role;
            select id from create_questionnaire_atomic('{sid}','{uid}','{cid}','PHQ9','Synthetic race','race','{token}');
            select pg_sleep(15);
            commit;
        """)
        wait_for("select count(*) from pg_stat_activity where application_name='serenia-fence-creator' and wait_event='PgSleep';", "1", "creator inserted before commit")
        future = pool.submit(query, f"""
          set application_name='serenia-fence-fail'; set role service_role;
          select fail_chat_turn('{sid}','race','{token}','test');
        """)
        if prototype:
            wait_for("""select count(*) from pg_stat_activity a where a.application_name='serenia-fence-fail'
            and a.wait_event_type='Lock' and exists(select 1 from pg_stat_activity b
              where b.application_name='serenia-fence-creator' and b.pid=any(pg_blocking_pids(a.pid)));""", "1", "fail blocked by creator")
        else:
            future.result(timeout=5)
        snapshot = query(f"""set role authenticated; select set_config('request.jwt.claim.sub','{uid}',false);
          select (get_chat_turn_recovery('{sid}')->>'status') || '|' ||
          (select count(*) from questionnaire_instances where session_id='{sid}');""").splitlines()[-1]
        print('before creator commit=' + snapshot, flush=True)
        expected = 'generating|0' if prototype else 'failed|0'
        if snapshot != expected: raise RuntimeError('Unexpected read during creation: '+snapshot)
        creator.result(timeout=22)
        future.result(timeout=5)
        after = query(f"""set role authenticated; select set_config('request.jwt.claim.sub','{uid}',false);
          select (get_chat_turn_recovery('{sid}')->>'status') || '|' ||
          (select count(*) from questionnaire_instances where session_id='{sid}');""").splitlines()[-1]
        print('after creator commit=' + after, flush=True)
        if after != 'failed|1': raise RuntimeError('Unexpected final state: '+after)
        print('PASS prototype serialization' if prototype else 'REPRODUCED failed before commit then new effect', flush=True)
finally:
    docker("rm", "--force", name)
