#!/usr/bin/env python3
"""Experimental chronology wrapper, local rehearsal only; never executes SQL."""
import hashlib
import json
import sys
from pathlib import Path

if len(sys.argv) != 1:
    raise ValueError('No target or argument overrides are allowed')
root = Path(__file__).resolve().parents[1]
out = root / 'supabase/hosted'
inputs = [root / 'supabase', root / 'supabase/migrations', out,
          root / 'supabase/migrations/20261101104931_assessment_observed_chronology.sql',
          out / 'profile-baseline-20261101.json', out / 'profile-dashboard-20261102.json',
          out / 'profile-manifest.json', out / 'profile-new-objects.json',
          out / 'profile-new-objects-query.sql', out / 'chronology-readback-20261102.sql']
for path in inputs:
    if path.is_symlink() or not path.exists():
        raise ValueError('Unexpected chronology input path')
for path in (out / 'chronology-dashboard-20261102.sql', out / 'chronology-dashboard-20261102.json'):
    if path.is_symlink():
        raise ValueError('Unexpected chronology output path')
source_path = root / 'supabase/migrations/20261101104931_assessment_observed_chronology.sql'
source_bytes = source_path.read_bytes()
source = source_bytes.decode('utf-8')
digest = hashlib.sha256(source_bytes).hexdigest()
if len(source_bytes) != 7215 or digest != '5ef4d9fcef5191dbe0959689ecf1a32358a77d17c327801cc1e3aaf7f833499b':
    raise ValueError('Unexpected chronology source')
baseline_bytes = (root / 'supabase/hosted/profile-baseline-20261101.json').read_bytes()
manifest_bytes = (root / 'supabase/hosted/profile-dashboard-20261102.json').read_bytes()
original_manifest_bytes = (root / 'supabase/hosted/profile-manifest.json').read_bytes()
if hashlib.sha256(baseline_bytes).hexdigest() != 'a93732427101c87e737a2c48a1c553941c2f19c3c300e209434c084e49553dda':
    raise ValueError('Unexpected history baseline')
if hashlib.sha256(manifest_bytes).hexdigest() != '3bff0639e9f36f4bf74b854ab9ba7cd82aed069baad5353ac47ca7654d2f00b1':
    raise ValueError('Unexpected profile manifest')
if hashlib.sha256(original_manifest_bytes).hexdigest() != 'ae2d3ece1fe8b9ba528005ffcf1a1477d5e841f56bdc026082f462f8d6047d79':
    raise ValueError('Unexpected original profile manifest')
baseline = json.loads(baseline_bytes)
manifest = json.loads(manifest_bytes)
original_manifest = json.loads(original_manifest_bytes)
if original_manifest.get('newObjectsPath') != 'supabase/hosted/profile-new-objects.json':
    raise ValueError('Unexpected profile object path')
new_objects_bytes = (root / original_manifest['newObjectsPath']).read_bytes()
new_query_bytes = (root / 'supabase/hosted/profile-new-objects-query.sql').read_bytes()
if hashlib.sha256(new_objects_bytes).hexdigest() != original_manifest['newObjectsSha256'] or hashlib.sha256(new_query_bytes).hexdigest() != original_manifest['newObjectsQuerySha256']:
    raise ValueError('Unexpected profile object reference')
readback_bytes = (out / 'chronology-readback-20261102.sql').read_bytes()
if len(readback_bytes) != 17981 or hashlib.sha256(readback_bytes).hexdigest() != '26ce5c5df94bcd3dcf891c97e84c05bec537b51dd1bf3149dbb34e54d024074f':
    raise ValueError('Unexpected chronology readback')
