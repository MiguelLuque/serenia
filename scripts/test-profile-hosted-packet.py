#!/usr/bin/env python3
"""Atomic profile packet rehearsal on installed PG17, network none, synthetic only.

Only expected metadata is substituted with measured fixture metadata. Production
DDL, guard queries and accepted catalog semantic fingerprints are never rewritten.
This auth.uid shim does not verify hosted JWT, GoTrue, PostgREST or Workflow.
"""
import json
import pathlib
import subprocess
import time
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
NAME = 'serenia-profile-packet-' + uuid.uuid4().hex[:12]
BASELINE = json.loads((ROOT / 'supabase/hosted/profile-baseline-20261030.json').read_text())
SNAPSHOT = (ROOT / 'supabase/hosted/profile-baseline-query.sql').read_text()
PACKET = (ROOT / 'supabase/hosted/profile-atomic.sql').read_text()


def docker(*args, sql=None, check=True):
    result = subprocess.run(['rtk', 'proxy', 'docker', *args], input=sql, text=True, capture_output=True)
    if check and result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return result


def query(sql, check=True):
    return docker('exec', '-i', NAME, 'psql', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', sql=sql, check=check)


def snapshot():
    return json.loads(query(SNAPSHOT).stdout)


def rejected(label, sql, message):
    result = query('begin;\n' + sql + '\ncommit;', check=False)
    assert result.returncode and message in result.stderr, label + ': ' + result.stdout + result.stderr
    assert snapshot() == fixture, label + ': mutation/DDL prefix did not roll back'
    print('PASS reject and atomic rollback: ' + label)


try:
    # --pull never makes the installed/pinned image a prerequisite, not a download.
    docker('run', '--pull', 'never', '--detach', '--rm', '--name', NAME, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data:rw', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17.6-bookworm')
    for _ in range(80):
        if docker('exec', NAME, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', check=False).returncode == 0:
            break
        time.sleep(.25)
    else:
        raise RuntimeError('PG17 did not start')
    query((ROOT / 'supabase/tests/bootstrap.sql').read_text())
    for path in sorted((ROOT / 'supabase/migrations').glob('*.sql')):
        if path.name.startswith('202610'):
            continue
        query('begin;\n' + path.read_text() + '\ncommit;')
    query((ROOT / 'supabase/tests/hosted-platform.sql').read_text())
    for path in sorted((ROOT / 'supabase/migrations').glob('202610*.sql')):
        if path.name[:8] >= '20261028':
            continue
        query('begin;\n' + path.read_text() + '\ncommit;')
    # Known fictitious Auth-only values, never actual hosted users or secrets.
    query("alter table auth.users add column fixture_label text; set role supabase_auth_admin; insert into auth.users(id,fixture_label) values ('00000000-0000-0000-0000-000000000101','fixture-one'),('00000000-0000-0000-0000-000000000102','fixture-two'),('00000000-0000-0000-0000-000000000103','fixture-three'); reset role;")
    query('create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text,name text,statements text[]);')
    for entry in BASELINE['history']:
        query("insert into supabase_migrations.schema_migrations values ('" + entry['version'] + "','" + entry['name'] + "',array['known synthetic fixture']);")
    fixture = snapshot()
    assert fixture['catalog'] == BASELINE['catalog'], 'Actual catalog semantic hashes differ'
    assert fixture['counts'] == BASELINE['counts']
    assert fixture['clinicalCounts'] == BASELINE['clinicalCounts']
    assert fixture['tableNames'] == BASELINE['tableNames']
    assert fixture['routineSignatures'] == BASELINE['routineSignatures']
    # ONLY expected metadata changes: bootstrap has one event trigger, auth shim,
    # synthetic history SQL and different historical sources. No guard/DDL rewrite.
    measured = {**BASELINE, **fixture}
    expected_json = json.dumps(BASELINE, separators=(',', ':'), ensure_ascii=False)
    fixture_json = json.dumps(measured, separators=(',', ':'), ensure_ascii=False)
    assert PACKET.count(expected_json) == 1
    packet = PACKET.replace(expected_json, fixture_json)
    assert packet.count(fixture_json) == 1
    print('PASS fixture catalog semantics/counts/table and routine identities equal official baseline; expected metadata substituted only')
    query('begin;\n' + packet + '\nrollback;')
    assert snapshot() == fixture
    print('PASS full exact-source packet normal rehearsal and rollback')

    before_probes = [
        ('foreign table', 'create table public.foreign_profile_drift(id integer);', 'Profile old table baseline changed'),
        ('profile object', 'create function public.get_profile_memory() returns jsonb language sql as $$select null::jsonb$$;', 'Profile old routine baseline changed'),
        ('excluded constraint collision', 'alter table public.messages add constraint profile_source_identity unique(id,session_id,conversation_id,created_at);', 'Profile added object already exists'),
        ('excluded trigger collision', 'create trigger enqueue_profile_source after insert on public.messages for each row execute function public.require_open_message_session();', 'Profile added object already exists'),
        ('excluded other-table constraint collision', 'alter table public.user_profiles add constraint profile_source_identity unique(id);', 'Profile added object already exists'),
        ('excluded other-table trigger collision', 'create trigger enqueue_profile_source after insert on public.user_profiles for each row execute function public.require_open_message_session();', 'Profile added object already exists'),
        ('event unfiltered', 'drop event trigger ensure_rls; create event trigger ensure_rls on ddl_command_end execute function public.rls_auto_enable();', 'Profile platform baseline changed'),
        ('event tags', "drop event trigger ensure_rls; create event trigger ensure_rls on ddl_command_end when tag in ('CREATE TABLE','CREATE TABLE AS') execute function public.rls_auto_enable();", 'Profile platform baseline changed'),
        ('event disabled', 'alter event trigger ensure_rls disable;', 'Profile platform baseline changed'),
        ('event function', 'create function public.fixture_event() returns event_trigger language plpgsql as $$begin return; end$$; drop event trigger ensure_rls; create event trigger ensure_rls on ddl_command_end execute function public.fixture_event();', 'Profile platform baseline changed'),
        ('platform routine source', 'create or replace function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path=pg_catalog as $$begin return; end$$;', 'Profile platform baseline changed'),
        ('Auth trigger disabled', 'alter table auth.users disable trigger on_auth_user_created;', 'Profile platform baseline changed'),
        ('old column', 'alter table public.user_profiles add column unexpected text;', 'Profile old table baseline changed'),
        ('old constraint', "alter table public.user_profiles add constraint fixture_guard check (informal_name is distinct from 'forbidden');", 'Profile old table baseline changed'),
        ('old table ACL', 'grant update on public.messages to anon;', 'Profile old table baseline changed'),
        ('old RLS', 'alter table public.messages disable row level security;', 'Profile old table baseline changed'),
        ('old routine ACL', 'grant execute on function public.handle_new_auth_user() to anon;', 'Profile old routine baseline changed'),
        ('old routine source', 'create or replace function public.set_updated_at() returns trigger language plpgsql as $$begin return new; end$$;', 'Profile old routine baseline changed'),
        ('same-count history', "update supabase_migrations.schema_migrations set statements=array['changed'] where version='20260419000001';", 'Profile history baseline changed'),
        ('same-count catalog prompt', "update public.questionnaire_items set prompt='Unexpected fixture drift' where id=(select id from public.questionnaire_items limit 1);", 'Profile catalog baseline changed'),
        ('same-count catalog score', "update public.questionnaire_definitions set scoring_strategy='unexpected-fixture-strategy' where code='PHQ9';", 'Profile catalog baseline changed'),
        ('clinical row', "insert into public.conversations(id,user_id) values('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000101');", 'Profile clinical baseline changed'),
        ('Auth count', "set role supabase_auth_admin; insert into auth.users(id) values('00000000-0000-0000-0000-000000000104'); reset role;", 'Profile counts baseline changed'),
    ]
    for label, mutation, message in before_probes:
        rejected(label, mutation + '\n' + packet, message)
    marker = '-- PROFILE PRESERVATION CHECK: no row transformation is authorized.'
    for label, mutation in [
        ('Auth preservation', "update auth.users set fixture_label='unexpected';"),
        ('profile preservation', "update public.user_profiles set informal_name='unexpected';"),
        ('catalog preservation', "update public.questionnaire_items set prompt='unexpected';"),
    ]:
        rejected(label, packet.replace(marker, mutation + '\n' + marker), 'Profile account/catalog preservation failed')
    for label, mutation, message in [
        ('post old schema', 'alter table public.messages add column unexpected text;', 'Profile old table preservation failed'),
        ('post history', "update supabase_migrations.schema_migrations set name='changed' where version='20260419000001';", 'Profile history preservation failed'),
        ('post platform', 'alter event trigger ensure_rls disable;', 'Profile platform preservation failed'),
        ('post new table ACL', 'grant insert on profile_settings to authenticated;', 'Profile table ACL mismatch'),
        ('post new RPC ACL', 'grant execute on function public.claim_profile_jobs(uuid,integer) to authenticated;', 'Profile function ACL mismatch'),
        ('post custom 40001', "create or replace function public.start_profile_job(p_job_id uuid,p_token uuid) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$begin raise exception 'drift' using errcode='40001'; end$$;", 'Profile function security/source mismatch'),
        ('post new RPC body', "create or replace function public.start_profile_job(p_job_id uuid,p_token uuid) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$begin return false; end$$;", 'Profile new object metadata mismatch'),
        ('post owner policy', 'alter policy profile_observations_owner on public.profile_observations using (true);', 'Profile new object metadata mismatch'),
        ('post message binding', 'alter table public.messages disable trigger enqueue_profile_source;', 'Profile message additions missing'),
        ('post excluded-name collision', 'create trigger enqueue_profile_source after insert on public.user_profiles for each row execute function public.require_open_message_session();', 'Profile excluded-name collision'),
    ]:
        rejected(label, packet.replace(marker, mutation + '\n' + marker), message)
    query('begin;\n' + packet + '\ncommit;')
    print('PASS exact-source packet committed locally; history still 43, all 3 profile tables empty')
    query("""do $$ declare routine text; role_name text; begin
      foreach routine in array array['public.handle_new_auth_user()','public.rls_auto_enable()'] loop
        foreach role_name in array array['anon','authenticated'] loop
          if has_function_privilege(role_name,routine,'EXECUTE') then raise exception 'Client trigger EXECUTE'; end if;
        end loop;
        foreach role_name in array array['postgres','supabase_admin','supabase_auth_admin','service_role'] loop
          if not has_function_privilege(role_name,routine,'EXECUTE') then raise exception 'Platform trigger EXECUTE missing'; end if;
        end loop;
      end loop;
    end $$;
    set role supabase_auth_admin;
    insert into auth.users(id) values('00000000-0000-0000-0000-000000000104');
    reset role;
    set role supabase_admin; create table public.fixture_admin_scratch(id integer); reset role;
    do $$ begin
      if not exists(select 1 from public.user_profiles where user_id='00000000-0000-0000-0000-000000000104' and role='patient' and onboarding_status='pending') then raise exception 'Signup failed'; end if;
      if not (select relrowsecurity from pg_class where oid='public.fixture_admin_scratch'::regclass) then raise exception 'Platform RLS failed'; end if;
      if (select count(*) from public.profile_settings)<>0 then raise exception 'Settings were auto-filled'; end if;
    end $$;
    set role authenticated;
    set request.jwt.claim.sub='00000000-0000-0000-0000-000000000101';
    do $$ begin
      if (public.get_profile_memory()->>'enabled')::boolean then raise exception 'Unexpected opt-in'; end if;
      if jsonb_array_length(public.get_profile_memory()->'observations')<>0 then raise exception 'Unexpected observations'; end if;
    end $$;
    reset role;
    do $$ begin if (select count(*) from public.profile_settings)<>0 then raise exception 'Read auto-filled settings'; end if; end $$;
    """)
    print('PASS signup/platform RLS and effective six-role ACLs; owner reads empty/default-disabled without settings autofill')
    print('LIMIT: synthetic expected history/platform/old metadata only; no hosted JWT/PostgREST/Workflow or remote apply verified')
finally:
    docker('rm', '--force', NAME, check=False)
