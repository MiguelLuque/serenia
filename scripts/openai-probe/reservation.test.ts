import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/shared/supabase/types'
import { reserveOnce } from '../../app/api/internal/openai-probe/probe-reservation'

test('actual Supabase client issues only one synthetic request per concurrent contender', async () => {
  let exists = false
  let calls = 0
  const fakeFetch: typeof fetch = async (_input, init) => {
    calls++
    assert.equal(init?.method, 'POST')
    const body = JSON.parse(String(init?.body))
    assert.equal(body.id, 'f7c9c98c-bc13-48af-9808-bad1f0daaa7f')
    assert.deepEqual(Object.keys(body).sort(), ['action', 'actor_type', 'entity_type', 'id'])
    if (exists) return new Response(JSON.stringify({ code: '23505', message: 'synthetic duplicate' }), { status: 409, headers: { 'content-type': 'application/json' } })
    exists = true
    return new Response(null, { status: 201 })
  }
  const client = createClient<Database>('https://fake.supabase.co', 'synthetic-only', { global: { fetch: fakeFetch }, auth: { autoRefreshToken: false, persistSession: false } })
  const results = await Promise.all(Array.from({ length: 30 }, () => reserveOnce(client)))
  assert.equal(results.filter(Boolean).length, 1)
  assert.equal(calls, 30)
})

test('lost insert response fails closed without retry; later conflict does not win', async () => {
  let exists = false
  let calls = 0
  const fakeFetch: typeof fetch = async () => {
    calls++
    if (!exists) { exists = true; throw new TypeError('synthetic lost response') }
    return new Response(JSON.stringify({ code: '23505', message: 'duplicate' }), { status: 409, headers: { 'content-type': 'application/json' } })
  }
  const client = createClient<Database>('https://fake.supabase.co', 'synthetic-only', { global: { fetch: fakeFetch }, auth: { autoRefreshToken: false, persistSession: false } })
  assert.equal(await reserveOnce(client), false)
  assert.equal(calls, 1)
  assert.equal(await reserveOnce(client), false)
  assert.equal(calls, 2)
})
