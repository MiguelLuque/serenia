import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveTaskModel } from '@/lib/server/llm/model-resolver'
import { resolveTaskPolicy } from '@/lib/shared/llm/task-policy'
import { generateOne } from '../../app/api/internal/openai-probe/probe-generation'

test('installed direct resolver and SDK emit exactly two fixed fake HTTP requests, never real network', async () => {
  const original = globalThis.fetch
  const calls: Array<{ url: string; body: Record<string, unknown> }> = []
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    calls.push({ url: String(url), body })
    if (String(url) !== 'https://api.openai.com/v1/responses' || calls.length > 2) throw new Error('Unexpected synthetic request')
    const text = calls.length === 1 ? 'OK' : '{"result":"ok"}'
    return new Response(JSON.stringify({ id: 'resp_fake', object: 'response', created_at: 1, model: body.model, status: 'completed', output: [{ id: 'msg_fake', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] }], error: null, incomplete_details: null, usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } } }), { headers: { 'content-type': 'application/json' } })
  }
  try {
    const env = { LLM_TRANSPORT: 'openai', OPENAI_API_KEY: 'synthetic-key-only', LLM_CONVERSATIONAL_PROVIDER: 'openai', LLM_CONVERSATIONAL_MODEL: 'gpt-6-luna', LLM_CLOSURE_REPORT_PROVIDER: 'openai', LLM_CLOSURE_REPORT_MODEL: 'gpt-6.1-sol' }
    const text = await generateOne(resolveTaskModel(resolveTaskPolicy('conversation', env), env), 'conversation')
    const object = await generateOne(resolveTaskModel(resolveTaskPolicy('closureReport', env), env), 'report')
    assert.equal(text.complete, true); assert.equal(object.complete, true)
    assert.equal(calls.length, 2)
    assert.deepEqual(calls.map(x => x.body.model), ['gpt-6-luna', 'gpt-6.1-sol'])
    for (const call of calls) {
      assert.equal(call.body.store, false)
      assert.equal(call.body.max_output_tokens, 1000)
      assert.ok(!call.body.tools || (Array.isArray(call.body.tools) && call.body.tools.length === 0))
      assert.ok(JSON.stringify(call.body).length < 8000)
    }
    assert.equal(((calls[1].body.text as { format: { type: string } }).format.type), 'json_schema')
  } finally { globalThis.fetch = original }
})
