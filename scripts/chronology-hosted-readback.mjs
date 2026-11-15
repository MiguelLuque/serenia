// LOCAL PROTOTYPE. Not an authorization to run a hosted query or migration.
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expected, makeQuery, verifyReadback } from './profile-hosted-readback.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = 'supabase/migrations/20261101104931_assessment_observed_chronology.sql'
const manifestPath = 'supabase/hosted/chronology-dashboard-20261102.json'
const wrapperPath = 'supabase/hosted/chronology-dashboard-20261102.sql'
const readbackPath = 'supabase/hosted/chronology-readback-20261102.sql'
const sha = value => createHash('sha256').update(value).digest('hex')
const md5 = value => createHash('md5').update(value).digest('hex')
const version = '20261102122008'
const name = 'serenia_assessment_chronology_review'
const oldVersion = '20261102122007'
const identity = 'public.get_clinician_inbox_page(integer,integer,boolean)'
function loadChronology() {
  for (const path of ['supabase','supabase/migrations','supabase/hosted',sourcePath,manifestPath,wrapperPath,readbackPath]) {
    const stat=lstatSync(resolve(root,path))
    if(stat.isSymbolicLink() || ([sourcePath,manifestPath,wrapperPath,readbackPath].includes(path) ? !stat.isFile() : !stat.isDirectory())) throw new Error('Unexpected chronology input path')
  }
  const manifestBytes = readFileSync(resolve(root,manifestPath))
  if (sha(manifestBytes) !== '74cc26eed91cdd42e4cd99ed3d05fc2657eb061d98ed6f6029fc98868507ba8c') throw new Error('Unexpected chronology manifest')
  const manifest=JSON.parse(manifestBytes)
  if (manifest.status !== 'PREPARED_NOT_APPLIED' || manifest.version !== version || manifest.name !== name
    || manifest.sourcePath !== sourcePath || manifest.wrapperPath !== wrapperPath || manifest.readbackPath !== readbackPath || manifest.profileVersion !== oldVersion
    || manifest.projectId !== 'brpozobkoatabctjjadc') throw new Error('Unexpected chronology manifest')
  const source=readFileSync(resolve(root,sourcePath))
  const wrapper=readFileSync(resolve(root,wrapperPath))
  const readbackBytes=readFileSync(resolve(root,readbackPath))
  if (source.length !== 7215 || sha(source) !== '5ef4d9fcef5191dbe0959689ecf1a32358a77d17c327801cc1e3aaf7f833499b'
    || manifest.sourceSha256 !== sha(source) || manifest.sourceBytes !== source.length
    || sha(wrapper) !== '4db1985067d620e16451127c04b8ab89f723815a3474e4ed34f04d74ef654278'
    || manifest.wrapperSha256 !== sha(wrapper) || manifest.wrapperBytes !== wrapper.length
    || sha(readbackBytes) !== '26ce5c5df94bcd3dcf891c97e84c05bec537b51dd1bf3149dbb34e54d024074f'
    || manifest.readbackSha256 !== sha(readbackBytes) || manifest.readbackBytes !== readbackBytes.length) throw new Error('Unexpected chronology artifact')
  return { source, manifest, readbackBytes }
}
const replaceOnce = (text, find, replacement) => {
  const i = text.indexOf(find)
  if (i < 0 || text.indexOf(find, i + find.length) !== -1) throw new Error('Unexpected profile query structure')
  return text.slice(0, i) + replacement + text.slice(i + find.length)
}

