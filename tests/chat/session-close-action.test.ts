import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const f = vi.hoisted(() => ({ client: {}, requestClose: vi.fn(), closeResult: { closed: true } as unknown, closeError: false }))
vi.mock('@/lib/server/supabase/server', () => ({ createAuthenticatedClient: async () => f.client }))
vi.mock('@/lib/server/sessions/service', () => ({
  requestOwnedSessionClosure: async (...args: unknown[]) => {
    f.requestClose(...args)
    if (f.closeError) throw new Error('Session close unavailable')
    return f.closeResult
  },
}))
import { closeOwnedSessionFromView } from '@/app/app/chat-recovery-actions'

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-27T12:00:00Z')); f.requestClose.mockClear(); f.closeResult = { closed: true }; f.closeError = false })
afterEach(() => vi.useRealTimers())

it('delegates time closure to the owner-checked server service', async () => {
  f.closeResult = { closed: false, reason: 'not_expired', timing: { serverNow: Date.now(), expiresAt: Date.now() + 60_000 } }
  expect(await closeOwnedSessionFromView('session', 'time_limit')).toEqual(f.closeResult)
  expect(f.requestClose).toHaveBeenCalledWith(f.client, 'session', 'time_limit', null)
})

it('passes the exact unresolved turn identity through to the service', async () => {
  const confirmation = { requestId: 'turn-1', attempt: 2 }
  await closeOwnedSessionFromView('session', 'user_request', confirmation)
  expect(f.requestClose).toHaveBeenCalledWith(f.client, 'session', 'user_request', confirmation)
})

it('preserves service errors for the UI to reconcile against saved state', async () => {
  f.closeError = true
  await expect(closeOwnedSessionFromView('session', 'user_request')).rejects.toThrow('Session close unavailable')
})
