import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Read-only receipt for the prepared Dashboard wrapper. Never connects to a target.
const root = resolve(fileURLToPath(import.meta.url), '../..')
const read = path => readFileSync(resolve(root, path))
const sha256 = value => createHash('sha256').update(value).digest('hex')
const md5 = value => createHash('md5').update(value).digest('hex')
const literal = value => `'${value.replaceAll("'", "''")}'`
const jsonLiteral = value => `${literal(JSON.stringify(value))}::jsonb`
const equal = (a, b) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b))
const normalize = value => Array.isArray(value) ? value.map(normalize) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])])) : value
const exactKeys = (value, names) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && equal(Object.keys(value).sort(), [...names].sort())
const receiptKeys = ['executionContext', 'clientRoleAttributes', 'publicUnbaselinedRelations', 'proposalRows', 'historyCount', 'oldHistory', 'snapshot', 'newObjects',
  'publicTableCount', 'publicFunctionCount', 'publicTablesWithoutRls', 'newTableCounts', 'tableAcl', 'functionAcl']
const snapshotKeys = ['history', 'catalog', 'tableNames', 'tableFingerprint', 'routineSignatures',
  'routineFingerprint', 'platform', 'counts', 'clinicalCounts', 'profileObjectsAbsent']
const proposalKeys = ['version', 'name', 'statementCount', 'statementBytes', 'statementSha256']
const executionKeys = ['currentUser', 'sessionUser', 'isSuperuser', 'bypassesRls']
const limitations = ['RLS_ENFORCEMENT_NOT_VERIFIED', 'ROLE_ATTRIBUTES_AND_MEMBERSHIPS_NOT_BASELINED',
  'JWT_DATA_API_NOT_VERIFIED', 'PRECOMMIT_ROW_PRESERVATION_NOT_RECONSTRUCTIBLE']

export function expected() {
  const manifest = JSON.parse(read('supabase/hosted/profile-dashboard-20261102.json'))
  const profile = JSON.parse(read('supabase/hosted/profile-manifest.json'))
  const baselineBytes = read(manifest.baselinePath)
  const baseline = JSON.parse(baselineBytes)
  const packet = read(manifest.packetPath)
  const newObjectsBytes = read(profile.newObjectsPath)
  if (manifest.status !== 'PREPARED_NOT_APPLIED' || profile.status !== 'PREPARED_NOT_APPLIED'
    || manifest.version !== '20261102122007' || manifest.name !== 'serenia_progressive_profile_review'
    || manifest.projectId !== profile.projectId || manifest.packetSha256 !== profile.packetSha256
    || manifest.packetBytes !== packet.length || sha256(packet) !== manifest.packetSha256
    || sha256(baselineBytes) !== manifest.baselineSha256 || sha256(newObjectsBytes) !== profile.newObjectsSha256
    || sha256(read('supabase/hosted/profile-baseline-query.sql')) !== profile.baselineQuerySha256
    || sha256(read('supabase/hosted/profile-new-objects-query.sql')) !== profile.newObjectsQuerySha256
    || sha256(read(manifest.wrapperPath)) !== manifest.wrapperSha256
    || read(manifest.wrapperPath).length !== manifest.wrapperBytes
    || !equal(baseline.history, profile.history) || baseline.history.length !== manifest.oldHistoryCount
    || manifest.newHistoryCount !== manifest.oldHistoryCount + 1) throw new Error('Prepared profile artifact identity changed')
  return { manifest, profile, baseline, packetMd5: md5(packet), newObjects: JSON.parse(newObjectsBytes) }
}

