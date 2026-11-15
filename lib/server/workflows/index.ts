import 'server-only'
import { start } from 'workflow/api'
import { createServiceRoleClient } from '@/lib/server/supabase/server'
import { generateAssessmentWorkflow, type GenerateAssessmentInput, type RejectionContext } from './generate-assessment'
import type { Database } from '@/lib/shared/supabase/types'

export type { GenerateAssessmentInput, RejectionContext }
export type ClaimedAssessmentJob = Pick<Database['public']['Functions']['claim_assessment_jobs']['Returns'][number], 'session_id' | 'token' | 'context_json'>

export async function dispatchAssessmentJob(job: ClaimedAssessmentJob): Promise<{ runId: string }> {
  if (!job.token) throw new Error('Assessment job has no claim token')
  const token = job.token
  const service = createServiceRoleClient()
  let runId: string
  try {
    const run = await start(generateAssessmentWorkflow, [{
      sessionId: job.session_id,
      jobToken: token,
      ...(job.context_json ? { rejectionContext: job.context_json as RejectionContext } : {}),
    }])
    runId = run.runId
  } catch {
    // Durable backoff; a failed release is also recoverable by lease expiry.
    try { await service.rpc('update_assessment_job', { p_session_id: job.session_id, p_token: token, p_action: 'failed' }) } catch { /* Preserve the safe start error. */ }
    throw new Error('assessment_dispatch_failed')
  }
  try {
    const { data, error } = await service.rpc('update_assessment_job', { p_session_id: job.session_id, p_token: token, p_action: 'enqueued', p_run_id: runId })
    if (error || data !== true) throw new Error('assessment_dispatch_ack_failed')
  } catch {
    // Start succeeded: an unknown ACK must not reset a running/completed worker.
    throw new Error('assessment_dispatch_ack_failed')
  }
  return { runId }
}

export async function enqueueAssessmentGeneration(input: GenerateAssessmentInput): Promise<{ runId: string }> {
  const service = createServiceRoleClient()
  const { data: jobs, error } = await service.rpc('claim_assessment_jobs', { p_session_id: input.sessionId, p_limit: 1 })
  if (error) throw error
  if (!jobs?.[0]) throw new Error('Assessment job unavailable; recovery will check its state')
  return dispatchAssessmentJob(jobs[0])
}
