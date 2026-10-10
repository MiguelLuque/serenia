import { timingSafeEqual } from 'node:crypto'
import { createServiceRoleClient } from '@/lib/server/supabase/server'
import { dispatchAssessmentJob } from '@/lib/server/workflows'
import { SESSION_INACTIVITY_MS } from '@/lib/server/sessions/service'

export const runtime = 'nodejs'
export const maxDuration = 60
export const POST = handle
export const GET = handle

async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  const actual = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret ?? ''}`)
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return new Response('Unauthorized', { status: 401 })
  const service = createServiceRoleClient()
  const cutoff = new Date(Date.now() - SESSION_INACTIVITY_MS).toISOString()
  const { data: stale, error } = await service.from('clinical_sessions').select('id, user_id').eq('status', 'open').lt('last_activity_at', cutoff).order('last_activity_at', { ascending: true }).limit(10)
  if (error) return Response.json({ error: 'Recovery unavailable' }, { status: 503 })
  let closed = 0
  for (const session of stale ?? []) {
    const { error } = await service.rpc('close_session_atomic', { p_session_id: session.id, p_user_id: session.user_id, p_reason: 'inactivity' })
    if (!error) closed++
  }
  const { error: recoveryError } = await service.rpc('recover_assessment_jobs', { p_limit: 10 })
  const { data: jobs, error: claimError } = await service.rpc('claim_assessment_jobs', { p_limit: 10 })
  if (recoveryError || claimError) return Response.json({ error: 'Recovery unavailable', closed }, { status: 503 })
  let enqueued = 0, failed = 0
  // At most two enqueue calls at a time, at most ten jobs per sweep.
  for (let offset = 0; offset < (jobs ?? []).length; offset += 2) {
    const results = await Promise.allSettled(jobs!.slice(offset, offset+2).map(job => dispatchAssessmentJob(job)))
    for (const result of results) {
      if (result.status === 'fulfilled') enqueued++
      else failed++
    }
  }
  return Response.json({ ok: true, closed, enqueued, failed })
}
