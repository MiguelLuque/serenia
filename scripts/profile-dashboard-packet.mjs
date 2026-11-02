import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const root = resolve(fileURLToPath(import.meta.url), '../..')
const read = path => readFileSync(resolve(root, path))
const version = '20261102122007'
const name = 'serenia_progressive_profile_review'
const packetBytes = read('supabase/hosted/profile-atomic.sql')
const packet = packetBytes.toString('utf8')
const packetSha256 = '313b31b1c06bbe461313a81af9ff0f18fe0cd0a1882ee66ac8013c2ffc05e04a'
const packetLength = 81693
if (packetBytes.length !== packetLength || sha256(packetBytes) !== packetSha256 || Buffer.byteLength(packet) !== packetLength) {
  throw new Error('Original profile packet identity changed')
}
const original = JSON.parse(read('supabase/hosted/profile-manifest.json'))
if (original.packetSha256 !== packetSha256 || original.packetBytes !== packetLength || original.status !== 'PREPARED_NOT_APPLIED' || original.canonicalName !== name) {
  throw new Error('Original profile manifest identity changed')
}
const history = original.history.map(row => row.version)
const localVersions = readdirSync(resolve(root, 'supabase/migrations')).filter(file => /^\d{14}_.*\.sql$/.test(file)).map(file => file.slice(0, 14))
if (version <= [...history, ...localVersions].sort().at(-1) || history.includes(version) || localVersions.includes(version)) {
  throw new Error('Dashboard version is not new and later than known versions')
}
const delimiter = '$serenia_profile_packet_313b31b1$'
if (packet.includes(delimiter)) throw new Error('Payload delimiter collides with original packet')
const literal = `${delimiter}${packet}${delimiter}`
const wrapper = `BEGIN;
SET LOCAL transaction_timeout = '50s';
CREATE TEMPORARY TABLE profile_dashboard_payload(sql text NOT NULL) ON COMMIT DROP;
REVOKE ALL ON TABLE pg_temp.profile_dashboard_payload FROM public, anon, authenticated, service_role;
INSERT INTO pg_temp.profile_dashboard_payload(sql) VALUES (${literal});
DO $dashboard_payload_check$
BEGIN
  IF (SELECT count(*) FROM pg_temp.profile_dashboard_payload) <> 1
    OR (SELECT octet_length(sql) FROM pg_temp.profile_dashboard_payload) <> ${packetLength}
    OR (SELECT encode(sha256(convert_to(sql, 'UTF8')), 'hex') FROM pg_temp.profile_dashboard_payload) <> '${packetSha256}'
  THEN RAISE EXCEPTION 'Dashboard packet payload identity mismatch'; END IF;
END;
$dashboard_payload_check$;
${packet}
-- DASHBOARD HISTORY INSERT: one new entry in the same transaction as the exact packet.
INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
  SELECT '${version}', '${name}', ARRAY[sql]::text[] FROM pg_temp.profile_dashboard_payload;
-- DASHBOARD HISTORY ASSERT: preserve all 43 old entries and prove the new exact payload.
DO $dashboard_history_check$
DECLARE expected jsonb; old_history jsonb; registered record;
BEGIN
  SELECT b.expected INTO expected FROM pg_temp.profile_baseline b;
  SELECT jsonb_agg(jsonb_build_object('version', version, 'name', name,
    'statements_md5', md5(array_to_string(statements, E'\\n'))) ORDER BY version)
    INTO old_history FROM supabase_migrations.schema_migrations WHERE version <> '${version}';
  IF old_history IS DISTINCT FROM expected->'history' THEN RAISE EXCEPTION 'Dashboard old migration history changed'; END IF;
  IF (SELECT count(*) FROM supabase_migrations.schema_migrations) <> 44 THEN RAISE EXCEPTION 'Dashboard migration history count mismatch'; END IF;
  SELECT version, name, cardinality(statements) AS elements, octet_length(statements[1]) AS bytes,
    encode(sha256(convert_to(statements[1], 'UTF8')), 'hex') AS digest
    INTO registered FROM supabase_migrations.schema_migrations WHERE version = '${version}';
  IF registered.version IS DISTINCT FROM '${version}' OR registered.name IS DISTINCT FROM '${name}'
    OR registered.elements IS DISTINCT FROM 1 OR registered.bytes IS DISTINCT FROM ${packetLength}
    OR registered.digest IS DISTINCT FROM '${packetSha256}'
  THEN RAISE EXCEPTION 'Dashboard migration registration mismatch'; END IF;
END;
$dashboard_history_check$;
COMMIT;
`
const wrapperBytes = Buffer.from(wrapper, 'utf8')
const manifest = {
  status: 'PREPARED_NOT_APPLIED',
  mechanism: 'custom Supabase Dashboard SQL Editor single-request explicit transaction with same-transaction migration registration',
  projectId: original.projectId,
  version,
  name,
  packetPath: 'supabase/hosted/profile-atomic.sql',
  packetSha256,
  packetBytes: packetLength,
  originalManifestPath: 'supabase/hosted/profile-manifest.json',
  baselinePath: original.baselinePath,
  baselineSha256: original.baselineSha256,
  wrapperPath: 'supabase/hosted/profile-dashboard-20261102.sql',
  wrapperBytes: wrapperBytes.length,
  wrapperSha256: sha256(wrapperBytes),
  oldHistoryCount: 43,
  newHistoryCount: 44,
  transactionTimeout: '50s',
  noHistoricalRepair: true,
  futureBranchingReplay: 'NOT_VERIFIED'
}
if (process.argv.length !== 2) throw new Error('No arguments or target overrides supported')
writeFileSync(resolve(root, manifest.wrapperPath), wrapperBytes)
writeFileSync(resolve(root, 'supabase/hosted/profile-dashboard-20261102.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify({ wrapper: manifest.wrapperPath, sha256: manifest.wrapperSha256, bytes: manifest.wrapperBytes }))
