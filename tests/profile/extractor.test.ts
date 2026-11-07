import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { generateText } = vi.hoisted(() => ({ generateText: vi.fn() }))
vi.mock('ai', async original => ({ ...await original<typeof import('ai')>(), generateText }))
import { ProfileExtractionSchema } from '@/lib/shared/profile/schema'
import { canonicalProfileSource, extractProfileObservations, validateProfileExtraction } from '@/lib/server/profile/extractor'
const id = '11111111-1111-4111-8111-111111111111'
const observation = { category: 'concern', quote: 'Me cuesta dormir', time_scope: 'current', supersedes_id: null }
const target = { id, category: 'concern', quote: 'Dormía bien', time_scope: 'current', status: 'confirmed', source_created_at: '2026-10-01T12:00:00Z' }
beforeEach(() => {
  vi.stubEnv('LLM_STRUCTURED_PROVIDER', 'synthetic')
  vi.stubEnv('LLM_STRUCTURED_MODEL', 'structured')
  vi.stubEnv('LLM_PROFILE_EXTRACTION_PROVIDER', '')
  vi.stubEnv('LLM_PROFILE_EXTRACTION_MODEL', '')
  generateText.mockReset().mockResolvedValue({ output: { observations: [observation] } }) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })
describe('literal bounded profile extraction', () => {
  it('preserves text-part order and LF exactly, without normalization or assistant content', () => {
    expect(canonicalProfileSource([{ type: 'text', text: 'Á' }, { type: 'tool', text: 'omitido' }, { type: 'text', text: '🙂' }])).toBe('Á\n🙂')
  })
  it('accepts empty results and returns only the literal observation fields', () => {
    expect(validateProfileExtraction({ observations: [] }, '', [])).toEqual({ observations: [] })
    expect(validateProfileExtraction({ observations: [observation] }, 'Hoy: Me cuesta dormir.', [])).toEqual({ observations: [observation] })
  })
  it.each([
    { observations: Array(6).fill(observation) },
    { observations: [{ ...observation, quote: 'Me cuesta Dormir' }] },
    { observations: [{ ...observation, quote: '' }] },
    { observations: [{ ...observation, quote: 'x'.repeat(401) }] },
    { observations: [observation, observation] },
    { observations: [{ ...observation, supersedes_id: id }] },
    { observations: [{ ...observation, diagnosis: 'inferido' }] },
    { observations: [{ ...observation, category: 'diagnosis' }] },
    { observations: [observation], score: 2 },
  ])('rejects the entire malformed or ungrounded output %#', output => {
    expect(() => validateProfileExtraction(output, 'Me cuesta dormir' + 'x'.repeat(401), [])).toThrow('profile_extraction_invalid')
  })
  it('counts PostgreSQL characters rather than UTF16 units at source and quote boundaries', () => {
    const quote = '🙂'.repeat(400)
    expect(validateProfileExtraction({ observations: [{ ...observation, quote }] }, '🙂'.repeat(8000), [])).toMatchObject({ observations: [{ quote }] })
    expect(() => validateProfileExtraction({ observations: [] }, '🙂'.repeat(8001), [])).toThrow('profile_source_invalid')
    expect(() => validateProfileExtraction({ observations: [] }, '\u0000', [])).toThrow('profile_source_invalid')
  })
  it('allows correction references only to confirmed, same-category known targets', () => {
    const output = { observations: [{ ...observation, supersedes_id: id }] }
    expect(validateProfileExtraction(output, observation.quote, [target])).toEqual(output)
    for (const change of [{ status: 'pending' }, { status: 'rejected' }, { category: 'history' }]) {
      expect(() => validateProfileExtraction(output, observation.quote, [{ ...target, ...change }])).toThrow('profile_extraction_invalid')
    }
  })
  it('schema never accepts diagnostic fields even before source validation', () => {
    expect(ProfileExtractionSchema.safeParse({ observations: [{ ...observation, clinical_notes: 'x' }] }).success).toBe(false)
  })
  it('uses structured output with a bounded single call and JSON data prompt', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    expect(await extractProfileObservations('Me cuesta dormir', [target])).toEqual({ observations: [observation] })
    const options = generateText.mock.calls[0][0]
    expect(options).toMatchObject({ model: 'synthetic/structured', maxOutputTokens: 1500, maxRetries: 0, output: { name: 'object' } })
    expect(options.abortSignal).toBeInstanceOf(AbortSignal)
    expect(timeout).toHaveBeenCalledWith(20_000)
    expect(JSON.parse(options.prompt)).toEqual({ sourceText: 'Me cuesta dormir', knownTargets: [target] })
  })
  it('honors a captured profile policy instead of resolving the changed environment again', async () => {
    vi.stubEnv('LLM_PROFILE_EXTRACTION_PROVIDER', 'openai')
    vi.stubEnv('LLM_PROFILE_EXTRACTION_MODEL', 'changed-after-capture')
    await extractProfileObservations('Me cuesta dormir', [], { task: 'profileExtraction', modelId: 'synthetic/captured', timeoutMs: 20_000, maxOutputTokens: 1500, maxRetries: 0 })
    expect(generateText.mock.calls[0][0].model).toBe('synthetic/captured')
  })
  it('does not send oversize input or excess correction references to the provider', async () => {
    await expect(extractProfileObservations('x'.repeat(8001), [])).rejects.toThrow('profile_source_invalid')
    await expect(extractProfileObservations('Hola', Array(21).fill(target))).rejects.toThrow('profile_targets_invalid')
    expect(generateText).not.toHaveBeenCalled()
  })
  it('does not leak provider text, causes or raw errors to workflow history', async () => {
    generateText.mockRejectedValue(new Error('PRIVATE PROVIDER TEXT'))
    const error = await extractProfileObservations('Hola', []).catch(error => error)
    expect(error.message).toBe('profile_extraction_failed')
    expect(error.cause).toBeUndefined()
  })
  // Semantic corpus inputs exercise literal transport only. Provider/Pablo review
  // must establish the intended third-party, negation and historical meanings.
  it.each(['Mi hermana dice que no duerme.', 'Antes no podía dormir; ahora sí.', 'Yo decía «soy un desastre»; no lo afirmo ahora.', 'Quiero estar mejor 🙂'])('preserves semantic corpus source verbatim: %s', async sourceText => {
    generateText.mockResolvedValue({ output: { observations: [] } })
    await extractProfileObservations(sourceText, [])
    expect(JSON.parse(generateText.mock.calls[0][0].prompt).sourceText).toBe(sourceText)
  })
})
