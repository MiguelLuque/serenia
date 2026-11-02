import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { expected, makeQuery, verifyReadback } from '../../scripts/profile-hosted-readback.mjs'

const clone = value => structuredClone(value)

function isolatedReadback() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'serenia-readback-integrity-')))
  const files = [
    'scripts/profile-hosted-readback.mjs',
    'supabase/hosted/profile-dashboard-20261102.json',
    'supabase/hosted/profile-manifest.json',
    'supabase/hosted/profile-baseline-20261101.json',
    'supabase/hosted/profile-atomic.sql',
    'supabase/hosted/profile-dashboard-20261102.sql',
    'supabase/hosted/profile-new-objects.json',
    'supabase/hosted/profile-baseline-query.sql',
    'supabase/hosted/profile-new-objects-query.sql',
  ]
  for (const path of files) {
    mkdirSync(dirname(join(directory, path)), { recursive:true })
    copyFileSync(join(root, path), join(directory, path))
  }
  const run = () => spawnSync(process.execPath, [join(directory, files[0]), 'query'], { encoding:'utf8', timeout:5000, maxBuffer:1024*1024, env:{ PATH:process.env.PATH, NODE_ENV:'test' } })
  return { directory, run }
}

test('rejects a coordinated change to the baseline and its manifest hash', () => {
  const f = isolatedReadback()
  try {
    assert.equal(f.run().status, 0, 'untampered isolated fixture must be valid')
    const baseline = join(f.directory, 'supabase/hosted/profile-baseline-20261101.json')
    const manifestPath = join(f.directory, 'supabase/hosted/profile-dashboard-20261102.json')
    const value = JSON.parse(readFileSync(baseline, 'utf8'))
    value.capturedAt = '1900-01-01T00:00:00Z'
    writeFileSync(baseline, JSON.stringify(value))
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    manifest.baselineSha256 = createHash('sha256').update(readFileSync(baseline)).digest('hex')
    writeFileSync(manifestPath, JSON.stringify(manifest))
    const result = f.run()
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Prepared profile artifact identity changed/)
  } finally { rmSync(f.directory, { recursive:true, force:true }) }
})

test('rejects an external manifest path before attempting to read it', () => {
  const f = isolatedReadback()
  try {
    assert.equal(f.run().status, 0, 'untampered isolated fixture must be valid')
    const manifestPath = join(f.directory, 'supabase/hosted/profile-dashboard-20261102.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    manifest.baselinePath = '/nonexistent-external-profile-readback-sentinel'
    writeFileSync(manifestPath, JSON.stringify(manifest))
    const result = f.run()
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Prepared profile artifact identity changed/)
    assert.doesNotMatch(result.stderr, /nonexistent-external-profile-readback-sentinel/)
  } finally { rmSync(f.directory, { recursive:true, force:true }) }
})

test('rejects a symlinked baseline before reading the target', () => {
  const f = isolatedReadback()
  try {
    assert.equal(f.run().status, 0, 'untampered isolated fixture must be valid')
    const baseline = join(f.directory, 'supabase/hosted/profile-baseline-20261101.json')
    const target = join(f.directory, 'otherwise-valid-baseline.json')
    copyFileSync(baseline, target)
    rmSync(baseline)
    symlinkSync(target, baseline)
    const result = f.run()
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Prepared profile artifact identity changed/)
  } finally { rmSync(f.directory, { recursive:true, force:true }) }
})

test('generates the query from the verified bytes without reading the input again', () => {
  const f = isolatedReadback()
  try {
    const target = join(f.directory, 'supabase/hosted/profile-baseline-query.sql')
    const script = join(f.directory, 'scripts/profile-hosted-readback.mjs')
    const code = `import fs from 'node:fs'; import {syncBuiltinESMExports} from 'node:module'; import {pathToFileURL} from 'node:url';
      const original=fs.readFileSync; let reads=0;
      fs.readFileSync=(path,...args)=>{const value=original(path,...args);if(String(path)===${JSON.stringify(target)} && ++reads===2)return Buffer.from(value.toString()+'\\n-- unverified_second_read');return value};
      syncBuiltinESMExports();const module=await import(pathToFileURL(${JSON.stringify(script)}).href);const sql=module.makeQuery();
      console.log(JSON.stringify({reads,containsUnverified:sql.includes('unverified_second_read')}));`
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding:'utf8', timeout:5000, env:{ PATH:process.env.PATH, NODE_ENV:'test' } })
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), { reads:1, containsUnverified:false })
  } finally { rmSync(f.directory, { recursive:true, force:true }) }
})

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

