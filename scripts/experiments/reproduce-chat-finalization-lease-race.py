#!/usr/bin/env python3
"""Reproduce known finish/close lease bugs or test a limited local prototype.

The default succeeds on reproducing the defect. The prototype is confined to a
disposable database and is not a complete correction or post-fix regression.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from difflib import unified_diff
import os
import subprocess
import sys
import time
import uuid

if len(sys.argv) not in (2, 3) or sys.argv[1] not in ("finish", "close") or sys.argv[2:] not in ([], ["--prototype"]):
    raise SystemExit("Usage: reproduce-chat-finalization-lease-race.py finish|close [--prototype]")
root = Path(__file__).resolve().parents[2]
mode = sys.argv[1]
prototype = "--prototype" in sys.argv[2:]
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

def replace_once(text, old, new):
    if text.count(old) != 1:
        raise RuntimeError("Unexpected baseline fragment: " + old)
    return text.replace(old, new, 1)

def load_function(migration, signature, type_signature):
    source = (root / "supabase/migrations" / migration).read_text()
    start = source.index(f"function {signature}(")
    header_start = source.rindex("create", 0, start)
    end = source.index("$$;", source.index("$$", start) + 2) + 3
    ddl = source[header_start:end]
    body = ddl.split("$$")[1]
    routine = f"public.{signature}({type_signature})"
    where = f"where oid='{routine}'::regprocedure"
    actual = query("select encode(convert_to(prosrc, 'UTF8'), 'hex') from pg_proc " + where)
    if actual != body.encode().hex():
        raise RuntimeError(f"Installed body differs from migration for {routine}")
    return ddl, where

def verify_and_install():
    for migration, name, types in (
        ("20261010123627_robust_chat_questionnaires_recovery.sql", "finish_chat_turn", "uuid,text,uuid,jsonb,jsonb,text,text"),
        ("20261012083833_acceptance_strict_function_lint.sql", "close_chat_turn", "uuid,text,uuid,text"),
    ):
        baseline, where = load_function(migration, name, types)
        print(f"Exact baseline body verified: {name}", flush=True)
        if not prototype:
            continue
        if name == "finish_chat_turn":
            patched = replace_once(baseline, "create function ", "create or replace function ")
            patched = replace_once(patched, "t.lease_until<now()", "t.lease_until<=clock_timestamp()")
        else:
            patched = replace_once(baseline,
                "and token=p_token and status='generating' and lease_until>now() for update;",
                "and token=p_token for update;")
            patched = replace_once(patched, "if not found then raise exception 'Stale turn owner'",
                "if not found or t.status<>'generating' or t.lease_until<=clock_timestamp() then raise exception 'Stale turn owner'")
        metadata = "select (to_jsonb(pg_proc)-'prosrc')::text from pg_proc " + where
        before = query(metadata)
        query(patched)
        if query(metadata) != before:
            raise RuntimeError(f"Routine metadata or permissions changed for {name}")
        print("".join(unified_diff(baseline.splitlines(True), patched.splitlines(True),
                                  fromfile=f"{name} baseline", tofile=f"{name} prototype")), flush=True)

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
    verify_and_install()
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
    if mode == "close":
        previous = query(f"select begin_chat_turn('{sid}','{uid}','prior','Fictional prior',false)->>'token';")
        query(f"""
            select finish_chat_turn('{sid}','prior','{previous}',
                '[{{"type":"text","text":"Fictional close proposal"}}]','[]','user_request');
        """)
    token = query(f"select begin_chat_turn('{sid}','{uid}','lease-race','Sí',false)->>'token';")
    if mode == "finish":
        operation = f"""select finish_chat_turn('{sid}','lease-race','{token}',
            '[{{"type":"text","text":"Fictional final response"}}]','[]');"""
    else:
        operation = f"select 'close_authorized=' || close_chat_turn('{sid}','lease-race','{token}','user_request');"
    lock_target = os.environ.get("SERENIA_LEASE_RACE_LOCK", "session")
    if lock_target not in ("session", "turn"):
        raise ValueError("Expected session or turn lock target")
    lock_query = (f"select id from clinical_sessions where id='{sid}' for update;"
                  if lock_target == "session" else
                  f"select request_id from chat_turns where session_id='{sid}' and request_id='lease-race' for update;")
    if lock_target == "turn":
        deadline = query(f"""
            update chat_turns set lease_until=clock_timestamp()+interval '8 seconds'
            where session_id='{sid}' and request_id='lease-race' returning lease_until;
        """)
    with ThreadPoolExecutor(max_workers=2) as pool:
        blocker = pool.submit(query, f"""
            set application_name='lease-race-blocker';
            begin;
            {lock_query}
            select pg_sleep(25);
            rollback;
        """, False)
        try:
            wait_for("select count(*) from pg_stat_activity where application_name='lease-race-blocker' and wait_event='PgSleep';", "1", "session lock")
            if lock_target == "session":
                deadline = query(f"""
                update chat_turns set lease_until=clock_timestamp()+interval '8 seconds'
                where session_id='{sid}' and request_id='lease-race' returning lease_until;
            """)
            worker = pool.submit(docker, "exec", "-i", name, "psql", "-XAtq", "-v", "ON_ERROR_STOP=1", "-U", "postgres", check=False, sql=f"""
                set application_name='lease-race-worker';
                \\set VERBOSITY verbose
                begin;
                select 'worker_tx_started=' || now();
                set local role service_role;
                {operation}
                select 'worker_after_call=' || clock_timestamp();
                commit;
            """)
            wait_for(f"""
                select count(*) from pg_stat_activity a join chat_turns t on t.session_id='{sid}'
                where a.application_name='lease-race-worker' and a.wait_event_type='Lock'
                  and t.request_id='lease-race' and a.xact_start<t.lease_until
                  and t.lease_until>clock_timestamp()
                  and exists(select 1 from pg_stat_activity b
                    where b.application_name='lease-race-blocker' and b.pid=any(pg_blocking_pids(a.pid)));
            """, "1", "worker blocked before expiry")
            print(f"Observed worker blocked by {lock_target} lock while lease was live", flush=True)
            wait_for(f"select clock_timestamp()>'{deadline}'::timestamptz;", "t", "real clock crossed lease")
            print(f"lease_until={deadline}", flush=True)
        finally:
            query("select pg_cancel_backend(pid) from pg_stat_activity where application_name='lease-race-blocker';")
            blocker.result()
        result = worker.result()
        output = result.stdout
        print(output.strip(), flush=True)
        if result.stderr:
            print(result.stderr.strip(), flush=True)
    persisted = query(f"""
        select t.status || '|' || s.status || '|' ||
            (select count(*) from messages where session_id=s.id and role='assistant'
              and parts @> '[{{"type":"text","text":"Fictional final response"}}]'::jsonb)
        from chat_turns t join clinical_sessions s on s.id=t.session_id
        where t.session_id='{sid}' and t.request_id='lease-race';
    """)
    print(f"persisted_turn_session_assistant={persisted}", flush=True)
    if prototype:
        message = "Expired turn" if mode == "finish" else "Stale turn owner"
        if result.returncode == 0 or f"42501: {message}" not in result.stderr or persisted != "generating|open|0":
            raise RuntimeError(f"Expected {mode} to reject an expired lease without changes")
        print(f"PASS: {mode} rejected after lease expiry.")
    else:
        if result.returncode:
            raise RuntimeError("Control RPC unexpectedly failed")
        if mode == "finish" and persisted != "completed|open|1":
            raise RuntimeError("Expected the late finish to commit its assistant message")
        if mode == "close" and ("close_authorized=true" not in output or persisted != "generating|open|0"):
            raise RuntimeError("Expected stale close authorization without a write")
        print(f"REPRODUCED: {mode} accepted after lease expiry.")
finally:
    docker("rm", "--force", name)
