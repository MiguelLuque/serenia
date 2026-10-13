import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const target = Object.freeze({ projectId: 'brpozobkoatabctjjadc', organizationId: 'jhmhzzaqbzvvppwtwfhz', region: 'eu-west-1', plan: 'Free', apiOrigin: 'https://brpozobkoatabctjjadc.supabase.co', appOrigin: 'http://127.0.0.1:3000' })
export const sourceFiles = [
  '20261010075359_robust_authorization_review.sql',
  '20261010123627_robust_chat_questionnaires_recovery.sql',
  '20261010231957_patient_flows_acceptance_private_reports.sql',
  '20261012083833_acceptance_strict_function_lint.sql',
  '20261012084307_acceptance_strict_rls_advisors.sql',
  '20261013073246_hosted_trigger_acl.sql',
]
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
export function makePacket(root = resolve('.')) {
  const baseline = JSON.parse(readFileSync(resolve(root, 'docs/operations/hosted-baseline.json'), 'utf8'))
  const parts = [], sections = []; let offset = 0
  const add = bytes => { const b=Buffer.from(bytes); parts.push(b); offset+=b.length }
  add(readFileSync(resolve(root, 'supabase/hosted/preservation-before.sql')))
  // Exact bytes are appended, never parsed/split/reformatted. Separators are outside sections.
  for (const filename of sourceFiles) {
    const bytes = readFileSync(resolve(root, 'supabase/migrations', filename))
    add(`\n-- BEGIN EXACT ${filename} SHA256 ${sha256(bytes)}\n`)
    sections.push({ filename, localVersion: filename.slice(0,14), position: sections.length+1, offset, bytes: bytes.length, sha256: sha256(bytes) })
    add(bytes); add(`\n-- END EXACT ${filename}\n`)
  }
  add(readFileSync(resolve(root, 'supabase/hosted/preservation-after.sql')))
  const packet = Buffer.concat(parts)
  return { packet, manifest: { ...target, sourceBase: baseline.sourceBase, canonicalName: 'serenia_robust_mvp_hosted_atomic', mechanism: 'official MCP apply_migration single atomic Management query; server version mapped after success', status: 'PREPARED_NOT_APPLIED', history: baseline.history, catalog: baseline.catalog, sections, exactOctoberSha256: sha256(Buffer.concat(sourceFiles.slice(0,5).map(name=>readFileSync(resolve(root,'supabase/migrations',name))))), packetBytes: packet.length, packetSha256: sha256(packet), noHistoricalReplay: true } }
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv.length!==2) throw new Error('No target or argument overrides supported')
  const {packet,manifest}=makePacket(); const dir=resolve('supabase/hosted'); mkdirSync(dir,{recursive:true})
  writeFileSync(resolve(dir,'serenia-atomic.sql'),packet)
  writeFileSync(resolve(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
  console.log(JSON.stringify({packet:'supabase/hosted/serenia-atomic.sql',manifest:'supabase/hosted/manifest.json',sha256:manifest.packetSha256,bytes:packet.length}))
}
