import { describe, expect, it, vi, beforeEach } from 'vitest'
const { start, createServiceRoleClient } = vi.hoisted(() => ({ start: vi.fn(), createServiceRoleClient: vi.fn() }))
vi.mock('workflow/api', () => ({ start }))
vi.mock('@/lib/server/supabase/server', () => ({ createServiceRoleClient }))
vi.mock('@/lib/server/workflows/generate-assessment', () => ({ generateAssessmentWorkflow: vi.fn() }))
import { dispatchAssessmentJob, enqueueAssessmentGeneration } from '@/lib/server/workflows'
const job = { session_id: 'session', token: 'claim', status: 'enqueued', attempts: 1, context_json: { rejectionReason: 'Synthetic reason', clinicalNotes: 'Synthetic notes' } }
let rpc: ReturnType<typeof vi.fn>
beforeEach(() => {
  start.mockReset().mockResolvedValue({ runId: 'run' })
  rpc = vi.fn().mockResolvedValue({ data: [job], error: null })
  createServiceRoleClient.mockReturnValue({ rpc })
})
describe('durable bounded workflow dispatch', () => {
  it('never starts a workflow without its SQL capacity/lease claim', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await expect(enqueueAssessmentGeneration({ sessionId: 'session' })).rejects.toThrow('unavailable')
    expect(start).not.toHaveBeenCalled()
  })
  it('rejects a job without its SQL claim token before starting or releasing it', async () => {
    await expect(dispatchAssessmentJob({ ...job, token: null })).rejects.toThrow('no claim token')
    expect(start).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
  it('uses durable clinical context and token, not caller replacement context', async () => {
    await enqueueAssessmentGeneration({ sessionId: 'session', rejectionContext: { rejectionReason: 'untrusted replacement', clinicalNotes: null } })
    expect(start).toHaveBeenCalledWith(expect.any(Function), [{ sessionId: 'session', jobToken: 'claim', rejectionContext: job.context_json }])
  })
  it('records failed enqueue for backoff instead of losing the closed session', async () => {
    start.mockRejectedValue(new Error('queue unavailable'))
    await expect(dispatchAssessmentJob(job)).rejects.toThrow('queue unavailable')
    expect(rpc).toHaveBeenCalledWith('update_assessment_job', { p_session_id: 'session', p_token: 'claim', p_action: 'failed' })
  })
  it('records the external run after a successful claim', async () => {
    expect(await dispatchAssessmentJob(job)).toEqual({ runId: 'run' })
    expect(rpc).toHaveBeenCalledWith('update_assessment_job', { p_session_id: 'session', p_token: 'claim', p_action: 'enqueued', p_run_id: 'run' })
  })
})
