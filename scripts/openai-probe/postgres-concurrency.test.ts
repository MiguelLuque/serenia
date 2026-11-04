/** Synthetic PostgREST transport backed by real ephemeral Postgres via docker exec.
 * Never routes to network; no Supabase or provider credential is used. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/shared/supabase/types'
import { reserveOnce } from '../../app/api/internal/openai-probe/probe-reservation'
import { runProbe, type ProbeDependencies } from '../../app/api/internal/openai-probe/probe-core'
import { dockerCommand } from './docker-command'
import { parseTarget, verifyIdentity, sqlFor } from './probe-container'

const target = parseTarget(process.env)
const execFileAsync = promisify(execFile)
const env = { VERCEL: '1', NODE_ENV: 'production', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'codex/serenia-openai-direct-probe', VERCEL_URL: 'example-preview.vercel.app', NEXT_PUBLIC_SUPABASE_URL: 'https://brpozobkoatabctjjadc.supabase.co', OPENAI_PROBE_ENABLED: 'on', LLM_TRANSPORT: 'openai' }
const cleanEnv = { NODE_ENV: 'test' as const, ...Object.fromEntries(['PATH', 'HOME', 'TMPDIR'].flatMap(key => process.env[key] === undefined ? [] : [[key, process.env[key]]])) }

async function query(scenario: 'race' | 'lost', operation: 'insert' | 'count') {
  const [command, ...prefix] = dockerCommand(process.env.PATH ?? '')
  const options = { timeout: 25_000, maxBuffer: 16_384, env: cleanEnv }
  const template = '{{json .Id}}|{{json .Name}}|{{json .Config.Image}}|{{json .HostConfig.NetworkMode}}|{{json (index .Config.Labels "serenia.chronology-rehearsal")}}'
  const inspected = await execFileAsync(command, [...prefix, '--host', target.endpoint, 'inspect', '--format', template, target.id], options)
  const fields = inspected.stdout.trim().split('|')
  if (fields.length !== 5) throw new Error('Cannot verify test container identity')
  const [id, name, image, network, label] = fields.map(field => JSON.parse(field))
  verifyIdentity(target, { id, name, image, network, label })
  return execFileAsync(command, [...prefix, '--host', target.endpoint, 'exec', '-i', target.id, 'psql', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-c', sqlFor(target, scenario, operation)], options)
}

function clientFor(scenario: 'race' | 'lost', mode: 'normal' | 'lose-ack', counts: { attempts: number }) {
  const fakeFetch: typeof fetch = async (url, init) => {
    counts.attempts++
    if (String(url) !== 'https://fake.supabase.co/rest/v1/audit_log' || init?.method !== 'POST') throw new Error('Unexpected synthetic request')
    const body = JSON.parse(String(init.body))
    assert.deepEqual(body, { id: 'f7c9c98c-bc13-48af-9808-bad1f0daaa7f', actor_type: 'system', entity_type: 'ai_transport_probe', action: 'reserved' })
    try { await query(scenario, 'insert') } catch (error) {
      if (!String((error as { stderr?: string }).stderr).includes('duplicate key value')) throw error
      return new Response(JSON.stringify({ code: '23505', message: 'synthetic duplicate' }), { status: 409, headers: { 'content-type': 'application/json' } })
    }
    if (mode === 'lose-ack') throw new TypeError('synthetic acknowledgement loss after commit')
    return new Response(null, { status: 201 })
  }
  return createClient<Database>('https://fake.supabase.co', 'synthetic-only', { global: { fetch: fakeFetch }, auth: { autoRefreshToken: false, persistSession: false } })
}

test('real PostgreSQL arbitrates concurrent transactions and only one request performs both fake generations', async () => {
  const counts = { attempts: 0 }; const client = clientFor('race', 'normal', counts); let calls = 0
  const deps: ProbeDependencies = { verifyHostedState: async () => true, authorize: async () => true, policies: () => ({ conversation: 'openai/gpt-6-luna', report: 'openai/gpt-6.1-sol' }), reserve: () => reserveOnce(client), generate: async () => { calls++; return { complete: true, usage: { inputTokens: 10, outputTokens: 2 } } } }
  const results = await Promise.all(Array.from({ length: 12 }, () => runProbe({ env, origin: 'https://example-preview.vercel.app', deps })))
  assert.equal(results.filter(x => x.status === 'success').length, 1)
  assert.equal(calls, 2); assert.equal(counts.attempts, 12)
  assert.equal((await query('race', 'count')).stdout.trim(), '1')
})

test('real committed insert with lost response fails closed and conflicts on replay', async () => {
  const counts = { attempts: 0 }; const client = clientFor('lost', 'lose-ack', counts); let calls = 0
  const deps: ProbeDependencies = { verifyHostedState: async () => true, authorize: async () => true, policies: () => ({ conversation: 'openai/gpt-6-luna', report: 'openai/gpt-6.1-sol' }), reserve: () => reserveOnce(client), generate: async () => { calls++; return { complete: true, usage: { inputTokens: 10, outputTokens: 2 } } } }
  const first = await runProbe({ env, origin: 'https://example-preview.vercel.app', deps })
  assert.equal(first.status, 'unavailable'); assert.equal(counts.attempts, 1); assert.equal(calls, 0)
  const second = await runProbe({ env, origin: 'https://example-preview.vercel.app', deps })
  assert.equal(second.status, 'unavailable'); assert.equal(counts.attempts, 2); assert.equal(calls, 0)
  assert.equal((await query('lost', 'count')).stdout.trim(), '1')
})
