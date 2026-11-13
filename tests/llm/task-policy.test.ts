import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveTaskPolicy } from '@/lib/shared/llm/task-policy'
import { getRoleConfig } from '@/lib/shared/llm/config'
import { llm } from '@/lib/shared/llm/models'

const legacy = {
  LLM_CONVERSATIONAL_PROVIDER: 'openai', LLM_CONVERSATIONAL_MODEL: 'conversation-old',
  LLM_STRUCTURED_PROVIDER: 'openai', LLM_STRUCTURED_MODEL: 'structured-old',
  LLM_FAST_PROVIDER: 'anthropic', LLM_FAST_MODEL: 'unused-fast',
}
afterEach(() => vi.unstubAllEnvs())
describe('task-specific model selection', () => {
  it('keeps the effective legacy routing and task budgets without overrides', () => {
    expect(resolveTaskPolicy('conversation', legacy)).toEqual({ task: 'conversation', modelId: 'openai/conversation-old', timeoutMs: 45_000, maxOutputTokens: 2500, maxRetries: 0 })
    expect(resolveTaskPolicy('profileExtraction', legacy)).toEqual({ task: 'profileExtraction', modelId: 'openai/structured-old', timeoutMs: 20_000, maxOutputTokens: 1500, maxRetries: 0 })
    expect(resolveTaskPolicy('closureReport', legacy)).toEqual({ task: 'closureReport', modelId: 'openai/structured-old', timeoutMs: 45_000, maxOutputTokens: 6000, maxRetries: 0 })
  })
  it('selects profile and report independently without using the fast alias', () => {
    const env = { ...legacy, LLM_PROFILE_EXTRACTION_PROVIDER: 'anthropic', LLM_PROFILE_EXTRACTION_MODEL: 'profile-only', LLM_CLOSURE_REPORT_PROVIDER: 'openai', LLM_CLOSURE_REPORT_MODEL: 'report-only' }
    expect(resolveTaskPolicy('profileExtraction', env).modelId).toBe('anthropic/profile-only')
    expect(resolveTaskPolicy('closureReport', env).modelId).toBe('openai/report-only')
    expect(resolveTaskPolicy('conversation', env).modelId).toBe('openai/conversation-old')
  })
  it.each(['PROFILE_EXTRACTION', 'CLOSURE_REPORT'])('falls back only when both %s variables are absent or blank', prefix => {
    const task = prefix === 'PROFILE_EXTRACTION' ? 'profileExtraction' : 'closureReport'
    for (const pair of [{}, { [`LLM_${prefix}_PROVIDER`]: '', [`LLM_${prefix}_MODEL`]: '   ' }, { [`LLM_${prefix}_MODEL`]: '' }]) {
      expect(resolveTaskPolicy(task, { ...legacy, ...pair }).modelId).toBe('openai/structured-old')
    }
  })
  it.each(['PROFILE_EXTRACTION', 'CLOSURE_REPORT'])('fails closed on incomplete or malformed %s overrides without echoing values', prefix => {
    const task = prefix === 'PROFILE_EXTRACTION' ? 'profileExtraction' : 'closureReport'
    const providerKey = `LLM_${prefix}_PROVIDER`, modelKey = `LLM_${prefix}_MODEL`
    for (const pair of [{ [providerKey]: 'openai' }, { [modelKey]: 'PRIVATE-MODEL' }, { [providerKey]: ' ', [modelKey]: 'PRIVATE-MODEL' }, { [providerKey]: 'PRIVATE/provider', [modelKey]: 'PRIVATE-MODEL' }, { [providerKey]: 'openai', [modelKey]: 'PRIVATE model' }, { [providerKey]: 'openai', [modelKey]: ' model ' }]) {
      const error = (() => { try { resolveTaskPolicy(task, { ...legacy, ...pair }); return null } catch (error) { return error as Error } })()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toContain(providerKey)
      expect(error?.message).toContain(modelKey)
      expect(error?.message).not.toMatch(/PRIVATE|anthropic/)
      expect(error?.cause).toBeUndefined()
    }
  })
  it('retains legacy provider omission fallback and alias compatibility', () => {
    expect(resolveTaskPolicy('conversation', { LLM_CONVERSATIONAL_MODEL: 'legacy-model' }).modelId).toBe('anthropic/legacy-model')
    for (const [key, value] of Object.entries(legacy)) vi.stubEnv(key, value)
    expect(getRoleConfig('structured')).toEqual({ provider: 'openai', model: 'structured-old' })
    expect(llm.conversational()).toBe('openai/conversation-old')
    expect(llm.structured()).toBe('openai/structured-old')
    expect(llm.fast()).toBe('anthropic/unused-fast')
    expect(resolveTaskPolicy('profileExtraction').modelId).toBe('openai/structured-old')
  })
})