test('generated readback is a single SELECT and computes full registered payload digest', () => {
  const sql = makeQuery()
  const saved = readFileSync(fileURLToPath(new URL('../../supabase/hosted/profile-dashboard-readback-20261102.sql', import.meta.url)), 'utf8')
  assert.equal(saved, sql)
  assert.match(sql, /select jsonb_build_object\(/)
  assert.match(sql, /cardinality\(statements\)/)
  assert.match(sql, /octet_length\(convert_to\(statements\[1\], 'UTF8'\)\)/)
  assert.match(sql, /sha256\(convert_to\(statements\[1\], 'UTF8'\)\)/)
  assert.match(sql, /version <> '20261102122007'/)
  assert.doesNotMatch(sql, /\b(?:insert|update|delete|create|alter|drop|grant|revoke|commit|rollback)\s+(?:into|table|function|on|from|role|schema|trigger|policy|index|view|sequence|extension|database)\b/i)
  assert.equal((sql.match(/;\s*$/g) || []).length, 1)
})

test('receipt requires exact proposed row, old history, metadata, counts, RLS and ACL', () => {
  const receipt = matchingReceipt()
  assert.deepEqual(verifyReadback(receipt), { ok: true, errors: [], status: 'POST_COMMIT_READBACK_MATCHED',
    limitations: ['RLS_ENFORCEMENT_NOT_VERIFIED', 'ROLE_ATTRIBUTES_AND_MEMBERSHIPS_NOT_BASELINED',
      'JWT_DATA_API_NOT_VERIFIED', 'PRECOMMIT_ROW_PRESERVATION_NOT_RECONSTRUCTIBLE'] })
  const mutations = [
    r => { r.proposalRows = [] },
    r => { r.proposalRows[0].statementSha256 = '0'.repeat(64) },
    r => { r.proposalRows[0].statementCount = 2 },
    r => { r.oldHistory[0].statements_md5 = '0'.repeat(32) },
    r => { r.snapshot.tableFingerprint = '0'.repeat(32) },
    r => { r.snapshot.counts.profiles++ },
    r => { r.newObjects.tables[0].rls = false },
    r => { r.publicTablesWithoutRls.push('profile_settings') },
    r => { r.newTableCounts.profile_settings = 1 },
    r => { r.tableAcl[0].allowed = true },
    r => { r.functionAcl[0].allowed = true },
    r => { delete r.historyCount },
    r => { r.unexpected = true },
    r => { delete r.snapshot.platform },
    r => { r.snapshot.unexpected = true },
    r => { delete r.proposalRows[0].name },
    r => { r.proposalRows[0].unexpected = true },
    r => { r.snapshot.history.pop() },
    r => { r.snapshot.history.at(-1).statements_md5 = '0'.repeat(32) },
    r => { r.snapshot.history[0].name = 'changed' },
    r => { delete r.executionContext.currentUser },
    r => { r.executionContext.extra = true },
    r => { r.executionContext.bypassesRls = false },
    r => { r.clientRoleAttributes[0].bypassesRls = true },
    r => { r.clientRoleAttributes[1].isSuperuser = true },
    r => { r.publicUnbaselinedRelations = [{ name: 'unreviewed_view', kind: 'v' }] },
  ]
  for (const mutate of mutations) {
    const changed = clone(receipt)
    mutate(changed)
    const outcome = verifyReadback(changed)
    assert.equal(outcome.ok, false)
    assert.equal(outcome.status, 'NO_MATCHING_COMMIT_RECEIPT')
    assert.ok(outcome.errors.length > 0)
  }
  const anotherReader = clone(receipt)
  anotherReader.executionContext.currentUser = 'different_privileged_reader'
  assert.equal(verifyReadback(anotherReader).ok, true, 'receipt does not assume a particular role name')
})