export function makeQuery() {
  const { manifest, baseline } = expected()
  const snapshotSource = read('supabase/hosted/profile-baseline-query.sql').toString('utf8').trim().replace(/;$/, '')
  const newObjectsSource = read('supabase/hosted/profile-new-objects-query.sql').toString('utf8').trim().replace(/;$/, '')
  const tableNeedle = "c.relkind in ('r','p')"
  const routineNeedle = "p.prokind='f'"
  if (snapshotSource.split(tableNeedle).length !== 2 || snapshotSource.split(routineNeedle).length !== 2) throw new Error('Baseline query structure changed')
  const snapshot = snapshotSource
    .replace(tableNeedle, `${tableNeedle} and c.relname in (select jsonb_array_elements_text(${jsonLiteral(baseline.tableNames)}))`)
    .replace(routineNeedle, `${routineNeedle} and 'public.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' in (select jsonb_array_elements_text(${jsonLiteral(baseline.routineSignatures)}))`)
  const v = literal(manifest.version)
  return `-- READ ONLY. One SELECT, one MVCC snapshot. Confirm project ref in the Dashboard UI; SQL cannot prove it.
-- Catalog/RLS flags and effective ACL are read back, but role membership, JWT and Data API enforcement were not baselined.
-- No pre-apply view/materialized/foreign relation baseline exists: any such public relation fails verification.
-- Save the single JSON value as a file, then verify with scripts/profile-hosted-readback.mjs.
select jsonb_build_object(
  'executionContext', (select jsonb_build_object('currentUser', current_user, 'sessionUser', session_user,
    'isSuperuser', r.rolsuper, 'bypassesRls', r.rolbypassrls)
    from pg_roles r where r.rolname=current_user),
  'clientRoleAttributes', (select coalesce(jsonb_agg(jsonb_build_object('name', r.rolname,
    'isSuperuser', r.rolsuper, 'bypassesRls', r.rolbypassrls) order by r.rolname), '[]'::jsonb)
    from pg_roles r where r.rolname in ('anon','authenticated')),
  'publicUnbaselinedRelations', (select coalesce(jsonb_agg(jsonb_build_object('name', c.relname,
    'kind', c.relkind) order by c.relname, c.relkind), '[]'::jsonb)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('v','m','f')),
  'proposalRows', (select coalesce(jsonb_agg(jsonb_build_object(
    'version', version, 'name', name, 'statementCount', cardinality(statements),
    'statementBytes', octet_length(convert_to(statements[1], 'UTF8')),
    'statementSha256', encode(sha256(convert_to(statements[1], 'UTF8')), 'hex'))), '[]'::jsonb)
    from supabase_migrations.schema_migrations where version = ${v}),
  'historyCount', (select count(*) from supabase_migrations.schema_migrations),
  'oldHistory', (select coalesce(jsonb_agg(jsonb_build_object('version', version,
    'name', name, 'statements_md5', md5(array_to_string(statements, E'\\n'))) order by version), '[]'::jsonb)
    from supabase_migrations.schema_migrations where version <> ${v}),
  'snapshot', (${snapshot}),
  'newObjects', (${newObjectsSource}),
  'publicTableCount', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')),
  'publicFunctionCount', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f'),
  'publicTablesWithoutRls', (select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity),
  'newTableCounts', (select jsonb_object_agg(name, total) from (
    select 'profile_settings' name, count(*) total from public.profile_settings
    union all select 'profile_extraction_jobs', count(*) from public.profile_extraction_jobs
    union all select 'profile_observations', count(*) from public.profile_observations) x),
  'tableAcl', (select jsonb_agg(jsonb_build_object('table', c.relname, 'role', roles.role_name,
    'privilege', privileges.privilege_name,
    'allowed', has_table_privilege(roles.role_name, c.oid, privileges.privilege_name))
    order by c.relname, roles.role_name, privileges.privilege_name)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    cross join (values ('anon'), ('authenticated'), ('service_role')) roles(role_name)
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'),
      ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')) privileges(privilege_name)
    where n.nspname='public' and c.relname in ('profile_settings','profile_extraction_jobs','profile_observations')
      and c.relkind in ('r','p')),
  'functionAcl', (select jsonb_agg(jsonb_build_object('name', p.proname, 'role', roles.role_name,
    'allowed', has_function_privilege(roles.role_name, p.oid, 'EXECUTE'))
    order by p.proname, roles.role_name)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    cross join (values ('anon'), ('authenticated'), ('service_role')) roles(role_name)
    where n.nspname='public' and p.proname in
      ('profile_message_text','profile_source_immutable','enqueue_profile_source','validate_profile_source',
       'validate_profile_observation','set_profile_enabled','get_profile_memory','claim_profile_jobs',
       'lock_profile_job','start_profile_job','update_profile_job','finish_profile_job',
       'review_profile_observation','get_profile_memory_page'))
) as profile_readback;
`
}

