import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ client: vi.fn(), revalidate: vi.fn(), rpc: vi.fn(), getUser: vi.fn() }))
vi.mock('@/lib/server/supabase/server', () => ({ createAuthenticatedClient: mocks.client }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))
import { setProfileEnabledAction, reviewProfileObservationAction } from '@/app/app/perfil/actions'
const review = { observationId: '10000000-0000-4000-8000-000000000001', action: 'confirm' as const, expectedUpdatedAt: '2026-10-28T12:00:00.123456+00:00' }
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('FEATURE_PROGRESSIVE_PROFILE', 'on')
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'owned-user' } }, error: null })
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === 'get_onboarding_ready' ? true : null, error: null }))
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc })
})
describe('patient profile actions', () => {
  it('disables consent through the authenticated owner RPC before success', async () => {
    expect(await setProfileEnabledAction(false)).toEqual({ ok: true })
    expect(mocks.rpc.mock.calls).toEqual([['get_onboarding_ready'], ['set_profile_enabled', { p_enabled: false }]])
    expect(mocks.revalidate).toHaveBeenCalledWith('/app/perfil')
  })
  it('passes the opaque exact version without accepting client identity or status', async () => {
    expect(await reviewProfileObservationAction(review)).toEqual({ ok: true })
    expect(mocks.rpc).toHaveBeenLastCalledWith('review_profile_observation', { p_observation_id: review.observationId, p_action: 'confirm', p_expected_updated_at: review.expectedUpdatedAt })
    expect(await reviewProfileObservationAction({ ...review, user_id: 'foreign' })).toMatchObject({ ok: false })
  })
  it('allows rejecting an observation while consent is disabled', async () => {
    expect(await reviewProfileObservationAction({ ...review, action: 'reject' })).toEqual({ ok: true })
    expect(mocks.rpc).toHaveBeenLastCalledWith('review_profile_observation', expect.objectContaining({ p_action: 'reject' }))
  })
  it.each(['off', '', 'true'])('cuts all new queries with flag %s', async flag => {
    vi.stubEnv('FEATURE_PROGRESSIVE_PROFILE', flag)
    expect(await setProfileEnabledAction(true)).toMatchObject({ ok: false })
    expect(await reviewProfileObservationAction(review)).toMatchObject({ ok: false })
    expect(mocks.client).not.toHaveBeenCalled()
  })
  it.each([null, { id: 'owned-user' }])('fails closed for unauthenticated/error auth', async user => {
    mocks.getUser.mockResolvedValue({ data: { user }, error: user ? new Error('private') : null })
    expect(await setProfileEnabledAction(true)).toMatchObject({ ok: false })
    expect(await reviewProfileObservationAction(review)).toMatchObject({ ok: false })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each([false, null])('requires adult onboarding ready %s', async ready => {
    mocks.rpc.mockResolvedValue({ data: ready, error: null })
    expect(await setProfileEnabledAction(true)).toMatchObject({ ok: false })
    expect(await reviewProfileObservationAction(review)).toMatchObject({ ok: false })
    expect(mocks.rpc.mock.calls.every(([name]) => name === 'get_onboarding_ready')).toBe(true)
  })
  it('surfaces stale review as a reloadable conflict without raw errors', async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === 'get_onboarding_ready' ? { data: true, error: null } : { error: { code: '40001', message: 'PRIVATE TOKEN' } })
    expect(await reviewProfileObservationAction(review)).toMatchObject({ ok: false, conflict: true, error: expect.stringMatching(/recarga/i) })
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it('denies foreign ownership and never reports a failed write as saved', async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === 'get_onboarding_ready' ? { data: true, error: null } : { error: { code: '42501', message: 'PRIVATE TOKEN' } })
    const result = await reviewProfileObservationAction(review)
    expect(result).toMatchObject({ ok: false })
    expect(JSON.stringify(result)).not.toContain('PRIVATE')
    expect(await setProfileEnabledAction(true)).toMatchObject({ ok: false })
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
  it('does not settle success before the RPC completes', async () => {
    let finish!: (value: unknown) => void
    mocks.rpc.mockImplementation((name: string) => name === 'get_onboarding_ready' ? Promise.resolve({ data: true, error: null }) : new Promise(resolve => { finish = resolve }))
    let settled = false
    const request = setProfileEnabledAction(true).then(result => { settled = true; return result })
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    expect(settled).toBe(false)
    expect(mocks.revalidate).not.toHaveBeenCalled()
    finish({ error: null })
    expect(await request).toEqual({ ok: true })
  })
  it.each([{}, { ...review, action: 'superseded' }, { ...review, observationId: 'bad' }, { ...review, expectedUpdatedAt: 'yesterday' }])('rejects malformed review before any call', async input => {
    expect(await reviewProfileObservationAction(input)).toMatchObject({ ok: false })
    expect(mocks.client).not.toHaveBeenCalled()
  })
  it('rejects nonboolean activation without coercion', async () => {
    expect(await setProfileEnabledAction('false')).toMatchObject({ ok: false })
    expect(mocks.client).not.toHaveBeenCalled()
  })
  it('contains thrown infrastructure failures', async () => {
    mocks.client.mockRejectedValue(new Error('PRIVATE TOKEN'))
    const result = await setProfileEnabledAction(true)
    expect(result).toMatchObject({ ok: false })
    expect(JSON.stringify(result)).not.toContain('PRIVATE')
  })
})
