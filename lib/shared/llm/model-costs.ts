import snapshot from './pricing-snapshot-2026-11-01.json'

export type Usage = { inputTokens: number | null; outputTokens: number | null; cacheReadTokens: number | null; cacheWriteTokens: number | null }
export type CallGroup = { modelId: string; calls: number; usage: Usage; processingMode?: string }
type Tier = { cost: string; min: number; max?: number }
type Rate = 'input' | 'output' | 'input_cache_read' | 'input_cache_write'
type Pricing = Partial<Record<Rate, string> & Record<`${Rate}_tiers`, Tier[]>>
type PriceResult = { status: 'estimated'; usd: number; pricingSnapshot: string; measured: false } | { status: 'unknown'; reason: 'usage_missing' | 'rate_missing' | 'unsupported_mode'; modelId: string }
type ProjectionResult = ({ status: 'estimated'; usd: number } | { status: 'unknown'; reason: 'usage_missing' | 'rate_missing' | 'unsupported_mode'; modelId: string }) & { calls: number; pricingSnapshot: string; measured: false }

export const PRICING_SNAPSHOT = {
  date: snapshot.snapshotDate,
  source: snapshot.source,
  fullCatalogSha256: snapshot.fullCatalogSha256,
  processingMode: snapshot.processingMode,
} as const

function modelPricing(modelId: string): Pricing {
  const model = snapshot.models.find(candidate => candidate.id === modelId)
  if (!model) throw new Error('Unknown model')
  return model.pricing
}

function checkedUsage(usage: Usage): void {
  for (const count of Object.values(usage)) {
    if (count !== null && (!Number.isSafeInteger(count) || count < 0)) throw new Error('Invalid usage')
  }
  if (usage.inputTokens !== null && usage.cacheReadTokens !== null && usage.cacheWriteTokens !== null && usage.cacheReadTokens + usage.cacheWriteTokens > usage.inputTokens) throw new Error('Invalid usage')
}

function selectedRate(pricing: Pricing, rate: Rate, inputTokens: number): number | null {
  const tiers = pricing[`${rate}_tiers`]
  const found = tiers?.find(tier => tier.min <= inputTokens && (tier.max === undefined || inputTokens < tier.max))
  const value = tiers ? found?.cost : pricing[rate]
  return value === undefined ? null : Number(value) * 1_000_000
}

// Each call chooses one whole-request tier from its input count. Output includes
// billed reasoning; cache classes replace ordinary input rather than adding it.
export function priceAttempt(modelId: string, usage: Usage, processingMode = 'standard'): PriceResult {
  const pricing = modelPricing(modelId)
  checkedUsage(usage)
  if (processingMode !== snapshot.processingMode) return { status: 'unknown', reason: 'unsupported_mode', modelId }
  if (Object.values(usage).some(count => count === null)) return { status: 'unknown', reason: 'usage_missing', modelId }
  const { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens } = usage as Record<keyof Usage, number>
  const ordinaryTokens = inputTokens - cacheReadTokens - cacheWriteTokens
  const classes: readonly [Rate, number][] = [['input', ordinaryTokens], ['output', outputTokens], ['input_cache_read', cacheReadTokens], ['input_cache_write', cacheWriteTokens]]
  let usd = 0
  for (const [rate, tokens] of classes) {
    if (tokens === 0) continue
    const perMillion = selectedRate(pricing, rate, inputTokens)
    if (perMillion === null) return { status: 'unknown', reason: 'rate_missing', modelId }
    usd += tokens * perMillion / 1_000_000
  }
  return { status: 'estimated', usd: Number(usd.toFixed(12)), pricingSnapshot: snapshot.snapshotDate, measured: false }
}

// Include continuations and retry attempts as additional groups: prior attempts
// remain billable. Unknown in any nonzero group makes the total unknown.
export function estimateProjection(groups: readonly CallGroup[]): ProjectionResult {
  let calls = 0
  let usd = 0
  for (const group of groups) {
    modelPricing(group.modelId)
    if (!Number.isSafeInteger(group.calls) || group.calls < 0 || !Number.isSafeInteger(calls + group.calls)) throw new Error('Invalid calls')
    calls += group.calls
  }
  for (const group of groups) {
    if (group.calls === 0) continue
    const result = priceAttempt(group.modelId, group.usage, group.processingMode)
    if (result.status === 'unknown') return { ...result, calls, pricingSnapshot: snapshot.snapshotDate, measured: false }
    usd += result.usd * group.calls
  }
  return { status: 'estimated', usd: Number(usd.toFixed(12)), calls, pricingSnapshot: snapshot.snapshotDate, measured: false }
}
