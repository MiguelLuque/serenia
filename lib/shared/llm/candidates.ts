import type { LLMRole } from './config'

interface CandidatePreset {
  model: string
  endpoint: 'gateway' | 'decisions' | 'systemone'
  roles: readonly (LLMRole | 'auxiliary')[]
  usdPerMillion: readonly [input: number, output: number, cacheRead: number, cacheWrite: number]
  openaiPremiums: boolean
}

// Research presets only: none are selected by getRoleConfig or patient code.
// USD text rates, standard service; Anthropic writes use the 5-minute tariff.
export const CANDIDATE_PRESETS = {
  sonnet46: { model: 'anthropic/claude-sonnet-4.6', endpoint: 'gateway', roles: ['conversational', 'structured'], usdPerMillion: [3, 15, .3, 3.75], openaiPremiums: false },
  haiku45: { model: 'anthropic/claude-haiku-4.5', endpoint: 'gateway', roles: ['fast'], usdPerMillion: [1, 5, .1, 1.25], openaiPremiums: false },
  sol61: { model: 'openai/gpt-6.1-sol', endpoint: 'gateway', roles: ['conversational', 'structured'], usdPerMillion: [2, 10, .1, 2.5], openaiPremiums: true },
  sonnet55: { model: 'anthropic/claude-sonnet-5.5', endpoint: 'gateway', roles: ['conversational', 'structured'], usdPerMillion: [2, 10, .1, 2.5], openaiPremiums: false },
  luna6: { model: 'openai/gpt-6-luna', endpoint: 'gateway', roles: ['fast'], usdPerMillion: [.1, .5, .01, .125], openaiPremiums: true },
  decisionsLuna: { model: 'gpt-6-luna', endpoint: 'decisions', roles: ['auxiliary'], usdPerMillion: [.1, 0, 0, 0], openaiPremiums: true },
  jev113: { model: 'jev-1.13.0', endpoint: 'systemone', roles: ['auxiliary'], usdPerMillion: [.042, 0, 0, 0], openaiPremiums: false },
} as const satisfies Record<string, CandidatePreset>

type Usage = { inputTokens: number | null; outputTokens: number | null; cacheReadTokens: number | null; cacheWriteTokens: number | null }

// inputTokens includes cache-read/write tokens; outputTokens includes billed
// reasoning. Sum estimates for every attempt, including failures with usage.
// Missing counters remain unknown. The caller declares actual tariff premiums.
export function estimateCost(candidate: keyof typeof CANDIDATE_PRESETS, usage: Usage, premiums: { regional?: boolean; longContext?: boolean } = {}) {
  for (const count of Object.values(usage)) if (count !== null && (!Number.isSafeInteger(count) || count < 0)) throw Error('Invalid usage')
  if (Object.values(usage).some(count => count === null)) return { status: 'unknown' as const, reason: 'usage_missing' as const }
  const { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens } = usage as Record<keyof Usage, number>
  if (cacheReadTokens + cacheWriteTokens > inputTokens) throw Error('Invalid usage')
  const preset = CANDIDATE_PRESETS[candidate]
  if (!preset.openaiPremiums && (premiums.regional || premiums.longContext)) throw Error('Unsupported premium')
  const [input, output, cacheRead, cacheWrite] = preset.usdPerMillion
  const inputCost = (inputTokens - cacheReadTokens - cacheWriteTokens) * input + cacheReadTokens * cacheRead + cacheWriteTokens * cacheWrite
  const usd = (inputCost * (premiums.longContext ? 2 : 1) + outputTokens * output * (premiums.longContext ? 1.5 : 1)) * (premiums.regional ? 1.1 : 1) / 1000000
  return { status: 'estimated' as const, usd: Number(usd.toFixed(12)), pricingSnapshot: '2026-10-11', measured: false }
}
