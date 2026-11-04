/** Offline prototype only. This module requires an independently reviewed route adapter. */
export type Usage = { inputTokens: number; outputTokens: number }
export type Generated = { complete: boolean; usage: Usage | null }
export type ProbeDependencies = {
  /** Production adapter must establish a verified 45-row hosted receipt and reviewed post-write procedure. */
  verifyHostedState: () => Promise<boolean>
  authorize: () => Promise<boolean>
  policies: () => { conversation: string; report: string }
  reserve: () => Promise<boolean>
  generate: (task: 'conversation' | 'report') => Promise<Generated>
}
type Env = Readonly<Record<string, string | undefined>>
type ProbeResult = { status: 'unavailable' | 'failed' } | { status: 'success'; usage: [Usage, Usage] }

function validUsage(value: Usage | null): value is Usage {
  return !!value && Number.isSafeInteger(value.inputTokens) && value.inputTokens >= 0 && value.inputTokens <= 8000 &&
    Number.isSafeInteger(value.outputTokens) && value.outputTokens >= 0 && value.outputTokens <= 1000
}

export async function runProbe({ env, origin, deps }: { env: Env; origin: string | null; deps: ProbeDependencies }): Promise<ProbeResult> {
  const unavailable: ProbeResult = { status: 'unavailable' }
  // VERCEL_URL is supplied by the platform, not derived from Host or forwarded headers.
  const host = env.VERCEL_URL
  if (env.VERCEL !== '1' || env.NODE_ENV !== 'production' || env.VERCEL_ENV !== 'preview' ||
      env.VERCEL_GIT_COMMIT_REF !== 'codex/serenia-openai-direct-probe' || env.OPENAI_PROBE_ENABLED !== 'on' ||
      env.LLM_TRANSPORT !== 'openai' || env.NEXT_PUBLIC_SUPABASE_URL !== 'https://brpozobkoatabctjjadc.supabase.co' || !host || host.length > 253 ||
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.vercel\.app$/.test(host) || origin !== `https://${host}`) return unavailable
  try {
    if (await deps.verifyHostedState() !== true) return unavailable
    if (!await deps.authorize()) return unavailable
    const policy = deps.policies()
    if (policy.conversation !== 'openai/gpt-6-luna' || policy.report !== 'openai/gpt-6.1-sol') return unavailable
    // Reserve before making any provider call. A timeout is uncertain and must
    // never be retried automatically. Production adapter must use an atomic PK.
    if (!await deps.reserve()) return unavailable
    const first = await deps.generate('conversation')
    if (!first.complete || !validUsage(first.usage)) return { status: 'failed' }
    const second = await deps.generate('report')
    if (!second.complete || !validUsage(second.usage)) return { status: 'failed' }
    return { status: 'success', usage: [first.usage, second.usage] }
  } catch {
    // Never expose SDK errors, response bodies, request headers or secrets.
    return { status: 'failed' }
  }
}
