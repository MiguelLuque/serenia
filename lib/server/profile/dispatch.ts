import 'server-only'
import { start } from 'workflow/api'
import { createServiceRoleClient } from '@/lib/server/supabase/server'
import type { Database } from '@/lib/shared/supabase/types'
import { extractProfileWorkflow } from '@/lib/server/workflows/extract-profile'
import { progressiveProfileEnabled } from './config'

export type ClaimedProfileJob = Pick<Database['public']['Functions']['claim_profile_jobs']['Returns'][number], 'id' | 'token'>

export async function dispatchProfileJob(job: ClaimedProfileJob): Promise<{ runId: string } | null> {
  if (!progressiveProfileEnabled()) return null
  if (!job.id || !job.token) throw new Error('profile_dispatch_invalid')
  const service = createServiceRoleClient()
  let runId: string
  try {
    const run = await start(extractProfileWorkflow, [{ jobId: job.id, token: job.token }])
    runId = run.runId
  } catch {
    // A lost response may still have started a run. SQL fences its old token
    // when reclaimed; never rely on process memory for retry/deduplication.
    try { await service.rpc('update_profile_job', { p_job_id: job.id, p_token: job.token, p_action: 'failed' }) } catch { /* Lease expiry remains recoverable. */ }
    throw new Error('profile_dispatch_failed')
  }
  try {
    const { error } = await service.rpc('update_profile_job', { p_job_id: job.id, p_token: job.token, p_action: 'enqueued', p_run_id: runId })
    if (error) throw new Error('profile_dispatch_ack_failed')
  } catch {
    // Once start succeeded, an ack failure must not reset a running worker.
    // SQL accepts a late acknowledgement even after completed replay.
    throw new Error('profile_dispatch_ack_failed')
  }
  return { runId }
}

export async function enqueueProfileExtraction(userId?: string, limit = 1): Promise<{ enqueued: number; failed: number }> {
  if (!progressiveProfileEnabled()) return { enqueued: 0, failed: 0 }
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error('profile_dispatch_invalid')
  let jobs: ClaimedProfileJob[]
  try {
    const { data, error } = await createServiceRoleClient().rpc('claim_profile_jobs', { ...(userId ? { p_user_id: userId } : {}), p_limit: limit })
    if (error) throw new Error('profile_claim_failed')
    jobs = data ?? []
  } catch {
    throw new Error('profile_claim_failed')
  }
  let enqueued = 0, failed = 0
  for (let offset = 0; offset < jobs.length; offset += 2) {
    const results = await Promise.allSettled(jobs.slice(offset, offset + 2).map(dispatchProfileJob))
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) enqueued++
      else if (result.status === 'rejected') failed++
    }
  }
  return { enqueued, failed }
}
