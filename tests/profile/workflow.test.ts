/* eslint-disable @typescript-eslint/no-explicit-any -- controlled external boundaries */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { createServiceRoleClient, extractProfileObservations, enqueueProfileExtraction } = vi.hoisted(() => ({ createServiceRoleClient: vi.fn(), extractProfileObservations: vi.fn(), enqueueProfileExtraction: vi.fn() }))
vi.mock('@/lib/server/supabase/server', () => ({ createServiceRoleClient }))
vi.mock('@/lib/server/profile/extractor', async original => ({ ...await original<typeof import('@/lib/server/profile/extractor')>(), extractProfileObservations }))
vi.mock('@/lib/server/profile/dispatch', () => ({ enqueueProfileExtraction }))
vi.mock('@/lib/shared/llm/models', () => ({ llm: { structured: () => 'synthetic/structured' } }))
import { extractProfileStep, extractProfileWorkflow } from '@/lib/server/workflows/extract-profile'
const job = { id: 'job', token: 'claim', user_id: 'owner', source_message_id: 'message', session_id: 'session', conversation_id: 'conversation', source_created_at: '2026-10-28T12:00:00Z' }
const observation = { category: 'concern', quote: 'Me cuesta\ndormir', time_scope: 'current', supersedes_id: null }
let source: any, loadedJob: any, targets: any[], rpc: ReturnType<typeof vi.fn>, queries: Array<{ table: string; operations: any[] }>
beforeEach(() => {
  vi.stubEnv('FEATURE_PROGRESSIVE_PROFILE', 'on')
  loadedJob = job; source = { role: 'user', parts: [{ type: 'text', text: 'Me cuesta' }, { type: 'text', text: 'dormir' }] }; targets = []
  queries = []
  rpc = vi.fn(async (name: string) => ({ error: null, data: name === 'start_profile_job' ? true : null }))
  const from = (table: string) => {
    const operations: any[] = []; queries.push({ table, operations })
    const chain: any = {}
    for (const method of ['select', 'eq', 'lt', 'order', 'limit', 'maybeSingle']) chain[method] = (...args: any[]) => { operations.push([method, ...args]); return chain }
    chain.then = (resolve: any, reject: any) => Promise.resolve({ data: table === 'profile_extraction_jobs' ? loadedJob : table === 'messages' ? source : targets, error: null }).then(resolve, reject)
    return chain
  }
  createServiceRoleClient.mockReset().mockReturnValue({ from, rpc })
  extractProfileObservations.mockReset().mockResolvedValue({ observations: [observation] })
  enqueueProfileExtraction.mockReset().mockResolvedValue({ enqueued: 0, failed: 0 })
})
afterEach(() => vi.unstubAllEnvs())
describe('single-step private profile Workflow', () => {
  it('contains generation and persistence inside one step, returning IDs/status/count only', async () => {
    expect(await extractProfileWorkflow({ jobId: 'job', token: 'claim' })).toEqual({ jobId: 'job', status: 'completed', count: 1 })
    expect(extractProfileStep.maxRetries).toBe(0)
    expect(rpc).toHaveBeenCalledWith('finish_profile_job', { p_job_id: 'job', p_token: 'claim', p_observations: [observation], p_model_id: 'synthetic/structured' })
    expect(extractProfileObservations).toHaveBeenCalledWith('Me cuesta\ndormir', [])
    expect(enqueueProfileExtraction).toHaveBeenCalledWith('owner', 1)
  })
  it('queries exact source identity and confirmed correction targets owned by job owner, older than source, bounded to twenty', async () => {
    await extractProfileStep({ jobId: 'job', token: 'claim' })
    expect(queries.find(query => query.table === 'messages')?.operations).toEqual(expect.arrayContaining([
      ['eq', 'id', 'message'], ['eq', 'role', 'user'], ['eq', 'session_id', 'session'], ['eq', 'conversation_id', 'conversation'], ['eq', 'created_at', job.source_created_at],
    ]))
    expect(queries.find(query => query.table === 'profile_observations')?.operations).toEqual(expect.arrayContaining([
      ['eq', 'user_id', 'owner'], ['eq', 'status', 'confirmed'], ['lt', 'source_created_at', job.source_created_at], ['limit', 20],
    ]))
  })
  it('completed replay never reloads source or calls model/finish', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    expect(await extractProfileStep({ jobId: 'job', token: 'claim' })).toEqual({ jobId: 'job', status: 'skipped', count: 0 })
    expect(extractProfileObservations).not.toHaveBeenCalled()
    expect(queries.map(query => query.table)).toEqual(['profile_extraction_jobs'])
    expect(rpc.mock.calls.map(call => call[0])).toEqual(['start_profile_job'])
  })
  it('consent or duplicate-start failure never releases another running worker claim', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'PRIVATE' } })
    expect(await extractProfileStep({ jobId: 'job', token: 'claim' })).toMatchObject({ status: 'skipped', count: 0 })
    expect(rpc.mock.calls.map(call => call[0])).toEqual(['start_profile_job'])
    expect(extractProfileObservations).not.toHaveBeenCalled()
  })
  it.each(['model', 'finish', 'missing-source', 'malformed'])('records %s failure for SQL backoff and returns no source/error payload', async failure => {
    if (failure === 'model') extractProfileObservations.mockRejectedValue(new Error('PRIVATE SOURCE'))
    if (failure === 'finish') rpc.mockImplementation(async (name: string) => ({ data: name === 'start_profile_job', error: name === 'finish_profile_job' ? { code: '42501', message: 'PRIVATE SOURCE' } : null }))
    if (failure === 'missing-source') source = null
    if (failure === 'malformed') extractProfileObservations.mockResolvedValue({ observations: [{ ...observation, quote: 'not in source' }] })
    expect(await extractProfileStep({ jobId: 'job', token: 'claim' })).toEqual({ jobId: 'job', status: 'failed', count: 0 })
    expect(rpc).toHaveBeenCalledWith('update_profile_job', { p_job_id: 'job', p_token: 'claim', p_action: 'failed' })
    if (failure !== 'finish') expect(rpc.mock.calls.map(call => call[0])).not.toContain('finish_profile_job')
    expect(enqueueProfileExtraction).toHaveBeenCalledWith('owner', 1)
  })
  it('flag off returns without new table queries, model or dispatch', async () => {
    vi.stubEnv('FEATURE_PROGRESSIVE_PROFILE', 'off')
    expect(await extractProfileStep({ jobId: 'job', token: 'claim' })).toMatchObject({ status: 'skipped' })
    expect(createServiceRoleClient).not.toHaveBeenCalled()
    expect(extractProfileObservations).not.toHaveBeenCalled()
  })
  it('safe recovery survives release and next-dispatch failures without raw error serialization', async () => {
    extractProfileObservations.mockRejectedValue(new Error('PRIVATE'))
    rpc.mockImplementation(async (name: string) => { if (name === 'update_profile_job') throw new Error('PRIVATE'); return { data: true, error: null } })
    enqueueProfileExtraction.mockRejectedValue(new Error('PRIVATE'))
    expect(await extractProfileStep({ jobId: 'job', token: 'claim' })).toEqual({ jobId: 'job', status: 'failed', count: 0 })
  })
})
