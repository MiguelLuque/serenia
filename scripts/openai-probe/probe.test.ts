import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runProbe, type ProbeDependencies } from '../../app/api/internal/openai-probe/probe-core'

const origin = 'https://example-preview.vercel.app'
const env = { VERCEL: '1', NODE_ENV: 'production', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'codex/serenia-openai-direct-probe', VERCEL_URL: 'example-preview.vercel.app', NEXT_PUBLIC_SUPABASE_URL: 'https://brpozobkoatabctjjadc.supabase.co', OPENAI_PROBE_ENABLED: 'on', LLM_TRANSPORT: 'openai' }
const usage = { inputTokens: 9, outputTokens: 11 }
function fixture() {
  let claimed = false
  let calls = 0
  let reservations = 0
  const deps: ProbeDependencies = {
    verifyHostedState: async () => true, // Synthetic fixture, never evidence of hosted state.
    authorize: async () => true,
    policies: () => ({ conversation: 'openai/gpt-6-luna', report: 'openai/gpt-6.1-sol' }),
    reserve: async () => { reservations++; if (claimed) return false; claimed = true; return true },
    generate: async () => { calls++; return { complete: true, usage } },
  }
  return { deps, calls: () => calls, reservations: () => reservations }
}

test('an unverified hosted receipt blocks before authorization, reservation and provider', async () => {
  const f = fixture()
  let authorized = 0
  f.deps.verifyHostedState = async () => false
  f.deps.authorize = async () => { authorized++; return true }
  assert.equal((await runProbe({ env, origin, deps: f.deps })).status, 'unavailable')
  assert.equal(authorized, 0); assert.equal(f.reservations(), 0); assert.equal(f.calls(), 0)
})

test('a malformed truthy receipt result cannot authorize a hosted write', async () => {
  const f = fixture()
  f.deps.verifyHostedState = async () => 'not-a-verified-receipt' as unknown as boolean
  assert.equal((await runProbe({ env, origin, deps: f.deps })).status, 'unavailable')
  assert.equal(f.reservations(), 0); assert.equal(f.calls(), 0)
})

test('disabled and other environments reject before auth, reservation or generation', async () => {
  for (const [key, value] of [['OPENAI_PROBE_ENABLED', 'off'], ['OPENAI_PROBE_ENABLED', ''], ['VERCEL', '0'], ['NODE_ENV', 'test'], ['VERCEL_ENV', 'production'], ['VERCEL_GIT_COMMIT_REF', 'main'], ['VERCEL_GIT_COMMIT_REF', 'codex/pablo-profile-release'], ['VERCEL_URL', 'example-preview.vercel.app.attacker.invalid'], ['LLM_TRANSPORT', 'gateway'], ['NEXT_PUBLIC_SUPABASE_URL', 'https://unreviewed.supabase.co']]) {
    const f = fixture()
    assert.equal((await runProbe({ env: { ...env, [key]: value }, origin, deps: f.deps })).status, 'unavailable')
    assert.equal(f.reservations(), 0); assert.equal(f.calls(), 0)
  }
})

test('wrong or absent Origin, invalid URL and unauthorized identity reject before reservation', async () => {
  for (const value of ['https://attacker.invalid', 'null', '', 'http://example-preview.vercel.app']) {
    const f = fixture()
    assert.equal((await runProbe({ env, origin: value, deps: f.deps })).status, 'unavailable')
    assert.equal(f.reservations(), 0)
  }
  const f = fixture(); f.deps.authorize = async () => false
  assert.equal((await runProbe({ env, origin, deps: f.deps })).status, 'unavailable')
  assert.equal(f.reservations(), 0)
})

test('unexpected policy and thrown auth/reservation fail closed without provider call', async () => {
  for (const type of ['policy', 'auth', 'reservation']) {
    const f = fixture()
    if (type === 'policy') f.deps.policies = () => ({ conversation: 'openai/gpt-5.4-mini', report: 'openai/gpt-6.1-sol' })
    if (type === 'auth') f.deps.authorize = async () => { throw new Error('SECRET') }
    if (type === 'reservation') f.deps.reserve = async () => { throw new Error('SECRET') }
    const result = await runProbe({ env, origin, deps: f.deps })
    assert.notEqual(result.status, 'success'); assert.equal(f.calls(), 0); assert.doesNotMatch(JSON.stringify(result), /SECRET/)
  }
})

test('atomic reservation allows only one of concurrent invocations and two calls total', async () => {
  const f = fixture()
  const out = await Promise.all(Array.from({ length: 30 }, () => runProbe({ env, origin, deps: f.deps })))
  assert.equal(out.filter(x => x.status === 'success').length, 1)
  assert.equal(f.calls(), 2)
  assert.deepEqual(out.find(x => x.status === 'success')?.usage, [usage, usage])
})

test('a failed or usage-less first call consumes reservation and never makes a second call', async () => {
  for (const mode of ['error', 'usage', 'incomplete']) {
    const f = fixture(); let count = 0
    f.deps.generate = async () => { count++; if (mode === 'error') throw new Error('SECRET'); return { complete: mode !== 'incomplete', usage: mode === 'usage' ? null : usage } }
    const first = await runProbe({ env, origin, deps: f.deps })
    const second = await runProbe({ env, origin, deps: f.deps })
    assert.equal(first.status, 'failed'); assert.equal(second.status, 'unavailable'); assert.equal(count, 1)
    assert.doesNotMatch(JSON.stringify(first), /SECRET/)
  }
})

test('an out-of-bounds or malformed first usage fails closed before the second call', async () => {
  for (const usageValue of [{ inputTokens: -1, outputTokens: 1 }, { inputTokens: 1.1, outputTokens: 1 }, { inputTokens: 8001, outputTokens: 1 }, { inputTokens: 1, outputTokens: 1001 }, { inputTokens: Number.NaN, outputTokens: 1 }]) {
    const f = fixture(); let count = 0
    f.deps.generate = async () => { count++; return { complete: true, usage: usageValue } }
    const result = await runProbe({ env, origin, deps: f.deps })
    assert.equal(result.status, 'failed'); assert.equal(count, 1)
  }
})
