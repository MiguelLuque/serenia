#!/usr/bin/env python3
"""Dashboard delivery rehearsal on isolated PostgreSQL 17 with synthetic rows only."""
import hashlib
import json
import pathlib
import subprocess
import time
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
NAME = 'serenia-profile-dashboard-' + uuid.uuid4().hex[:12]
VERSION = '20261102122007'
PACKET = (ROOT / 'supabase/hosted/profile-atomic.sql').read_text()
BASELINE = json.loads((ROOT / 'supabase/hosted/profile-baseline-20261101.json').read_text())
SNAPSHOT = (ROOT / 'supabase/hosted/profile-baseline-query.sql').read_text()
NEW_OBJECTS_QUERY = (ROOT / 'supabase/hosted/profile-new-objects-query.sql').read_text()
NEW_OBJECTS = json.loads((ROOT / 'supabase/hosted/profile-new-objects.json').read_text())


def sha(text):
    return hashlib.sha256(text.encode()).hexdigest()


def docker(*args, sql=None, check=True):
    result = subprocess.run(['rtk', 'proxy', 'docker', *args], input=sql, text=True, capture_output=True)
    if check and result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return result


def query(sql, check=True):
    return docker('exec', '-i', NAME, 'psql', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', sql=sql, check=check)


def snapshot():
    return json.loads(query('set search_path=public,extensions;\n' + SNAPSHOT).stdout)


def row_digests():
    relations = ['auth.users'] + ['public.' + name for name in BASELINE['tableNames']]
    parts = []
    for relation in relations:
        schema, name = relation.split('.')
        quoted = '"' + schema.replace('"', '""') + '"."' + name.replace('"', '""') + '"'
        parts.append("select '" + relation + "' relation_name, md5(coalesce(string_agg(to_jsonb(t)::text, '' order by to_jsonb(t)::text),'')) digest from " + quoted + ' t')
    sql = 'select jsonb_object_agg(relation_name, digest) from (' + ' union all '.join(parts) + ') s;'
    return json.loads(query(sql).stdout)


def fixture_setup():
    query((ROOT / 'supabase/tests/bootstrap.sql').read_text())
    for path in sorted((ROOT / 'supabase/migrations').glob('*.sql')):
        if path.name[:6] >= '202610':
            continue
        query('begin;\n' + path.read_text() + '\ncommit;')
    query((ROOT / 'supabase/tests/hosted-platform.sql').read_text())
    for path in sorted((ROOT / 'supabase/migrations').glob('202610*.sql')):
        if path.name[:8] >= '20261028':
            continue
        query('begin;\n' + path.read_text() + '\ncommit;')
    query('create schema extensions;')
    for event in BASELINE['platform']['eventTriggers']:
        if event['name'] == 'ensure_rls':
            continue
        function_name = event['function'].split('.')[-1].removesuffix('()')
        tags = '' if event['tags'] is None else ' when tag in (' + ','.join("'" + tag + "'" for tag in event['tags']) + ')'
        query('create function extensions.' + function_name + '() returns event_trigger language plpgsql as $$begin return; end$$; '
              'alter function extensions.' + function_name + '() owner to supabase_admin; '
              'create event trigger ' + event['name'] + ' on ' + event['event'] + tags + ' execute function extensions.' + function_name + '(); '
              'alter event trigger ' + event['name'] + ' owner to supabase_admin;')
    query("alter table auth.users add column fixture_label text; set role supabase_auth_admin; insert into auth.users(id,fixture_label) values ('00000000-0000-0000-0000-000000000101','fixture-one'),('00000000-0000-0000-0000-000000000102','fixture-two'),('00000000-0000-0000-0000-000000000103','fixture-three'); reset role;")
    query('create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);')
    for entry in BASELINE['history']:
        query("insert into supabase_migrations.schema_migrations values ('" + entry['version'] + "','" + entry['name'] + "',array['known synthetic fixture']);")


assert sha(PACKET) == '313b31b1c06bbe461313a81af9ff0f18fe0cd0a1882ee66ac8013c2ffc05e04a'
assert len(PACKET.encode()) == 81693
assert VERSION > max([x['version'] for x in BASELINE['history']] + [p.name[:14] for p in (ROOT / 'supabase/migrations').glob('*.sql')])
assert VERSION not in {x['version'] for x in BASELINE['history']}
subprocess.run(['rtk', 'proxy', 'node', 'scripts/profile-dashboard-packet.mjs'], cwd=ROOT, check=True, capture_output=True, text=True)
WRAPPER_PATH = ROOT / 'supabase/hosted/profile-dashboard-20261102.sql'
MANIFEST = json.loads((ROOT / 'supabase/hosted/profile-dashboard-20261102.json').read_text())
WRAPPER = WRAPPER_PATH.read_text()
assert MANIFEST['status'] == 'PREPARED_NOT_APPLIED'
assert MANIFEST['version'] == VERSION
assert MANIFEST['packetSha256'] == sha(PACKET)
assert MANIFEST['wrapperSha256'] == sha(WRAPPER)
assert MANIFEST['wrapperBytes'] == len(WRAPPER.encode())
assert WRAPPER.count(PACKET) == 2, 'exact executable and stored packet required'
assert WRAPPER.startswith('BEGIN;\nSET LOCAL transaction_timeout = \'50s\';\n')
assert WRAPPER.rstrip().endswith('COMMIT;')
print('PASS generated wrapper pins original packet twice, version and bytes')

try:
    docker('run', '--pull', 'never', '--detach', '--rm', '--name', NAME, '--network', 'none', '--tmpfs', '/var/lib/postgresql/data:rw', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17.6-bookworm')
    for _ in range(80):
        if docker('exec', NAME, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', check=False).returncode == 0:
            break
        time.sleep(.25)
    else:
        raise RuntimeError('PG17 did not start')
    fixture_setup()
    before = snapshot()
    assert before['catalog'] == BASELINE['catalog'] and before['counts'] == BASELINE['counts']
    assert before['clinicalCounts'] == BASELINE['clinicalCounts']
    rows_before = row_digests()
    baseline_json = json.dumps(BASELINE, separators=(',', ':'), ensure_ascii=False)
    fixture_packet = PACKET.replace(baseline_json, json.dumps({**BASELINE, **before}, separators=(',', ':'), ensure_ascii=False))
    assert fixture_packet != PACKET
    fixture_wrapper = WRAPPER.replace(baseline_json, json.dumps({**BASELINE, **before}, separators=(',', ':'), ensure_ascii=False))
    assert fixture_wrapper.count(fixture_packet) == 2
    fixture_wrapper = fixture_wrapper.replace(sha(PACKET), sha(fixture_packet)).replace(str(len(PACKET.encode())), str(len(fixture_packet.encode())))

    def rejected(label, script, expected):
        result = query(script, check=False)
        assert result.returncode and expected in result.stderr, label + ': ' + result.stdout + result.stderr
        assert snapshot() == before, label + ': schema/history changed'
        assert row_digests() == rows_before, label + ': existing row changed'
        print('PASS atomic rollback: ' + label)

    rejected('history insert collision', fixture_wrapper.replace("'" + VERSION + "'", "'20260419000001'", 1), 'duplicate key')
    rejected('post-insert assertion', fixture_wrapper.replace('-- DASHBOARD HISTORY ASSERT', 'select 1/0;\n-- DASHBOARD HISTORY ASSERT', 1), 'division by zero')
    query(fixture_wrapper)
    after = snapshot()
    assert len(after['history']) == 44
    assert after['history'][:43] == before['history']
    assert row_digests() == rows_before
    assert after['catalog'] == before['catalog'] and after['counts'] == before['counts']
    assert after['clinicalCounts'] == before['clinicalCounts']
    assert after['profileObjectsAbsent'] is False
    assert json.loads(query(NEW_OBJECTS_QUERY).stdout) == NEW_OBJECTS
    registration = json.loads(query("select jsonb_build_object('version',version,'name',name,'length',octet_length(statements[1]),'sha',encode(sha256(convert_to(statements[1],'UTF8')),'hex'),'elements',cardinality(statements)) from supabase_migrations.schema_migrations where version='" + VERSION + "';").stdout)
    assert registration == {'version': VERSION, 'name': 'serenia_progressive_profile_review', 'length': len(fixture_packet.encode()), 'sha': sha(fixture_packet), 'elements': 1}
    print('PASS one atomic commit: 44 history, exact stored packet, new metadata and old rows preserved')
    repeated = query(fixture_wrapper, check=False)
    assert repeated.returncode and 'Profile history baseline changed' in repeated.stderr
    assert snapshot() == after
    print('PASS repeat rejected with committed state unchanged')
    print('LIMIT synthetic auth/platform/history fixture; hosted SQL Editor and migration replay unverified')
finally:
    docker('rm', '--force', NAME, check=False)
