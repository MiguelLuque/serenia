import { describe, expect, it } from 'vitest'
import { estimateProjection, priceAttempt } from '@/lib/shared/llm/model-costs'

const usage = (inputTokens: number | null, outputTokens: number | null, cacheReadTokens: number | null = 0, cacheWriteTokens: number | null = 0) => ({ inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens })

describe('offline model costs', () => {
  it('prices current 20-message cadence and keeps four profile calls hypothetical', () => {
    const current = [
      { modelId: 'openai/gpt-5.4-mini', calls: 20, usage: usage(8000, 600) },
      { modelId: 'openai/gpt-5.4-mini', calls: 20, usage: usage(6000, 1000) },
      { modelId: 'openai/gpt-5.4-mini', calls: 1, usage: usage(16000, 2500) },
    ]
    expect(estimateProjection(current)).toMatchObject({ status: 'estimated', usd: 0.37725, calls: 41 })
    expect(estimateProjection([{ ...current[0], modelId: 'openai/gpt-6-luna' }, { ...current[1], modelId: 'openai/gpt-6-luna' }, { ...current[2], modelId: 'openai/gpt-6.1-sol' }])).toMatchObject({ status: 'estimated', usd: 0.101, calls: 41 })
    expect(estimateProjection([{ ...current[0] }, { ...current[1], calls: 4 }, current[2] ])).toMatchObject({ status: 'estimated', usd: 0.23325, calls: 25 })
    expect(estimateProjection([{ ...current[0], modelId: 'openai/gpt-6-luna' }, { ...current[1], modelId: 'openai/gpt-6-luna', calls: 4 }, { ...current[2], modelId: 'openai/gpt-6.1-sol' }])).toMatchObject({ status: 'estimated', usd: 0.0834, calls: 25 })
  })

  it('uses whole-call tiers at their exact boundaries, not aggregate session tokens', () => {
    expect(priceAttempt('openai/gpt-6-luna', usage(272000, 1000))).toMatchObject({ status: 'estimated', usd: 0.0277 })
    expect(priceAttempt('openai/gpt-6-luna', usage(272001, 1000))).toMatchObject({ status: 'estimated', usd: 0.0551502 })
    expect(priceAttempt('anthropic/claude-haiku-5.5', usage(100000, 1000))).toMatchObject({ status: 'estimated', usd: 0.0105 })
    expect(priceAttempt('anthropic/claude-haiku-5.5', usage(100001, 1000))).toMatchObject({ status: 'estimated', usd: 0.0525005 })
    expect(estimateProjection([{ modelId: 'openai/gpt-6-luna', calls: 2, usage: usage(200000, 0) }])).toMatchObject({ status: 'estimated', usd: 0.04 })
  })

  it('replaces normal input with actual cache classes and adds billed attempts', () => {
    expect(priceAttempt('openai/gpt-6-luna', usage(100000, 1000, 20000, 10000))).toMatchObject({ status: 'estimated', usd: 0.00895 })
    expect(estimateProjection([
      { modelId: 'openai/gpt-6-luna', calls: 1, usage: usage(8000, 600) },
      { modelId: 'openai/gpt-6.1-terra', calls: 1, usage: usage(8000, 600) },
    ])).toMatchObject({ status: 'estimated', usd: 0.0121, calls: 2 })
  })

  it('makes missing usage and unsupported prices unknown, never zero', () => {
    expect(priceAttempt('openai/gpt-5.4-mini', usage(null, 0))).toMatchObject({ status: 'unknown', reason: 'usage_missing' })
    expect(priceAttempt('openai/gpt-5.4-mini', usage(100, 0, 0, 1))).toMatchObject({ status: 'unknown', reason: 'rate_missing' })
    expect(priceAttempt('openai/gpt-6-luna', usage(100, 0), 'batch')).toMatchObject({ status: 'unknown', reason: 'unsupported_mode' })
    expect(estimateProjection([{ modelId: 'openai/gpt-6-luna', calls: 1, usage: usage(100, null) }])).toMatchObject({ status: 'unknown', reason: 'usage_missing' })
    expect(estimateProjection([
      { modelId: 'openai/gpt-6-luna', calls: 1, usage: usage(100, null) },
      { modelId: 'openai/gpt-6.1-sol', calls: 2, usage: usage(100, 100) },
    ])).toMatchObject({ status: 'unknown', calls: 3 })
    expect(estimateProjection([{ modelId: 'openai/gpt-6-luna', calls: 0, usage: usage(null, null, null, null) }])).toMatchObject({ status: 'estimated', usd: 0, calls: 0 })
  })

  it('rejects invalid counters, call counts and unknown model IDs', () => {
    for (const value of [-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) expect(() => priceAttempt('openai/gpt-6-luna', usage(value, 0))).toThrow('Invalid usage')
    expect(() => priceAttempt('openai/gpt-6-luna', usage(10, 0, 9, 2))).toThrow('Invalid usage')
    expect(() => priceAttempt('unknown/model', usage(1, 0))).toThrow('Unknown model')
    expect(() => estimateProjection([{ modelId: 'openai/gpt-6-luna', calls: -1, usage: usage(1, 0) }])).toThrow('Invalid calls')
  })

  it('rejects a known cache count above input even when its sibling is missing', () => {
    expect(() => priceAttempt('openai/gpt-6-luna', usage(10, 0, 11, null))).toThrow('Invalid usage')
    expect(() => priceAttempt('openai/gpt-6-luna', usage(10, 0, null, 11))).toThrow('Invalid usage')
  })

  it('validates known usage in zero-call groups before returning zero cost', () => {
    expect(() => estimateProjection([{ modelId: 'openai/gpt-6-luna', calls: 0, usage: usage(-1, 0) }])).toThrow('Invalid usage')
    expect(() => estimateProjection([{ modelId: 'openai/gpt-6-luna', calls: 0, usage: usage(10, 0, 11, null) }])).toThrow('Invalid usage')
  })
})
