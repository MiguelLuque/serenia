import { describe, expect, it, vi } from 'vitest'
import { buildAuxiliaryRequest, evaluateAuxiliary, getAuxiliaryMode, type AuxiliaryTransport } from '@/lib/server/llm/auxiliary'

const usage = { input_tokens: 1000, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 }, output_tokens: 0, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 1000 }
const probabilities = [{ value: 'work', probability: .8 }, { value: 'sleep', probability: .1 }, { value: 'other', probability: .05 }, { value: 'insufficient', probability: .05 }]
const openai = { model: 'gpt-6-luna', usage, answers: [{ type: 'choice', name: 'theme', choice: 'work', confidence: .7, probabilities }] }
const jev = { model: 'jev-1.13.0', usage: { input_tokens: 1000, output_tokens: 12 }, answers: { theme: { type: 'choice', choice: 'work', confidence: .7, probabilities: { work: .8, sleep: .1, other: .05, insufficient: .05 } } } }
const transport = (body: unknown, status = 200): AuxiliaryTransport => async () => ({ status, body: JSON.stringify(body) })

describe('bounded readonly auxiliary adapter', () => {
  it('defaults off and cannot be enabled by an unknown mode', async () => {
    expect(getAuxiliaryMode({})).toBe('off')
    expect(getAuxiliaryMode({ FEATURE_AUXILIARY_DECISIONS: 'on' })).toBe('off')
    let called = false
    const result = await evaluateAuxiliary('Trabajo demasiado', { provider: 'openai', transport: async () => { called = true; throw Error('unexpected') } })
    expect(result).toEqual({ status: 'abstain', reason: 'disabled', intent: 'shadow_review_only' })
    expect(called).toBe(false)
  })

  it.each([['openai', openai], ['jev', jev]] as const)('normalizes %s native results without claiming calibration', async (provider, body) => {
    const result = await evaluateAuxiliary('Trabajo demasiado', { mode: 'shadow', provider, transport: transport(body) })
    expect(result).toMatchObject({ status: 'ok', theme: 'work', providerConfidence: .7, model: body.model, intent: 'shadow_review_only' })
    expect(result).not.toHaveProperty('evidence')
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('uses the native request shape and validates option permutations', () => {
    const reverse = ['insufficient', 'other', 'sleep', 'work'] as const
    expect(buildAuxiliaryRequest('openai', 'Texto', reverse)).toMatchObject({ input: 'Texto', questions: [{ name: 'theme', type: 'choice', choices: reverse.map(value => ({ value })) }] })
    expect(buildAuxiliaryRequest('jev', 'Texto')).toMatchObject({ state: 'Texto', questions: { theme: { type: 'choice', criteria: { work: expect.any(String) } } } })
    expect(() => buildAuxiliaryRequest('openai', 'Texto', ['work', 'work', 'other', 'insufficient'])).toThrow('Invalid option order')
  })

  it('uses identities rather than probability array order', async () => {
    const body = { ...openai, answers: [{ ...openai.answers[0], probabilities: [...probabilities].reverse() }] }
    const result = await evaluateAuxiliary('Trabajo', { mode: 'shadow', provider: 'openai', transport: transport(body) })
    expect(result).toMatchObject({ status: 'ok', probabilities: { work: .8, sleep: .1, other: .05, insufficient: .05 } })
  })

  it('abstains explicitly on refusal and insufficient information', async () => {
    expect(await evaluateAuxiliary('Texto', { mode: 'shadow', provider: 'openai', transport: transport({ ...openai, answers: [{ type: 'refusal', name: 'theme' }] }) })).toMatchObject({ status: 'abstain', reason: 'refusal' })
    const answer = { type: 'choice', name: 'theme', choice: 'insufficient', confidence: .9, probabilities: probabilities.map(p => ({ ...p, probability: p.value === 'insufficient' ? 1 : 0 })) }
    expect(await evaluateAuxiliary('Texto', { mode: 'shadow', provider: 'openai', transport: transport({ ...openai, answers: [answer] }) })).toMatchObject({ status: 'abstain', reason: 'insufficient_information' })
  })

  it.each([
    { ...openai, answers: [] },
    { ...openai, answers: [{ ...openai.answers[0], name: 'other_question' }] },
    { ...openai, answers: [{ ...openai.answers[0], choice: 'diagnosis' }] },
    { ...openai, answers: [{ ...openai.answers[0], confidence: 2 }] },
    { ...openai, answers: [{ ...openai.answers[0], probabilities: [...probabilities, probabilities[0]] }] },
    { ...openai, answers: [{ ...openai.answers[0], probabilities: probabilities.slice(1) }] },
    { ...openai, answers: [{ ...openai.answers[0], choice: 'sleep' }] },
    { ...openai, usage: { ...usage, total_tokens: 1 } },
    { ...openai, usage: { input_tokens: 1000, output_tokens: 0 } },
    { ...openai, unsupported: 'extra' },
  ])('fails closed on a malformed native envelope %#', async body => {
    expect(await evaluateAuxiliary('Texto', { mode: 'shadow', provider: 'openai', transport: transport(body) })).toMatchObject({ status: 'error', code: 'invalid_response' })
  })

  it.each([429, 500, 529])('does not retry HTTP %s', async status => {
    let attempts = 0
    const result = await evaluateAuxiliary('Texto', { mode: 'shadow', provider: 'jev', transport: async () => { attempts++; return { status, body: 'private error' } } })
    expect(result).toMatchObject({ status: 'error', code: 'provider_http' })
    expect(attempts).toBe(1)
    expect(JSON.stringify(result)).not.toContain('private error')
  })

  it('rejects oversize input/output and invalid JSON without exposing it', async () => {
    let calls = 0
    const request: AuxiliaryTransport = async () => { calls++; return { status: 200, body: '{}' } }
    expect(await evaluateAuxiliary('a'.repeat(4001), { mode: 'shadow', provider: 'jev', transport: request })).toMatchObject({ status: 'error', code: 'invalid_input' })
    expect(calls).toBe(0)
    for (const body of ['{PRIVATE', 'x'.repeat(16385)]) {
      expect(await evaluateAuxiliary('Texto', { mode: 'shadow', provider: 'jev', transport: async () => ({ status: 200, body }) })).toMatchObject({ status: 'error', code: 'invalid_response' })
    }
  })

  it('aborts a timed out attempt and sanitizes thrown transport errors', async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    const pending = evaluateAuxiliary('Texto', { mode: 'shadow', provider: 'jev', transport: async (_request, s) => { signal = s; return new Promise(() => {}) } })
    await vi.advanceTimersByTimeAsync(2000)
    expect(await pending).toMatchObject({ status: 'error', code: 'timeout' })
    expect(signal?.aborted).toBe(true)
    vi.useRealTimers()
    expect(await evaluateAuxiliary('Texto', { mode: 'shadow', provider: 'jev', transport: async () => { throw Error('PRIVATE') } })).toMatchObject({ status: 'error', code: 'transport' })
  })
})
