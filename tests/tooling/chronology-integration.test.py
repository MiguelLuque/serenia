#!/usr/bin/env python3
"""Dashboard delivery rehearsal on isolated PostgreSQL 17 with synthetic rows only."""
import hashlib
import json
import pathlib
import subprocess
import time
from chronology_local_docker import LocalDocker
if not __debug__: raise RuntimeError('Chronology rehearsal requires assertions')

ROOT = pathlib.Path(__file__).resolve().parents[2]
NAME = None
runtime = None
VERSION = '20261102122007'
PACKET = (ROOT / 'supabase/hosted/profile-atomic.sql').read_text()
BASELINE = json.loads((ROOT / 'supabase/hosted/profile-baseline-20261101.json').read_text())
SNAPSHOT = (ROOT / 'supabase/hosted/profile-baseline-query.sql').read_text()
NEW_OBJECTS_QUERY = (ROOT / 'supabase/hosted/profile-new-objects-query.sql').read_text()
NEW_OBJECTS = json.loads((ROOT / 'supabase/hosted/profile-new-objects.json').read_text())


def sha(text):
    return hashlib.sha256(text.encode()).hexdigest()


def wait_process(process, timeout):
    try:
        return process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        raise RuntimeError('Synthetic Docker client timed out') from None


def docker(*args, sql=None, check=True):
    return runtime.command(*args, sql=sql, check=check)


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

