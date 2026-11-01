import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
const { start, createServiceRoleClient } = vi.hoisted(() => ({ start: vi.fn(), createServiceRoleClient: vi.fn() }))
vi.mock('workflow/api', () => ({ start }))
vi.mock('@/lib/server/supabase/server', () => ({ createServiceRoleClient }))
vi.mock('@/lib/server/workflows/generate-assessment', () => ({ generateAssessmentWorkflow: vi.fn() }))
import { dispatchAssessmentJob, enqueueAssessmentGeneration } from '@/lib/server/workflows'
const job = { session_id: 'session', token: 'claim', status: 'enqueued', attempts: 1, context_json: { rejectionReason: 'Synthetic reason', clinicalNotes: 'Synthetic notes' } }
let rpc: ReturnType<typeof vi.fn>
beforeEach(() => {
  start.mockReset().mockResolvedValue({ runId: 'run' })
  rpc = vi.fn().mockImplementation(async (name: string) => ({ data: name === 'claim_assessment_jobs' ? [job] : true, error: null }))
  createServiceRoleClient.mockReset().mockReturnValue({ rpc })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

async function expectSafeError(result: Promise<unknown>, message: string) {
  const error = await result.catch(error => error)
  expect(error).toBeInstanceOf(Error)
  expect(String(error)).toBe(`Error: ${message}`)
  expect(error).not.toHaveProperty('cause')
  expect(error).not.toHaveProperty('rejectionContext')
  expect(JSON.stringify(Object.getOwnPropertyDescriptors(error))).not.toContain('PRIVATE')
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('PRIVATE')
}

describe('durable bounded workflow dispatch', () => {
  it('never starts a workflow without its SQL capacity/lease claim', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await expect(enqueueAssessmentGeneration({ sessionId: 'session' })).rejects.toThrow('unavailable')
    expect(start).not.toHaveBeenCalled()
  })
  it('rejects a job without its SQL claim token before starting or releasing it', async () => {
    await expect(dispatchAssessmentJob({ ...job, token: null })).rejects.toThrow('no claim token')
    expect(createServiceRoleClient).not.toHaveBeenCalled()
    expect(start).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
  it('uses durable clinical context and token, not caller replacement context', async () => {
    await enqueueAssessmentGeneration({ sessionId: 'session', rejectionContext: { rejectionReason: 'untrusted replacement', clinicalNotes: null } })
    expect(start).toHaveBeenCalledWith(expect.any(Function), [{ sessionId: 'session', jobToken: 'claim', rejectionContext: job.context_json }])
  })
  it('records failed enqueue for backoff instead of losing the closed session', async () => {
    start.mockRejectedValue(Object.assign(new Error('PRIVATE queue payload'), { cause: 'PRIVATE cause', rejectionContext: job.context_json }))
    await expectSafeError(dispatchAssessmentJob(job), 'assessment_dispatch_failed')
    expect(rpc.mock.calls).toEqual([['update_assessment_job', { p_session_id: 'session', p_token: 'claim', p_action: 'failed' }]])
  })
  it.each(['rpc error', 'throw', 'false'] as const)('preserves a safe start failure when backoff release returns %s', async failure => {
    start.mockRejectedValue(new Error('PRIVATE start payload'))
    rpc.mockImplementation(async () => {
      if (failure === 'throw') throw new Error('PRIVATE release payload')
      return { data: false, error: failure === 'rpc error' ? { code: 'PRIVATE release code', message: 'PRIVATE release payload' } : null }
    })
    await expectSafeError(dispatchAssessmentJob(job), 'assessment_dispatch_failed')
    expect(rpc.mock.calls).toEqual([['update_assessment_job', { p_session_id: 'session', p_token: 'claim', p_action: 'failed' }]])
  })
  describe.each(['running', 'completed'] as const)('worker already %s before ACK', workerStatus => {
    it.each(['rpc error', 'throw', 'false'] as const)('preserves its claim when ACK returns %s', async failure => {
      // Model the worker advancing before start returns, and detect any reset.
      const claim = { status: 'enqueued' as string, token: 'claim' as string | null }
      start.mockImplementation(async () => {
        claim.status = workerStatus
        return { runId: 'run' }
      })
      rpc.mockImplementation(async (_name: string, args: { p_action: string }) => {
        if (args.p_action === 'failed') {
          claim.status = 'pending'
          claim.token = null
          return { data: true, error: null }
        }
        if (failure === 'throw') throw Object.assign(new Error('PRIVATE lost ACK payload'), { cause: 'PRIVATE cause', rejectionContext: job.context_json })
        return { data: false, error: failure === 'rpc error' ? { code: 'PRIVATE ACK code', message: 'PRIVATE patient payload' } : null }
      })
      const result = dispatchAssessmentJob(job).catch(error => error)
      const error = await result
      expect(rpc.mock.calls).toEqual([['update_assessment_job', { p_session_id: 'session', p_token: 'claim', p_action: 'enqueued', p_run_id: 'run' }]])
      expect(claim).toEqual({ status: workerStatus, token: 'claim' })
      await expectSafeError(Promise.reject(error), 'assessment_dispatch_ack_failed')
    })
  })
  it.each([null, undefined, 1, 'true'])('rejects non-boolean ACK data %s instead of reporting dispatch success', async data => {
    rpc.mockResolvedValue({ data, error: null })
    await expectSafeError(dispatchAssessmentJob(job), 'assessment_dispatch_ack_failed')
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it('records the external run after a successful claim', async () => {
    expect(await dispatchAssessmentJob(job)).toEqual({ runId: 'run' })
    expect(rpc).toHaveBeenCalledWith('update_assessment_job', { p_session_id: 'session', p_token: 'claim', p_action: 'enqueued', p_run_id: 'run' })
  })
})