export function makeChronologyQuery() {
  const { readbackBytes } = loadChronology()
  let query = makeQuery()
  query = replaceOnce(query, `where version <> '${oldVersion}'`, `where version NOT IN ('${oldVersion}','${version}')`)
  const routine = 'md5(pg_get_functiondef(p.oid)) as definition_md5'
  const start = query.indexOf('), routines_snapshot as (')
  const end = query.indexOf('), catalog_snapshot as (',start)
  if (start < 0 || end < start || query.split(routine).length !== 3) throw new Error('Unexpected routine query structure')
  const baselineRoutines = query.slice(start,end)
  // Normalise only the already-baselined inbox definition when hashing old routines.
  query = query.slice(0,start) + replaceOnce(baselineRoutines,routine,`CASE WHEN p.oid=to_regprocedure('${identity}') THEN '50706695637b61aacecc5d31e14b4b8d' ELSE md5(pg_get_functiondef(p.oid)) END as definition_md5`) + query.slice(end)
  query = replaceOnce(query, "  'proposalRows',", `  'chronologyRows', (select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,
    'statementCount',cardinality(statements),'statementBytes',octet_length(convert_to(statements[1],'UTF8')),
    'statementSha256',encode(sha256(convert_to(statements[1],'UTF8')),'hex'))),'[]'::jsonb)
    from supabase_migrations.schema_migrations where version='${version}'),
  'chronologyFunction', (select jsonb_build_object('owner',pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef,
    'result',p.prorettype::regtype::text,'volatility',p.provolatile,'language',l.lanname,
    'config',p.proconfig,'acl',p.proacl::text,'bodyMd5',md5(p.prosrc),'definitionMd5',md5(pg_get_functiondef(p.oid)))
    from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure('${identity}')),
  'proposalRows',`)
  if (!Buffer.from(query,'utf8').equals(readbackBytes)) throw new Error('Unexpected generated chronology readback')
  return query
}

export function verifyChronology(receipt) {
  const { source } = loadChronology()
  const errors = []
  const limitations = [...verifyReadback(null).limitations, 'CONCURRENT_UNCOORDINATED_DDL_NOT_EXCLUDED', 'CLINICAL_VALIDATION_NOT_ESTABLISHED', 'PROVIDER_MODEL_NOT_EVALUATED']
  const normalize = v => Array.isArray(v) ? v.map(normalize) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])])) : v
  const same = (a,b) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b))
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return { ok:false, errors:['receipt shape'], status:'NO_MATCHING_COMMIT_RECEIPT', limitations }
  const { chronologyRows, chronologyFunction, ...profileReceipt } = receipt
  const row = { version, name, statementCount:1, statementBytes:source.length, statementSha256:sha(source) }
  if (!Array.isArray(chronologyRows) || chronologyRows.length !== 1 || !same(chronologyRows[0],row)) errors.push('chronology registration')
  const fn = { owner:'postgres', securityDefiner:true, result:'jsonb', volatility:'s', language:'plpgsql',
    config:['search_path=public, pg_temp'], acl:'{postgres=X/postgres,authenticated=X/postgres}',
    bodyMd5:'9a5b7e54043035a657de3500907dcc84', definitionMd5:'8655ff635e6e3072366bd6625f51f755' }
  // Sort keys so JSONB object key order cannot affect equality.
  const canonical = value => JSON.stringify(value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))) : value)
  if (canonical(chronologyFunction) !== canonical(fn)) errors.push('chronology function')
  const { manifest, baseline, packetMd5 } = expected()
  const historyRow = { version, name, statements_md5:md5(source) }
  const history = profileReceipt.snapshot?.history
  const prior = [...baseline.history,{version:oldVersion,name:manifest.name,statements_md5:packetMd5}]
  if (receipt.historyCount !== 45 || !same(history,[...prior,historyRow])) errors.push('45-row history')
  const normalized = structuredClone(profileReceipt)
  normalized.historyCount = 44
  if (normalized.snapshot && typeof normalized.snapshot === 'object') normalized.snapshot.history = prior
  const profile = verifyReadback(normalized)
  if (!profile.ok) errors.push(...profile.errors.map(x=>`profile ${x}`))
  return { ok:errors.length===0, errors, status:errors.length===0?'POST_CHRONOLOGY_READBACK_MATCHED':'NO_MATCHING_COMMIT_RECEIPT', limitations }
}

function isEntrypoint() {
  if (!process.argv[1]) return false
  try { return realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url)) } catch { return false }
}
if (isEntrypoint()) {
  const [command,path] = process.argv.slice(2)
  if (command==='query' && !path) process.stdout.write(makeChronologyQuery())
  else if(command==='verify' && path && process.argv.length===4) {
    const result=verifyChronology(JSON.parse(readFileSync(resolve(path),'utf8')))
    console.log(JSON.stringify(result))
    if(!result.ok)process.exitCode=1
  } else throw new Error('Usage: node readback45.mjs query | verify <json>')
}