runtime = LocalDocker()
NAME = runtime.name
try:
    runtime.start()
    NAME = runtime.container_id
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

    import hashlib
    import select
    chronology_source = (ROOT / 'supabase/migrations/20261101104931_assessment_observed_chronology.sql').read_text()
    chronology = (ROOT / 'supabase/hosted/chronology-dashboard-20261102.sql').read_text()
    old_history_json = json.dumps(BASELINE['history'], ensure_ascii=False, separators=(',', ':'))
    fixture_history_json = json.dumps(before['history'], ensure_ascii=False, separators=(',', ':'))
    assert chronology.count(old_history_json) == 2
    chronology = chronology.replace(old_history_json, fixture_history_json)
    chronology = chronology.replace(sha(PACKET), sha(fixture_packet)).replace('81693', str(len(fixture_packet.encode())))
    query("insert into public.profile_settings(user_id,enabled,consent_epoch) values ('00000000-0000-0000-0000-000000000101',true,1);")
    def profile_digests():
        parts = ["select '" + name + "' name, md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) digest from public." + name + ' t' for name in ('profile_settings','profile_extraction_jobs','profile_observations')]
        return json.loads(query('select jsonb_object_agg(name,digest) from (' + ' union all '.join(parts) + ') s;').stdout)
    profile_before = profile_digests()
    def chronology_rejected(label, script, expected):
        result = query(script, check=False)
        assert result.returncode and expected in result.stderr, label + ': ' + result.stdout + result.stderr
        assert snapshot() == after, label + ': snapshot changed'
        assert row_digests() == rows_before, label + ': old rows changed'
        assert profile_digests() == profile_before, label + ': profile rows changed'
        print('PASS chronology rollback: ' + label)
    lock_command = 'LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE;'
    assert chronology.count(lock_command) == 1
    lock_probe = chronology.replace(lock_command, lock_command + "\nSELECT 'WRAPPER_LOCKED';\nSELECT pg_sleep(2);\nSELECT 1/0;", 1)
    process = runtime.interactive('exec', '-i', NAME, 'psql', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres')
    try:
        process.stdin.write(lock_probe)
        process.stdin.close()
        ready, _, _ = select.select([process.stdout], [], [], 10)
        assert ready and process.stdout.readline().strip() == 'WRAPPER_LOCKED', 'wrapper did not acquire lock'
        concurrent = query("SET lock_timeout='250ms'; INSERT INTO supabase_migrations.schema_migrations VALUES ('99999999999999','concurrent',array['fixture']);", check=False)
        assert concurrent.returncode and 'lock timeout' in concurrent.stderr
        assert wait_process(process, 10) != 0
        assert snapshot() == after and row_digests() == rows_before and profile_digests() == profile_before
        print('PASS concurrent writer blocked until chronology transaction rollback')
    finally:
        runtime.finish(process)
    broken_payload = chronology.replace(chronology_source, chronology_source + '\n-- mutated payload\n', 1)
    assert broken_payload != chronology
    chronology_rejected('tampered payload', broken_payload, 'Chronology payload identity mismatch')
    race_marker = 'end;\n$guard$;\ncreate or replace function'
    assert chronology_source.count(race_marker) == 1
    race_source = chronology_source.replace(race_marker, 'end;\n$guard$;\nselect pg_advisory_xact_lock(91361422);\ncreate or replace function', 1)
    race = chronology.replace(chronology_source, race_source, 1)
    race = race.replace(hashlib.sha256(chronology_source.encode()).hexdigest(), hashlib.sha256(race_source.encode()).hexdigest()).replace('7215', str(len(race_source.encode())))
    race = race.replace('END $apply_chronology$;', "END $apply_chronology$;\nSELECT CASE WHEN (SELECT prosecdef FROM pg_proc WHERE oid=to_regprocedure('public.get_clinician_inbox_page(integer,integer,boolean)')) THEN 'RACE_OVERWROTE' ELSE 'RACE_NOT_OVERWRITTEN' END;\nSELECT 1/0;", 1)
    holder = runtime.interactive('exec', '-i', NAME, 'psql', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres')
    writer = None
    try:
        holder.stdin.write("BEGIN; DO $$BEGIN PERFORM pg_advisory_xact_lock(91361422); END$$; SELECT 'HOLDER_READY';\n")
        holder.stdin.flush()
        ready, _, _ = select.select([holder.stdout], [], [], 10)
        assert ready and holder.stdout.readline().strip() == 'HOLDER_READY'
        writer = runtime.interactive('exec', '-i', NAME, 'psql', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres')
        writer.stdin.write(race)
        writer.stdin.close()
        waiting = False
        for _ in range(50):
            if query("select count(*) from pg_locks where locktype='advisory' and not granted").stdout.strip() == '1':
                waiting = True
                break
            time.sleep(.1)
        assert waiting, 'chronology did not reach deterministic barrier'
        altered = query("SET lock_timeout='1s'; ALTER FUNCTION public.get_clinician_inbox_page(integer,integer,boolean) SECURITY INVOKER;", check=False)
        holder.stdin.write('ROLLBACK;\n\\q\n')
        holder.stdin.flush()
        assert wait_process(writer, 10) != 0
        output = writer.stdout.read()
        if altered.returncode == 0:
            assert 'RACE_OVERWROTE' in output, output
            query('ALTER FUNCTION public.get_clinician_inbox_page(integer,integer,boolean) SECURITY DEFINER;')
            print('OBSERVED direct DDL can be overwritten after chronology guard; isolated rollback and restore')
        else:
            assert 'lock timeout' in altered.stderr, altered.stderr
            print('OBSERVED direct DDL blocked by PostgreSQL lock in this fixture')
        assert snapshot() == after and row_digests() == rows_before and profile_digests() == profile_before
    finally:
        for proc in (writer, holder):
            if proc is not None:
                runtime.finish(proc)
    collision = chronology.replace("SELECT '20261102122008','serenia_assessment_chronology_review'", "SELECT '20260419000001','serenia_assessment_chronology_review'")
    assert collision != chronology
    chronology_rejected('history insert collision', collision, 'duplicate key')
    broken_post = chronology.replace('-- CHRONOLOGY POST INSERT ASSERT', 'select 1/0;\n-- CHRONOLOGY POST INSERT ASSERT')
    chronology_rejected('post-insert failure', broken_post, 'division by zero')
    query(chronology)
    final = snapshot()
    assert len(final['history']) == 45 and final['history'][:44] == after['history']
    assert row_digests() == rows_before and profile_digests() == profile_before
    registration = json.loads(query("select jsonb_build_object('name',name,'length',octet_length(statements[1]),'sha',encode(sha256(convert_to(statements[1],'UTF8')),'hex'),'elements',cardinality(statements)) from supabase_migrations.schema_migrations where version='20261102122008';").stdout)
    assert registration == {'name': 'serenia_assessment_chronology_review', 'length': len(chronology_source.encode()), 'sha': hashlib.sha256(chronology_source.encode()).hexdigest(), 'elements': 1}
    assert query("select md5(prosrc) from pg_proc where oid=to_regprocedure('public.get_clinician_inbox_page(integer,integer,boolean)')").stdout.strip() == '9a5b7e54043035a657de3500907dcc84'
    generated_query = subprocess.run(['node',str(ROOT / 'scripts/chronology-hosted-readback.mjs'),'query'],check=True,capture_output=True,text=True,timeout=15,env=runtime.env).stdout
    receipt = json.loads(query(generated_query).stdout)
    assert receipt['historyCount'] == 45 and receipt['chronologyRows'][0]['statementSha256'] == hashlib.sha256(chronology_source.encode()).hexdigest()
    assert receipt['chronologyFunction']['definitionMd5'] == '8655ff635e6e3072366bd6625f51f755'
    print('PASS generated 45-row readback SQL executes on synthetic committed state')
    assert receipt['oldHistory'] == before['history']
    assert receipt['snapshot']['history'][:44] == after['history']
    assert receipt['snapshot']['history'][44] == {'version':'20261102122008','name':'serenia_assessment_chronology_review','statements_md5':hashlib.md5(chronology_source.encode()).hexdigest()}
    assert receipt['proposalRows'][0]['statementSha256'] == sha(fixture_packet)
    assert receipt['proposalRows'][0]['statementBytes'] == len(fixture_packet.encode())
    for key in ('catalog','tableNames','tableFingerprint','routineSignatures','routineFingerprint','platform','counts','clinicalCounts'):
        assert receipt['snapshot'][key] == before[key], 'synthetic pre/post metadata drift: ' + key
    assert receipt['newObjects'] == NEW_OBJECTS
    assert receipt['newTableCounts'] == {'profile_settings': 1, 'profile_extraction_jobs': 0, 'profile_observations': 0}
    # Substitute only checked, intentional synthetic baseline differences so the real
    # SQL output can be passed through the verifier's pinned hosted expectations.
    receipt['oldHistory'] = BASELINE['history']
    receipt['proposalRows'][0]['statementBytes'] = len(PACKET.encode())
    receipt['proposalRows'][0]['statementSha256'] = sha(PACKET)
    receipt['snapshot']['history'] = BASELINE['history'] + [
        {'version':'20261102122007','name':'serenia_progressive_profile_review','statements_md5':hashlib.md5(PACKET.encode()).hexdigest()},
        {'version':'20261102122008','name':'serenia_assessment_chronology_review','statements_md5':hashlib.md5(chronology_source.encode()).hexdigest()}]
    for key in ('catalog','tableNames','tableFingerprint','routineSignatures','routineFingerprint','platform','counts','clinicalCounts'):
        receipt['snapshot'][key] = BASELINE[key]
    receipt['newTableCounts']['profile_settings'] = 0
    import tempfile
    with tempfile.TemporaryDirectory(prefix='serenia-chronology-receipt-') as td:
        receipt_path = pathlib.Path(td) / 'receipt.json'
        def verify_real_receipt(value):
            receipt_path.write_text(json.dumps(value))
            return subprocess.run(['node',str(ROOT / 'scripts/chronology-hosted-readback.mjs'),'verify',str(receipt_path)],capture_output=True,text=True,timeout=15,env=runtime.env)
        verified = verify_real_receipt(receipt)
        assert verified.returncode == 0, verified.stdout + verified.stderr
        for field in ('chronologyRows','chronologyFunction','tableAcl'):
            mutated = json.loads(json.dumps(receipt))
            if field == 'chronologyRows': mutated[field][0]['statementSha256'] = '0'*64
            elif field == 'chronologyFunction': mutated[field]['securityDefiner'] = False
            else: mutated[field][0]['allowed'] = not mutated[field][0]['allowed']
            assert verify_real_receipt(mutated).returncode != 0
    print('PASS SQL->JSON->verifier on synthetic output with checked baseline substitutions; mutations rejected')
    assert query(chronology, check=False).returncode
    assert snapshot() == final and row_digests() == rows_before and profile_digests() == profile_before
    print('PASS chronology atomic commit, payload registration, function contract and repeat rejection')
    print('LIMIT local synthetic rehearsal; SQL Editor, hosted execution and history replay unverified')

finally:
    runtime.cleanup()
