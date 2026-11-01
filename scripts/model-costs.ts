import { estimateProjection, PRICING_SNAPSHOT, type CallGroup } from '../lib/shared/llm/model-costs'

// Synthetic tokens per call, including any billed reasoning in output.
const baseline = (profileCalls: number): CallGroup[] => [
  { modelId: 'openai/gpt-5.4-mini', calls: 20, usage: { inputTokens: 8000, outputTokens: 600, cacheReadTokens: 0, cacheWriteTokens: 0 } },
  { modelId: 'openai/gpt-5.4-mini', calls: profileCalls, usage: { inputTokens: 6000, outputTokens: 1000, cacheReadTokens: 0, cacheWriteTokens: 0 } },
  { modelId: 'openai/gpt-5.4-mini', calls: 1, usage: { inputTokens: 16000, outputTokens: 2500, cacheReadTokens: 0, cacheWriteTokens: 0 } },
]

const candidate = (profileCalls: number): CallGroup[] => baseline(profileCalls).map((group, index) => ({
  ...group,
  modelId: index === 2 ? 'openai/gpt-6.1-sol' : 'openai/gpt-6-luna',
}))

const scenario = (profileCalls: number) => ({
  calls: 21 + profileCalls,
  baseline: estimateProjection(baseline(profileCalls)),
  lunaLunaSol: estimateProjection(candidate(profileCalls)),
})

if (process.argv.length !== 2) {
  process.stderr.write('Usage: npm run ai:costs (no runtime options or online mode)\n')
  process.exitCode = 1
} else {
  process.stdout.write(JSON.stringify({
    snapshot: PRICING_SNAPSHOT,
    onlineCalls: 0,
    unit: 'synthetic session',
    assumptions: ['USD token estimates only', 'standard short-context rates selected per call', 'no cache hits or writes', 'no retries or tool continuations in base scenarios', 'output includes billed reasoning', 'regional, storage, tools, taxes and provider access excluded'],
    scenarios: {
      currentCadence: scenario(20),
      hypotheticalFourProfileCalls: scenario(4),
    },
  }, null, 2) + '\n')
}
