import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateText, Output, stepCountIs, tool } from 'ai'
import { z } from 'zod'
import { resolveTaskModel } from '@/lib/server/llm/model-resolver'
import type { TaskPolicy } from '@/lib/shared/llm/task-policy'

const policy: TaskPolicy = { task: 'conversation', modelId: 'openai/gpt-6-luna', timeoutMs: 45_000, maxOutputTokens: 2500, maxRetries: 0 }
const direct = { LLM_TRANSPORT: 'openai', OPENAI_API_KEY: 'synthetic-openai-only' }
const message = (text: string) => ({ id: 'msg_synthetic', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] })
function response(output: unknown[] = [message('OK')]) {
  return { id: 'resp_synthetic', object: 'response', created_at: 1, model: 'gpt-6-luna', status: 'completed', output, error: null, incomplete_details: null, usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } } }
}
function transport(outputs: unknown[]) {
  const requests: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> = []
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    requests.push({ url: String(url), headers: new Headers(init.headers), body: JSON.parse(String(init.body)) })
    if (outputs.length === 0) throw Error('Unexpected extra request')
    return new Response(JSON.stringify(outputs.shift()), { headers: { 'content-type': 'application/json' } })
  })
  return requests
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('task model transport boundary', () => {
  it.each([undefined, '', 'gateway'])('preserves Gateway routing with transport %s without requiring OpenAI credentials', value => {
    expect(resolveTaskModel(policy, { LLM_TRANSPORT: value })).toBe('openai/gpt-6-luna')
    expect(resolveTaskModel({ ...policy, modelId: 'anthropic/claude-sonnet-5.5' }, { LLM_TRANSPORT: value })).toBe('anthropic/claude-sonnet-5.5')
  })
  it.each(['direct', 'OPENAI', ' openai ', 'private-transport'])('rejects invalid transport without leaking values or falling back: %s', value => {
    expect(() => resolveTaskModel(policy, { LLM_TRANSPORT: value })).toThrow('Invalid LLM_TRANSPORT')
  })
  it.each([undefined, '', '   '])('requires a nonblank explicit OpenAI key: %s', key => {
    expect(() => resolveTaskModel(policy, { LLM_TRANSPORT: 'openai', OPENAI_API_KEY: key })).toThrow('Missing OPENAI_API_KEY')
  })
  it('rejects a non-OpenAI task instead of routing it through another service', () => {
    expect(() => resolveTaskModel({ ...policy, modelId: 'anthropic/private-model' }, direct)).toThrow('Direct OpenAI transport requires an OpenAI model')
  })
  it('sends the configured model directly to official Responses with explicit server key and store false', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'synthetic-gateway-must-not-be-used')
    vi.stubEnv('OPENAI_BASE_URL', 'https://synthetic.invalid/must-not-be-used')
    const requests = transport([response()])
    const result = await generateText({ model: resolveTaskModel(policy, direct), prompt: 'Prueba ficticia', maxOutputTokens: 32, maxRetries: 0, providerOptions: { openai: { store: true } } })
    expect(result.text).toBe('OK')
    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe('https://api.openai.com/v1/responses')
    expect(requests[0].headers.get('authorization')).toBe('Bearer synthetic-openai-only')
    expect(requests[0].body).toMatchObject({ model: 'gpt-6-luna', store: false, max_output_tokens: 32 })
  })
  it('retains schema-validated output through the direct adapter', async () => {
    const requests = transport([response([message('{"observations":[]}')])])
    const result = await generateText({ model: resolveTaskModel({ ...policy, task: 'profileExtraction' }, direct), prompt: 'Caso ficticio', output: Output.object({ schema: z.object({ observations: z.array(z.string()) }) }), maxRetries: 0 })
    expect(result.output).toEqual({ observations: [] })
    expect(requests[0].body).toMatchObject({ store: false, text: { format: { type: 'json_schema' } } })
  })
  it('continues after a controlled tool result without remote response storage', async () => {
    const call = { id: 'fc_synthetic', type: 'function_call', call_id: 'call_synthetic', name: 'lookup', arguments: '{}' }
    const reasoning = { type: 'reasoning', id: 'rs_synthetic', summary: [], encrypted_content: 'synthetic-opaque-reasoning' }
    const requests = transport([response([reasoning, call]), response([message('Resultado ficticio')])])
    let executions = 0
    const result = await generateText({ model: resolveTaskModel(policy, direct), prompt: 'Consulta ficticia', maxRetries: 0, stopWhen: stepCountIs(2), tools: { lookup: tool({ inputSchema: z.object({}), execute: async () => { executions++; return { available: true } } }) } })
    expect(result.text).toBe('Resultado ficticio')
    expect(executions).toBe(1)
    expect(requests).toHaveLength(2)
    expect(requests.every(request => request.url === 'https://api.openai.com/v1/responses' && request.body.store === false)).toBe(true)
    expect(requests[1].body.input).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'function_call_output', call_id: 'call_synthetic' })]))
    expect(requests[1].body.input).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'reasoning', encrypted_content: 'synthetic-opaque-reasoning' })]))
    expect(requests[1].body.previous_response_id).toBeUndefined()
  })
  it('does not retry a direct 503 or fall back to Gateway', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => { urls.push(String(url)); return new Response('{"error":{"message":"Synthetic unavailable","type":"server_error","code":"server_error"}}', { status: 503, headers: { 'content-type': 'application/json' } }) })
    await expect(generateText({ model: resolveTaskModel(policy, direct), prompt: 'Ficticio', maxRetries: policy.maxRetries })).rejects.toThrow()
    expect(urls).toEqual(['https://api.openai.com/v1/responses'])
  })
})
