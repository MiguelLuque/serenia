import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdtempSync, copyFileSync, mkdirSync, realpathSync, writeFileSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { expected } from '../../scripts/profile-hosted-readback.mjs'
import { verifyChronology, makeChronologyQuery } from '../../scripts/chronology-hosted-readback.mjs'
const root = resolve(fileURLToPath(new URL('../..',import.meta.url)))
function isolatedReadback() {
  const directory=realpathSync(mkdtempSync(join(tmpdir(),'serenia chronology receipt ')))
  const files=['scripts/chronology-hosted-readback.mjs','scripts/profile-hosted-readback.mjs',
    'supabase/migrations/20261101104931_assessment_observed_chronology.sql',
    'supabase/hosted/profile-dashboard-20261102.json','supabase/hosted/profile-manifest.json',
    'supabase/hosted/profile-baseline-20261101.json','supabase/hosted/profile-atomic.sql',
    'supabase/hosted/profile-dashboard-20261102.sql','supabase/hosted/profile-new-objects.json',
    'supabase/hosted/profile-baseline-query.sql','supabase/hosted/profile-new-objects-query.sql',
    'supabase/hosted/chronology-dashboard-20261102.sql','supabase/hosted/chronology-dashboard-20261102.json',
    'supabase/hosted/chronology-readback-20261102.sql']
  for(const file of files){const dest=join(directory,file);mkdirSync(resolve(dest,'..'),{recursive:true});copyFileSync(join(root,file),dest)}
  const run=()=>spawnSync(process.execPath,[join(directory,files[0]),'query'],{encoding:'utf8',timeout:5000})
  return {directory,run}
}
function matchingReceipt() {
  const { manifest, baseline, packetMd5, newObjects } = expected()
  const tableAcl = []
  for (const table of ['profile_extraction_jobs', 'profile_observations', 'profile_settings'])
    for (const role of ['anon', 'authenticated', 'service_role'])
      for (const privilege of ['DELETE', 'INSERT', 'MAINTAIN', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE'])
        tableAcl.push({ table, role, privilege,
          allowed: privilege === 'SELECT' && (role === 'service_role' || (role === 'authenticated' && table !== 'profile_extraction_jobs')) })
  const owner = new Set(['set_profile_enabled', 'get_profile_memory', 'get_profile_memory_page', 'review_profile_observation'])
  const worker = new Set(['claim_profile_jobs', 'start_profile_job', 'update_profile_job', 'finish_profile_job'])
  const functionAcl = []
  for (const name of newObjects.routines.map(r => r.signature.match(/^public\.([^()]+)\(/)[1]).sort())
    for (const role of ['anon', 'authenticated', 'service_role'])
      functionAcl.push({ name, role, allowed: (role === 'authenticated' && owner.has(name)) || (role === 'service_role' && worker.has(name)) })
  return {
    executionContext: { currentUser: 'fixture_reader', sessionUser: 'fixture_reader', isSuperuser: false, bypassesRls: true },
    clientRoleAttributes: [
      { name: 'anon', isSuperuser: false, bypassesRls: false },
      { name: 'authenticated', isSuperuser: false, bypassesRls: false },
    ],
    publicUnbaselinedRelations: [],
    proposalRows: [{ version: manifest.version, name: manifest.name, statementCount: 1,
      statementBytes: manifest.packetBytes, statementSha256: manifest.packetSha256 }],
    historyCount: manifest.newHistoryCount, oldHistory: baseline.history,
    snapshot: {
      history: [...baseline.history, { version: manifest.version, name: manifest.name, statements_md5: packetMd5 }],
      catalog: baseline.catalog, tableNames: baseline.tableNames, tableFingerprint: baseline.tableFingerprint,
      routineSignatures: baseline.routineSignatures, routineFingerprint: baseline.routineFingerprint,
      platform: baseline.platform, counts: baseline.counts, clinicalCounts: baseline.clinicalCounts,
      profileObjectsAbsent: false,
    },
    newObjects, publicTableCount: baseline.tableNames.length + 3,
    publicFunctionCount: baseline.routineSignatures.length + 14,
    publicTablesWithoutRls: [], newTableCounts: {
      profile_settings: 0, profile_extraction_jobs: 0, profile_observations: 0,
    }, tableAcl, functionAcl,
  }
}

test('45-row receipt rejects missing, changed and additional evidence', () => {
  const r=matchingReceipt()
  const source=readFileSync(join(root,'supabase/migrations/20261101104931_assessment_observed_chronology.sql'))
  const digest=alg=>createHash(alg).update(source).digest('hex')
  r.historyCount=45
  r.snapshot.history.push({version:'20261102122008',name:'serenia_assessment_chronology_review',statements_md5:digest('md5')})
  r.chronologyRows=[{version:'20261102122008',name:'serenia_assessment_chronology_review',statementCount:1,statementBytes:source.length,statementSha256:digest('sha256')}]
  r.chronologyFunction={owner:'postgres',securityDefiner:true,result:'jsonb',volatility:'s',language:'plpgsql',config:['search_path=public, pg_temp'],acl:'{postgres=X/postgres,authenticated=X/postgres}',bodyMd5:'9a5b7e54043035a657de3500907dcc84',definitionMd5:'8655ff635e6e3072366bd6625f51f755'}
  const matched=verifyChronology(r)
  assert.equal(matched.ok,true)
  for(const item of ['JWT_DATA_API_NOT_VERIFIED','RLS_ENFORCEMENT_NOT_VERIFIED','CONCURRENT_UNCOORDINATED_DDL_NOT_EXCLUDED','CLINICAL_VALIDATION_NOT_ESTABLISHED','PROVIDER_MODEL_NOT_EVALUATED']) assert.ok(matched.limitations.includes(item))
  const mutations=[x=>delete x.chronologyRows,x=>x.chronologyRows[0].statementSha256='0'.repeat(64),x=>x.chronologyRows[0].unexpected=1,x=>x.chronologyFunction.securityDefiner=false,x=>x.chronologyFunction.unexpected=1,x=>x.historyCount=44,x=>x.snapshot.history.pop(),x=>x.snapshot.routineFingerprint='0'.repeat(32),x=>x.oldHistory[0].statements_md5='0'.repeat(32),x=>x.tableAcl[0].allowed=true,x=>x.unexpected=1]
  for(const mutate of mutations){const changed=structuredClone(r);mutate(changed);const result=verifyChronology(changed);assert.equal(result.ok,false);assert.ok(result.limitations.includes('JWT_DATA_API_NOT_VERIFIED'))}
  assert.ok(verifyChronology(null).limitations.includes('CONCURRENT_UNCOORDINATED_DDL_NOT_EXCLUDED'))
  assert.match(makeChronologyQuery(), /20261102122008/)
})
test('import with host argv does not invoke the CLI, including a path with spaces', () => {
  const directory=mkdtempSync(join(tmpdir(),'serenia readback '))
  try {
    const alias=join(directory,'checkout with spaces')
    symlinkSync(root,alias,'dir')
    const file=join(alias,'scripts/chronology-hosted-readback.mjs')
    for(const mode of ['query','verify']) {
      const code=`process.argv=['node','host',${JSON.stringify(mode)},'/file-that-does-not-exist'];await import(${JSON.stringify(pathToFileURL(file).href)})`
      const child=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',timeout:5000})
      assert.equal(child.status,0,child.stderr)
      assert.equal(child.stdout,'')
    }
    for (const flags of [[], ['--preserve-symlinks-main']]) {
      const child=spawnSync(process.execPath,[...flags,file,'query'],{encoding:'utf8',timeout:5000})
      assert.equal(child.status,0,child.stderr)
      assert.match(child.stdout,/select jsonb_build_object\(/)
    }
  } finally { rmSync(directory,{recursive:true,force:true}) }
})
test('a symlinked chronology source is rejected without opening its target', () => {
  const directory=mkdtempSync(join(tmpdir(),'serenia chronology '))
  try {
    mkdirSync(join(directory,'supabase','migrations'),{recursive:true})
    mkdirSync(join(directory,'supabase','hosted'),{recursive:true})
    mkdirSync(join(directory,'scripts'),{recursive:true})
    symlinkSync('/nonexistent-sensitive-source-sentinel',join(directory,'supabase','migrations','20261101104931_assessment_observed_chronology.sql'))
    const file=join(directory,'scripts/chronology-hosted-readback.mjs')
    copyFileSync(join(root,'scripts/chronology-hosted-readback.mjs'),file)
    copyFileSync(join(root,'scripts/profile-hosted-readback.mjs'),join(directory,'scripts/profile-hosted-readback.mjs'))
    const child=spawnSync(process.execPath,[file,'query'],{encoding:'utf8',timeout:5000})
    assert.notEqual(child.status,0)
    assert.match(child.stderr,/Unexpected chronology input path/)
    assert.doesNotMatch(child.stderr,/nonexistent-sensitive-source-sentinel/)
  } finally { rmSync(directory,{recursive:true,force:true}) }
})
test('rejects coordinated wrapper/manifest alteration and symlinked wrapper', () => {
  const fixture=isolatedReadback()
  try {
    assert.equal(fixture.run().status,0,'fixture must initially be valid')
    const wrapper=join(fixture.directory,'supabase/hosted/chronology-dashboard-20261102.sql')
    const manifestPath=join(fixture.directory,'supabase/hosted/chronology-dashboard-20261102.json')
    const original=readFileSync(wrapper)
    const manifest=JSON.parse(readFileSync(manifestPath,'utf8'))
    const originalManifest=readFileSync(manifestPath)
    writeFileSync(wrapper,Buffer.concat([original,Buffer.from('\n-- changed')]))
    manifest.wrapperSha256=createHash('sha256').update(readFileSync(wrapper)).digest('hex')
    manifest.wrapperBytes=readFileSync(wrapper).length
    writeFileSync(manifestPath,JSON.stringify(manifest))
    const changed=fixture.run()
    assert.notEqual(changed.status,0)
    assert.match(changed.stderr,/Unexpected chronology manifest/)
    writeFileSync(manifestPath,originalManifest)
    rmSync(wrapper)
    symlinkSync('/nonexistent-chronology-wrapper-sentinel',wrapper)
    const linked=fixture.run()
    assert.notEqual(linked.status,0)
    assert.match(linked.stderr,/Unexpected chronology input path/)
    assert.doesNotMatch(linked.stderr,/nonexistent-chronology-wrapper-sentinel/)
  } finally { rmSync(fixture.directory,{recursive:true,force:true}) }
})
test('rejects a modified saved readback instead of using unchecked SQL', () => {
  const fixture=isolatedReadback()
  try {
    assert.equal(fixture.run().status,0,'fixture must initially be valid')
    const file=join(fixture.directory,'supabase/hosted/chronology-readback-20261102.sql')
    writeFileSync(file,readFileSync(file,'utf8')+'\n-- modified')
    const changed=fixture.run()
    assert.notEqual(changed.status,0)
    assert.match(changed.stderr,/Unexpected chronology artifact/)
  } finally { rmSync(fixture.directory,{recursive:true,force:true}) }
})
