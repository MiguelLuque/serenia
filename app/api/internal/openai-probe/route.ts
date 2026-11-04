/** PROTOTYPE ONLY: see docs/audits/2026-11-04-direct-openai-probe.md before deployment. */
import { createAuthenticatedClient, createServiceRoleClient } from '@/lib/server/supabase/server'
import { clinicalPilotEnabled } from '@/lib/server/llm/clinical-pilot'
import { resolveTaskModel } from '@/lib/server/llm/model-resolver'
import { resolveTaskPolicy } from '@/lib/shared/llm/task-policy'
import { runProbe } from './probe-core'
import { generateOne } from './probe-generation'
import { reserveOnce } from './probe-reservation'
import { verifiedHostedReadback } from './hosted-receipt-gate'
import type { LanguageModel } from 'ai'

export const runtime = 'nodejs'
export const maxDuration = 120
export async function POST(request: Request) {
  let models: { conversation: LanguageModel; report: LanguageModel } | undefined
  const result = await runProbe({
    env: process.env,
    origin: request.headers.get('origin'),
    deps: {
      verifyHostedState: verifiedHostedReadback,
      authorize: async () => {
        const supabase = await createAuthenticatedClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        return !error && !!user && clinicalPilotEnabled(process.env, user.id)
      },
      policies: () => {
        const conversation = resolveTaskPolicy('conversation')
        const report = resolveTaskPolicy('closureReport')
        // Validate the exact models before creating either provider.
        if (conversation.modelId !== 'openai/gpt-6-luna' || report.modelId !== 'openai/gpt-6.1-sol') throw new Error('Unexpected probe models')
        models = { conversation: resolveTaskModel(conversation), report: resolveTaskModel(report) }
        return { conversation: conversation.modelId, report: report.modelId }
      },
      reserve: () => reserveOnce(createServiceRoleClient()),
      generate: async task => {
        if (!models) throw new Error('Model not resolved')
        return generateOne(models[task], task)
      },
    },
  })
  // No provider response, raw error, identity, headers, body, or key is returned.
  return Response.json(result, { status: result.status === 'success' ? 200 : 404, headers: { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' } })
}
