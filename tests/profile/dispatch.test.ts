import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { start, createServiceRoleClient } = vi.hoisted(() => ({ start: vi.fn(), createServiceRoleClient: vi.fn() }))
vi.mock('workflow/api', () => ({ start }))
vi.mock('@/lib/server/supabase/server', () => ({ createServiceRoleClient }))
vi.mock('@/lib/server/workflows/extract-profile', () => ({ extractProfileWorkflow: vi.fn() }))
import { dispatchProfileJob, enqueueProfileExtraction } from '@/lib/server/profile/dispatch'
const job = { id: 'job-1', token: 'token-1', user_id: 'owner' }
let rpc: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.stubEnv('FEATURE_PROGRESSIVE_PROFILE', 'on')
  start.mockReset().mockResolvedValue({ runId: 'synthetic-run' })
  rpc = vi.fn().mockResolvedValue({ data: [job], error: null })
  createServiceRoleClient.mockReset().mockReturnValue({ rpc })
})
afterEach(() => vi.unstubAllEnvs())
describe('durable profile dispatch boundary', () => {
  it('flag off makes no service client, claim or start call', async () => {
    vi.stubEnv('FEATURE_PROGRESSIVE_PROFILE', 'off')
    expect(await enqueueProfileExtraction('owner')).toEqual({ enqueued: 0, failed: 0 })
    await dispatchProfileJob(job)
    expect(createServiceRoleClient).not.toHaveBeenCalled()
    expect(start).not.toHaveBeenCalled()
  })
  it('claims the authenticated caller scope and starts with IDs/token only', async () => {
    expect(await enqueueProfileExtraction('owner')).toEqual({ enqueued: 1, failed: 0 })
    expect(rpc).toHaveBeenCalledWith('claim_profile_jobs', { p_user_id: 'owner', p_limit: 1 })
    expect(start).toHaveBeenCalledWith(expect.any(Function), [{ jobId: 'job-1', token: 'token-1' }])
  })
  it('never starts a Workflow without a claim and rejects out-of-range batches', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    expect(await enqueueProfileExtraction('owner')).toEqual({ enqueued: 0, failed: 0 })
    await expect(enqueueProfileExtraction(undefined, 11)).rejects.toThrow('profile_dispatch_invalid')
    await expect(dispatchProfileJob({ ...job, token: '' })).rejects.toThrow('profile_dispatch_invalid')
    expect(start).not.toHaveBeenCalled()
  })
  it('failed start releases the SQL claim for durable backoff without leaking errors', async () => {
    start.mockRejectedValue(new Error('PRIVATE PROVIDER OR QUEUE TEXT'))
    await expect(dispatchProfileJob(job)).rejects.toThrow('profile_dispatch_failed')
    expect(rpc).toHaveBeenCalledWith('update_profile_job', { p_job_id: 'job-1', p_token: 'token-1', p_action: 'failed' })
  })
  it('late enqueue acknowledgement never requeues a running/completed Workflow after ack error', async () => {
    rpc.mockResolvedValue({ error: { code: '42501', message: 'PRIVATE' }, data: null })
    await expect(dispatchProfileJob(job)).rejects.toThrow('profile_dispatch_ack_failed')
    expect(rpc.mock.calls).toEqual([['update_profile_job', { p_job_id: 'job-1', p_token: 'token-1', p_action: 'enqueued', p_run_id: 'synthetic-run' }]])
  })
  it('records the run id even when the completed replay ack is late', async () => {
    rpc.mockResolvedValue({ error: null, data: null })
    expect(await dispatchProfileJob(job)).toEqual({ runId: 'synthetic-run' })
    expect(rpc).toHaveBeenCalledWith('update_profile_job', { p_job_id: 'job-1', p_token: 'token-1', p_action: 'enqueued', p_run_id: 'synthetic-run' })
  })
  it('recovers at most ten jobs with at most two starts in flight and continues failures', async () => {
    rpc.mockImplementation(async (name: string) => ({ data: name === 'claim_profile_jobs' ? Array.from({ length: 10 }, (_, i) => ({ id: `job-${i}`, token: 'claim' })) : null, error: null }))
    let active = 0, maximum = 0
    start.mockImplementation(async (_workflow, [input]) => {
      active++; maximum = Math.max(active, maximum)
      await new Promise(resolve => setTimeout(resolve, 1)); active--
      if (input.jobId === 'job-4') throw new Error('PRIVATE')
      return { runId: 'run' }
    })
    expect(await enqueueProfileExtraction(undefined, 10)).toEqual({ enqueued: 9, failed: 1 })
    expect(rpc).toHaveBeenCalledWith('claim_profile_jobs', { p_limit: 10 })
    expect(maximum).toBe(2)
  })
})

it('rejects hosted nonallowlisted enqueue and dispatch before claim or workflow start', async () => {
  vi.stubEnv('VERCEL', '1')
  vi.stubEnv('PROFILE_REVIEW_USER_IDS', '11111111-1111-4111-8111-111111111111')
  expect(await enqueueProfileExtraction('owner')).toEqual({ enqueued: 0, failed: 0 })
  expect(await dispatchProfileJob(job)).toBeNull()
  expect(createServiceRoleClient).not.toHaveBeenCalled()
  expect(start).not.toHaveBeenCalled()
})
it('hosted cron claims only individual listed owners within ten total jobs and two starts', async () => {
  const owners = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333']
  vi.stubEnv('VERCEL', '1'); vi.stubEnv('PROFILE_REVIEW_USER_IDS', owners.join(','))
  rpc.mockImplementation(async (name: string, args: { p_user_id?: string; p_limit?: number }) => ({ data: name === 'claim_profile_jobs' ? Array.from({ length: Math.min(6, args.p_limit!) }, (_, i) => ({ id: `job-${args.p_user_id}-${i}`, token: 'claim', user_id: args.p_user_id })) : null, error: null }))
  let active = 0, maximum = 0
  start.mockImplementation(async () => { active++; maximum = Math.max(maximum, active); await new Promise(resolve => setTimeout(resolve, 1)); active--; return { runId: 'run' } })
  expect(await enqueueProfileExtraction(undefined, 10)).toEqual({ enqueued: 10, failed: 0 })
  expect(rpc.mock.calls.filter(([name]) => name === 'claim_profile_jobs')).toEqual([
    ['claim_profile_jobs', { p_user_id: owners[0], p_limit: 10 }], ['claim_profile_jobs', { p_user_id: owners[1], p_limit: 4 }],
  ])
  expect(maximum).toBe(2)
})