objects_expected = json.dumps(json.loads(new_objects_bytes), ensure_ascii=False, separators=(',', ':'))
new_query = new_query_bytes.decode('utf-8').strip().removesuffix(';')
history = json.dumps(baseline['history'], ensure_ascii=False, separators=(',', ':'))
profile_sha = '313b31b1c06bbe461313a81af9ff0f18fe0cd0a1882ee66ac8013c2ffc05e04a'
profile_version = '20261102122007'
profile_name = 'serenia_progressive_profile_review'
version = '20261102122008'
name = 'serenia_assessment_chronology_review'
delimiter = '$serenia_chronology_payload_5ef4d9fc$'
if delimiter in source or '$chronology_history$' in history or '$chronology_objects$' in objects_expected:
    raise ValueError('SQL delimiter collision')
if len(baseline['history']) != 43 or manifest['version'] != profile_version or manifest['name'] != profile_name or manifest['packetSha256'] != profile_sha:
    raise ValueError('Unexpected preceding migration identity')
versions = [p.name[:14] for p in (root / 'supabase/migrations').glob('*.sql') if len(p.name) >= 15 and p.name[:14].isdigit() and p.name[14] == '_']
if version <= max([profile_version] + versions + [row['version'] for row in baseline['history']]):
    raise ValueError('Chronology version is not later than the known history')
guard = f"""
DO $history_guard$
DECLARE old_history jsonb; profile_row record;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('version',version,'name',name,'statements_md5',md5(array_to_string(statements,E'\\n'))) ORDER BY version)
    INTO old_history FROM supabase_migrations.schema_migrations WHERE version NOT IN ('{profile_version}','{version}');
  IF old_history IS DISTINCT FROM $chronology_history${history}$chronology_history$::jsonb
    THEN RAISE EXCEPTION 'Chronology old history changed'; END IF;
  SELECT version,name,cardinality(statements) elements,octet_length(statements[1]) bytes,
    encode(sha256(convert_to(statements[1],'UTF8')),'hex') digest
    INTO profile_row FROM supabase_migrations.schema_migrations WHERE version='{profile_version}';
  IF profile_row.version IS DISTINCT FROM '{profile_version}' OR profile_row.name IS DISTINCT FROM '{profile_name}'
    OR profile_row.elements IS DISTINCT FROM 1 OR profile_row.bytes IS DISTINCT FROM 81693
    OR profile_row.digest IS DISTINCT FROM '{profile_sha}' THEN RAISE EXCEPTION 'Chronology profile history changed'; END IF;
END;
$history_guard$;
"""
profile_guard = f"""
DO $profile_guard$
DECLARE actual jsonb;
BEGIN
 SELECT ({new_query}) INTO actual;
 IF actual IS DISTINCT FROM $chronology_objects${objects_expected}$chronology_objects$::jsonb
 THEN RAISE EXCEPTION 'Chronology profile object metadata changed'; END IF;
END;
$profile_guard$;
"""
sql = f"""-- LOCAL REHEARSAL ONLY; NOT APPROVED FOR HOSTED EXECUTION.
BEGIN;
SET LOCAL transaction_timeout = '50s';
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = public, pg_temp;
LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMPORARY TABLE chronology_payload(sql text NOT NULL) ON COMMIT DROP;
REVOKE ALL ON TABLE pg_temp.chronology_payload FROM public, anon, authenticated, service_role;
INSERT INTO pg_temp.chronology_payload VALUES ({delimiter}{source}{delimiter});
DO $payload_guard$ BEGIN
 IF (SELECT count(*) FROM pg_temp.chronology_payload) <> 1
 OR (SELECT octet_length(sql) FROM pg_temp.chronology_payload) <> {len(source_bytes)}
 OR (SELECT encode(sha256(convert_to(sql,'UTF8')),'hex') FROM pg_temp.chronology_payload) <> '{digest}'
 THEN RAISE EXCEPTION 'Chronology payload identity mismatch'; END IF;
 IF (SELECT count(*) FROM supabase_migrations.schema_migrations) <> 44
 THEN RAISE EXCEPTION 'Chronology history count mismatch'; END IF;
END $payload_guard$;
{guard}
{profile_guard}
DO $apply_chronology$ BEGIN
 EXECUTE (SELECT sql FROM pg_temp.chronology_payload);
END $apply_chronology$;
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)
 SELECT '{version}','{name}',ARRAY[sql]::text[] FROM pg_temp.chronology_payload;
-- CHRONOLOGY POST INSERT ASSERT
{guard}
{profile_guard}
DO $new_row_guard$ DECLARE new_row record; BEGIN
 IF (SELECT count(*) FROM supabase_migrations.schema_migrations) <> 45 THEN RAISE EXCEPTION 'Chronology history count mismatch'; END IF;
 SELECT version,name,cardinality(statements) elements,octet_length(statements[1]) bytes,
 encode(sha256(convert_to(statements[1],'UTF8')),'hex') digest INTO new_row
 FROM supabase_migrations.schema_migrations WHERE version='{version}';
 IF new_row.version IS DISTINCT FROM '{version}' OR new_row.name IS DISTINCT FROM '{name}' OR new_row.elements IS DISTINCT FROM 1
 OR new_row.bytes IS DISTINCT FROM {len(source_bytes)} OR new_row.digest IS DISTINCT FROM '{digest}'
 THEN RAISE EXCEPTION 'Chronology history registration mismatch'; END IF;
END $new_row_guard$;
COMMIT;
"""
if sql.count(source) != 1:
    raise ValueError('Unexpected chronology payload copies')
