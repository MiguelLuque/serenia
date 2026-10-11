import { expect, it } from 'vitest'
import { CANDIDATE_PRESETS, estimateCost } from '@/lib/shared/llm/candidates'

it('estimates base generative rates for known usage, without changing patient roles', () => {
  expect(estimateCost('sol61', { inputTokens: 1000000, outputTokens: 1000000, cacheReadTokens: 0, cacheWriteTokens: 0 })).toEqual({ status: 'estimated', usd: 12, pricingSnapshot: '2026-10-11', measured: false })
  expect(estimateCost('sonnet46', { inputTokens: 1000000, outputTokens: 1000000, cacheReadTokens: 0, cacheWriteTokens: 0 })).toMatchObject({ usd: 18 })
  expect(CANDIDATE_PRESETS.sol61.roles).toEqual(['conversational', 'structured'])
})

it('accounts separately for cache reads/writes, premiums and all supplied attempts', () => {
  expect(estimateCost('sol61', { inputTokens: 4000, outputTokens: 600, cacheReadTokens: 3000, cacheWriteTokens: 0 })).toMatchObject({ usd: .0083 })
  expect(estimateCost('sol61', { inputTokens: 1000000, outputTokens: 1000000, cacheReadTokens: 200000, cacheWriteTokens: 100000 }, { regional: true, longContext: true })).toMatchObject({ usd: 20.174 })
  const attempts = [1000, 1000].map(inputTokens => estimateCost('decisionsLuna', { inputTokens, outputTokens: 999, cacheReadTokens: 0, cacheWriteTokens: 0 }))
  expect(attempts).toEqual(Array(2).fill({ status: 'estimated', usd: .0001, pricingSnapshot: '2026-10-11', measured: false }))
})

it('reports unknown usage and rejects invalid token counts or unsupported premiums', () => {
  expect(estimateCost('jev113', { inputTokens: null, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })).toEqual({ status: 'unknown', reason: 'usage_missing' })
  for (const inputTokens of [-1, NaN, Infinity, .5]) expect(() => estimateCost('sol61', { inputTokens, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })).toThrow('Invalid usage')
  expect(() => estimateCost('sol61', { inputTokens: 10, outputTokens: 0, cacheReadTokens: 11, cacheWriteTokens: 0 })).toThrow('Invalid usage')
  expect(() => estimateCost('jev113', { inputTokens: 1000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, { regional: true })).toThrow('Unsupported premium')
})
