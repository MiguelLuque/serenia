import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const baselineIdentity = 'e9672c963f6c342d8166c57fa6c7fdce5a6ba0b6c3fe40c56859a44a50d085c6'
const queryIdentity = 'ca0b41ba361b81484f618f92e441857c6b4cd1f25014857c86aff7706725a9b6'
const newObjectsIdentity = '10a27539883c60c3b888c678a5053ac67636693aa24f180c359dda45c1108204'
export const profileSources = Object.freeze([
  { filename: '20261028081958_progressive_profile.sql', sha256: '1d57bcd44f9f37de88a68b46a75e1271b86f36acacfde228178dbd3d27545205' },
  { filename: '20261028180058_profile_review_rejected_target.sql', sha256: '01a00ea14358c9d70b99a74bd0569660d9689ca157aaa1dbb37c35fde3687a06' },
  { filename: '20261028185351_profile_nonretryable_conflicts.sql', sha256: '9fbff95d4afaa1c4076fca09674a0c601db86af9b69b4ff3e35a7acfdf342827' },
  { filename: '20261030152754_profile_memory_history_page.sql', sha256: 'c9cc722dd713d6ee209f65b77b3ef912e2ae732443c8bdad424b2fa7c9293c6d' },
])

export function makeProfilePacket(root = resolve('.')) {
  const read = path => readFileSync(resolve(root, path))
  const baselineBytes = read('supabase/hosted/profile-baseline-20261030.json')
  const queryBytes = read('supabase/hosted/profile-baseline-query.sql')
  if (sha256(baselineBytes) !== baselineIdentity || sha256(queryBytes) !== queryIdentity) throw new Error('Profile hosted baseline identity changed')
  const baseline = JSON.parse(baselineBytes)
  const newObjectsBytes = read('supabase/hosted/profile-new-objects.json')
  if (sha256(newObjectsBytes) !== newObjectsIdentity) throw new Error('Profile new object baseline identity changed')
  const newObjects = JSON.parse(newObjectsBytes)
  const newObjectsQuery = read('supabase/hosted/profile-new-objects-query.sql')
  // The read query remains immutable. Only restrict the old-object aggregates for
  // the after-check: new objects must not enter fingerprints of pre-existing ones.
  const snapshot = queryBytes.toString('utf8')
    .replace("c.relkind in ('r','p')", "c.relkind in ('r','p') and (not p_old_only or c.relname in (select jsonb_array_elements_text(expected->'tableNames') from pg_temp.profile_baseline))")
    .replace("p.prokind='f'", "p.prokind='f' and (not p_old_only or 'public.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' in (select jsonb_array_elements_text(expected->'routineSignatures') from pg_temp.profile_baseline))")
  const parts = [], sections = []; let offset = 0
  const add = input => { const b = Buffer.from(input); parts.push(b); offset += b.length }
  add(read('supabase/hosted/profile-before.sql').toString('utf8')
    .replace('@@BASELINE@@', JSON.stringify(baseline).replaceAll("'", "''"))
    .replace('@@SNAPSHOT_QUERY@@', snapshot)
    .replace('@@NEW_OBJECTS@@', JSON.stringify(newObjects).replaceAll("'", "''"))
    .replace('@@NEW_OBJECTS_QUERY@@', newObjectsQuery.toString('utf8')))
  for (const source of profileSources) {
    const bytes = read(`supabase/migrations/${source.filename}`)
    if (sha256(bytes) !== source.sha256) throw new Error(`Profile source identity changed: ${source.filename}`)
    add(`\n-- BEGIN EXACT ${source.filename} SHA256 ${source.sha256}\n`)
    sections.push({ ...source, localVersion: source.filename.slice(0, 14), position: sections.length + 1, offset, bytes: bytes.length })
    add(bytes); add(`\n-- END EXACT ${source.filename}\n`)
  }
  add(read('supabase/hosted/profile-after.sql'))
  const packet = Buffer.concat(parts)
  return { packet, manifest: {
    ...baseline.target, sourceBase: '93fc4ef', canonicalName: 'serenia_progressive_profile_review',
    postgresMajor: 17,
    mechanism: 'official MCP apply_migration single atomic Management query; server version mapped only after success',
    status: 'PREPARED_NOT_APPLIED', baselinePath: 'supabase/hosted/profile-baseline-20261030.json',
    baselineSha256: baselineIdentity, baselineQuerySha256: queryIdentity,
    newObjectsPath: 'supabase/hosted/profile-new-objects.json', newObjectsSha256: newObjectsIdentity,
    newObjectsQuerySha256: sha256(newObjectsQuery),
    newObjectsProvenance: 'PostgreSQL 17.6 isolated metadata of the four exact source sections; no clinical rows or expected metadata substitution for new objects',
    history: baseline.history, catalog: baseline.catalog, platform: baseline.platform,
    historySha256: sha256(JSON.stringify(baseline.history)), catalogSha256: sha256(JSON.stringify(baseline.catalog)), platformSha256: sha256(JSON.stringify(baseline.platform)),
    tableNames: baseline.tableNames, tableFingerprint: baseline.tableFingerprint,
    routineSignatures: baseline.routineSignatures, routineFingerprint: baseline.routineFingerprint,
    counts: baseline.counts, clinicalCounts: baseline.clinicalCounts,
    sections, packetBytes: packet.length, packetSha256: sha256(packet), noHistoricalReplay: true,
  } }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) throw new Error('No target or argument overrides supported')
  const { packet, manifest } = makeProfilePacket()
  writeFileSync(resolve('supabase/hosted/profile-atomic.sql'), packet)
  writeFileSync(resolve('supabase/hosted/profile-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(JSON.stringify({ packet: 'supabase/hosted/profile-atomic.sql', sha256: manifest.packetSha256, bytes: packet.length }))
}
