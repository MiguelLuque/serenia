import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { expected, makeQuery, verifyReadback } from '../../scripts/profile-hosted-readback.mjs'

const clone = value => structuredClone(value)

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
