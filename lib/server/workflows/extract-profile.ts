import { createServiceRoleClient } from '@/lib/server/supabase/server'
import { llm } from '@/lib/shared/llm/models'
import { progressiveProfileAvailable, progressiveProfileEnabled } from '@/lib/server/profile/config'
import { canonicalProfileSource, extractProfileObservations, validateProfileExtraction } from '@/lib/server/profile/extractor'
import { enqueueProfileExtraction } from '@/lib/server/profile/dispatch'
import type { Database } from '@/lib/shared/supabase/types'

export type ExtractProfileInput = { jobId: string; token: string }
export async function extractProfileWorkflow(input: ExtractProfileInput) {
  'use workflow'
  return extractProfileStep(input)
}
export async function extractProfileStep(input: ExtractProfileInput): Promise<{ jobId: string; status: 'completed' | 'failed' | 'skipped'; count: number }> {
  'use step'

  const { jobId, token } = input
  if (!progressiveProfileAvailable()) return { jobId, status: 'skipped', count: 0 }
  let service: ReturnType<typeof createServiceRoleClient> | undefined
  let job: Database['public']['Tables']['profile_extraction_jobs']['Row'] | null = null
  let started = false
  try {
    service = createServiceRoleClient()
    const { data, error: jobError } = await service.from('profile_extraction_jobs').select('*').eq('id', jobId).eq('token', token).maybeSingle()
    if (jobError || !data) return { jobId, status: 'skipped', count: 0 }
    if (!progressiveProfileEnabled(process.env, data.user_id)) return { jobId, status: 'skipped', count: 0 }
    job = data
    const { data: canStart, error: startError } = await service.rpc('start_profile_job', { p_job_id: jobId, p_token: token })
    // Completed replay, stale claims, withdrawn consent and duplicate starts
    // must never make another model call or release a different running worker.
    if (startError || !canStart) return { jobId, status: 'skipped', count: 0 }
    started = true
    const { data: source, error: sourceError } = await service.from('messages').select('parts, role')
      .eq('id', job.source_message_id).eq('role', 'user')
      .eq('session_id', job.session_id).eq('conversation_id', job.conversation_id)
      .eq('created_at', job.source_created_at).maybeSingle()
    if (sourceError || !source || source.role !== 'user') throw new Error('profile_source_unavailable')
    const { data: targets, error: targetsError } = await service.from('profile_observations')
      .select('id, category, quote, time_scope, status, source_created_at')
      .eq('user_id', job.user_id).eq('status', 'confirmed').lt('source_created_at', job.source_created_at)
      .order('source_created_at', { ascending: false }).order('id', { ascending: false }).limit(20)
    if (targetsError) throw new Error('profile_targets_unavailable')
    const sourceText = canonicalProfileSource(source.parts)
    const knownTargets = targets ?? []
    const output = await extractProfileObservations(sourceText, knownTargets)
    const validated = validateProfileExtraction(output, sourceText, knownTargets)
    // Ownership, source, epoch, lease and token are revalidated atomically in
    // SQL; no model-provided identity participates in persistence.
    const { error: finishError } = await service.rpc('finish_profile_job', {
      p_job_id: jobId, p_token: token, p_observations: validated.observations, p_model_id: llm.structured(),
    })
    if (finishError) throw new Error('profile_finish_failed')
    return { jobId, status: 'completed', count: validated.observations.length }
  } catch {
    if (started && service) {
      try { await service.rpc('update_profile_job', { p_job_id: jobId, p_token: token, p_action: 'failed' }) } catch { /* Fenced lease expiry recovers after an outage. */ }
    }
    return { jobId, status: started ? 'failed' : 'skipped', count: 0 }
  } finally {
    if (job) {
      try { await enqueueProfileExtraction(job.user_id, 1) } catch { /* Next message or cron retries the durable queue. */ }
    }
  }
}
extractProfileStep.maxRetries = 0
