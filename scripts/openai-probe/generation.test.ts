import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MockLanguageModelV3 } from 'ai/test'
import { generateOne } from '../../app/api/internal/openai-probe/probe-generation'

function response(text: string, input = 8, output = 6) {
  return { content: [{ type: 'text' as const, text }], finishReason: { unified: 'stop' as const, raw: undefined }, usage: { inputTokens: { total: input, noCache: input, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: output, text: output, reasoning: undefined } }, warnings: [] }
}

test('actual AI SDK sends one bounded fictional text request with no tools', async () => {
  const model = new MockLanguageModelV3({ doGenerate: async () => response('OK') })
  const result = await generateOne(model, 'conversation')
  assert.deepEqual(result, { complete: true, usage: { inputTokens: 8, outputTokens: 6 } })
  assert.equal(model.doGenerateCalls.length, 1)
  const call = model.doGenerateCalls[0]
  assert.equal(call.maxOutputTokens, 1000)
  assert.ok(!call.tools || call.tools.length === 0)
  assert.ok(JSON.stringify(call.prompt).includes('OK'))
})

test('actual AI SDK validates a small structured response and sends no tools', async () => {
  const model = new MockLanguageModelV3({ doGenerate: async () => response('{"result":"ok"}') })
  const result = await generateOne(model, 'report')
  assert.equal(result.complete, true)
  assert.equal(model.doGenerateCalls.length, 1)
  const call = model.doGenerateCalls[0]
  assert.equal(call.maxOutputTokens, 1000)
  assert.ok(!call.tools || call.tools.length === 0)
  assert.equal(call.responseFormat?.type, 'json')
})

test('bad structured output fails and calls the model at most once', async () => {
  const model = new MockLanguageModelV3({ doGenerate: async () => response('{"result":"unknown"}') })
  await assert.rejects(generateOne(model, 'report'))
  assert.equal(model.doGenerateCalls.length, 1)
})

test('a retryable provider failure is not retried by the installed AI SDK', async () => {
  const { APICallError } = await import('ai')
  const model = new MockLanguageModelV3({ doGenerate: async () => { throw new APICallError({ message: 'synthetic', url: 'https://synthetic.invalid', requestBodyValues: {}, isRetryable: true }) } })
  await assert.rejects(generateOne(model, 'conversation'))
  assert.equal(model.doGenerateCalls.length, 1)
})

test('the SDK passes a 45 second abort signal to the provider and does not retry an abort', async () => {
  const original = AbortSignal.timeout
  let requestedMs = 0
  AbortSignal.timeout = (ms: number) => { requestedMs = ms; return original(20) }
  // The real AbortSignal timeout is unref-ed; keep the synthetic test alive.
  const keepAlive = setTimeout(() => {}, 200)
  const model = new MockLanguageModelV3({ doGenerate: async options => {
    assert.ok(options.abortSignal)
    return await new Promise((_resolve, reject) => options.abortSignal!.addEventListener('abort', () => reject(options.abortSignal!.reason), { once: true }))
  } })
  try {
    await assert.rejects(generateOne(model, 'conversation'))
    assert.equal(requestedMs, 45_000)
    assert.equal(model.doGenerateCalls.length, 1)
  } finally { AbortSignal.timeout = original; clearTimeout(keepAlive) }
})