wrapper = sql.encode('utf-8')
wrapper_sha = hashlib.sha256(wrapper).hexdigest()
if wrapper_sha != '4db1985067d620e16451127c04b8ab89f723815a3474e4ed34f04d74ef654278':
    raise ValueError('Chronology wrapper differs from the reviewed prototype')
receipt = {
    'status':'PREPARED_NOT_APPLIED', 'mechanism':'custom-dashboard-transaction-single-verified-payload',
    'projectId':manifest['projectId'], 'version':version, 'name':name,
    'sourcePath':'supabase/migrations/20261101104931_assessment_observed_chronology.sql',
    'sourceBytes':len(source_bytes), 'sourceSha256':digest,
    'profileVersion':profile_version, 'profileName':profile_name, 'profilePacketSha256':profile_sha,
    'baselineSha256':hashlib.sha256(baseline_bytes).hexdigest(),
    'wrapperPath':'supabase/hosted/chronology-dashboard-20261102.sql',
    'wrapperBytes':len(wrapper), 'wrapperSha256':wrapper_sha,
    'readbackPath':'supabase/hosted/chronology-readback-20261102.sql',
    'readbackBytes':17981,
    'readbackSha256':'26ce5c5df94bcd3dcf891c97e84c05bec537b51dd1bf3149dbb34e54d024074f',
    'oldHistoryCount':44, 'newHistoryCount':45, 'transactionTimeout':'50s',
    'noHistoricalRepair':True, 'independentReview':'REQUIRED',
    'futureBranchingReplay':'NOT_VERIFIED', 'hostedReadback':'NOT_APPLIED',
}
manifest_output = (json.dumps(receipt, indent=2) + '\n').encode('utf-8')
if hashlib.sha256(manifest_output).hexdigest() != '74cc26eed91cdd42e4cd99ed3d05fc2657eb061d98ed6f6029fc98868507ba8c':
    raise ValueError('Chronology manifest differs from the reviewed prototype')
outputs = [(out / 'chronology-dashboard-20261102.sql', wrapper),
           (out / 'chronology-dashboard-20261102.json', manifest_output)]
for path, content in outputs:
    if path.exists() and path.read_bytes() != content:
        raise ValueError('Refusing to overwrite an unexpected chronology artifact')
for path, content in outputs:
    if not path.exists():
        path.write_bytes(content)
print(json.dumps({'status':receipt['status'],'wrapper':receipt['wrapperPath'],'sha256':wrapper_sha,'bytes':len(wrapper)}))
