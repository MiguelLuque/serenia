#!/usr/bin/env python3
"""Portable PostgreSQL regression harness. No remote URLs, volumes or patient data.

Uses the locally installed postgres:17.6-bookworm image. auth.uid() is a test
shim, not a test of GoTrue/JWT/PostgREST. Each migration is its own transaction.
"""
import argparse
import pathlib
import subprocess
import uuid
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--baseline-security', action='store_true', help='Historical baseline without the two nonportable data operations or hardening migration')
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
        if args.baseline_security and (path.name.startswith('202610') or path.name.startswith('20260502000004') or path.name.startswith('20260502000005')):
            continue
        try:
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
finally:
    docker('rm', '--force', name, check=False)