export function verifyReadback(result) {
  const { manifest, baseline, packetMd5, newObjects } = expected()
  const errors = []
  const check = (condition, label) => { if (!condition) errors.push(label) }
  const data = result && typeof result === 'object' && !Array.isArray(result) ? result : {}
  check(exactKeys(result, receiptKeys), 'receipt fields')
  const context = data.executionContext
  check(exactKeys(context, executionKeys), 'execution context fields')
  check(typeof context?.currentUser === 'string' && context.currentUser.length > 0
    && typeof context?.sessionUser === 'string' && context.sessionUser.length > 0
    && (context.isSuperuser === true || context.bypassesRls === true), 'readback role bypasses RLS')
  check(equal(data.clientRoleAttributes, [
    { name: 'anon', isSuperuser: false, bypassesRls: false },
    { name: 'authenticated', isSuperuser: false, bypassesRls: false },
  ]), 'client roles do not bypass RLS')
  check(equal(data.publicUnbaselinedRelations, []), 'unbaselined public views/materialized/foreign relations')
  check(data.historyCount === manifest.newHistoryCount, 'history count')
  check(equal(data.oldHistory, baseline.history), '43 original history fingerprints')
  const rows = data.proposalRows
  check(Array.isArray(rows) && rows.length === 1 && exactKeys(rows[0], proposalKeys), 'proposal row fields')
  check(Array.isArray(rows) && rows.length === 1 && rows[0]?.version === manifest.version
    && rows[0]?.name === manifest.name && rows[0]?.statementCount === 1
    && rows[0]?.statementBytes === manifest.packetBytes
    && rows[0]?.statementSha256 === manifest.packetSha256, 'new migration receipt')
  const snapshot = data.snapshot || {}
  check(exactKeys(data.snapshot, snapshotKeys), 'snapshot fields')
  const expectedHistory = [...baseline.history, {
    version: manifest.version, name: manifest.name, statements_md5: packetMd5,
  }].sort((a, b) => a.version.localeCompare(b.version))
  check(equal(snapshot.history, expectedHistory), 'snapshot full history')
  for (const key of ['catalog', 'tableNames', 'tableFingerprint', 'routineSignatures',
    'routineFingerprint', 'platform', 'counts', 'clinicalCounts']) {
    check(equal(snapshot[key], baseline[key]), `preserved ${key}`)
  }
  check(snapshot.profileObjectsAbsent === false, 'profile objects present')
  check(equal(data.newObjects, newObjects), 'exact new object metadata')
  check(data.publicTableCount === baseline.tableNames.length + 3, 'public table set')
  check(data.publicFunctionCount === baseline.routineSignatures.length + 14, 'public function set')
  check(equal(data.publicTablesWithoutRls, []), 'all public tables RLS')
  check(equal(data.newTableCounts, { profile_settings: 0, profile_extraction_jobs: 0, profile_observations: 0 }), 'empty profile tables')
  const expectedTableAcl = []
  for (const table of ['profile_extraction_jobs', 'profile_observations', 'profile_settings'])
    for (const role of ['anon', 'authenticated', 'service_role'])
      for (const privilege of ['DELETE', 'INSERT', 'MAINTAIN', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE'])
        expectedTableAcl.push({ table, role, privilege,
          allowed: privilege === 'SELECT' && (role === 'service_role' || (role === 'authenticated' && table !== 'profile_extraction_jobs')) })
  check(equal(data.tableAcl, expectedTableAcl), 'effective table ACL')
  const ownerRpcs = new Set(['set_profile_enabled', 'get_profile_memory', 'get_profile_memory_page', 'review_profile_observation'])
  const workerRpcs = new Set(['claim_profile_jobs', 'start_profile_job', 'update_profile_job', 'finish_profile_job'])
  const expectedFunctionAcl = []
  for (const name of newObjects.routines.map(row => row.signature.match(/^public\.([^()]+)\(/)?.[1]).sort())
    for (const role of ['anon', 'authenticated', 'service_role'])
      expectedFunctionAcl.push({ name, role, allowed: (role === 'authenticated' && ownerRpcs.has(name)) || (role === 'service_role' && workerRpcs.has(name)) })
  check(equal(data.functionAcl, expectedFunctionAcl), 'effective function ACL')
  return { ok: errors.length === 0, errors, status: errors.length === 0 ? 'POST_COMMIT_READBACK_MATCHED' : 'NO_MATCHING_COMMIT_RECEIPT', limitations }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, path] = process.argv.slice(2)
  if (command === 'query' && !path) process.stdout.write(makeQuery())
  else if (command === 'verify' && path && process.argv.length === 4) {
    const outcome = verifyReadback(JSON.parse(readFileSync(resolve(path), 'utf8')))
    console.log(JSON.stringify(outcome))
    if (!outcome.ok) process.exitCode = 1
  } else throw new Error('Usage: node scripts/profile-hosted-readback.mjs query | verify <single-json-value-file>')
}
