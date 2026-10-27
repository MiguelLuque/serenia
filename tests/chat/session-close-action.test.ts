import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const f = vi.hoisted(() => ({ user: 'owner' as string | null, owner: 'owner', status: 'open', openedAt: '', recovery: null as unknown, closeError: false, closed: vi.fn() }))
vi.mock('@/lib/server/supabase/server', () => ({ createAuthenticatedClient: async () => ({
  auth: { getUser: async () => ({ data: { user: f.user ? { id: f.user } : null }, error: null }) },
  rpc: async () => ({ data: f.recovery, error: null }),
  from: () => { const q = { select: () => q, eq: () => q, single: async () => ({ data: { id: 'session', user_id: f.owner, conversation_id: 'conv', status: f.status, opened_at: f.openedAt }, error: null }) }; return q },
}) }))
vi.mock('@/lib/server/sessions/service', () => ({ closeSession: async (...args: unknown[]) => { f.closed(...args); if (f.closeError) throw new Error('write failed') } }))
import { closeOwnedSessionFromView } from '@/app/app/chat-recovery-actions'

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-27T12:00:00Z')); f.user = 'owner'; f.owner = 'owner'; f.status = 'open'; f.openedAt = new Date(Date.now() - 60 * 60_000).toISOString(); f.recovery = null; f.closeError = false; f.closed.mockClear() })
afterEach(() => vi.useRealTimers())
it('confirms time closure only after the authenticated write succeeds', async () => {
  expect(await closeOwnedSessionFromView('session', 'time_limit')).toMatchObject({ closed: true })
  expect(f.closed).toHaveBeenCalledWith(expect.anything(), 'session', 'time_limit')
})
it.each([null, 'outsider'])('rejects absent or foreign ownership (%s)', async user => {
  f.user = user
  await expect(closeOwnedSessionFromView('session', 'time_limit')).rejects.toThrow()
  expect(f.closed).not.toHaveBeenCalled()
})
it('returns a fresh clock instead of closing before the deadline', async () => {
  f.openedAt = new Date(Date.now() - 50 * 60_000).toISOString()
  expect(await closeOwnedSessionFromView('session', 'time_limit')).toMatchObject({ closed: false, reason: 'not_expired', timing: { serverNow: Date.now(), expiresAt: Date.now() + 10 * 60_000 } })
  expect(f.closed).not.toHaveBeenCalled()
})
it('lets an admitted pending turn finish after the deadline', async () => {
  f.recovery = { requestId: 'accepted', userMessageId: 'user-message', text: 'Texto', status: 'generating', canRetry: false, leaseUntil: new Date(Date.now() + 60_000).toISOString() }
  expect(await closeOwnedSessionFromView('session', 'time_limit')).toMatchObject({ closed: false, reason: 'turn_pending' })
  expect(f.closed).not.toHaveBeenCalled()
})
it('does not report closure if persistence fails', async () => {
  f.closeError = true
  await expect(closeOwnedSessionFromView('session', 'time_limit')).rejects.toThrow('write failed')
})
it('supports explicit manual closure, handles already closed state and rejects arbitrary modes', async () => {
  f.openedAt = new Date().toISOString()
  expect(await closeOwnedSessionFromView('session', 'user_request')).toMatchObject({ closed: true })
  f.closed.mockClear(); f.status = 'closed'
  expect(await closeOwnedSessionFromView('session', 'time_limit')).toMatchObject({ closed: true })
  await expect(closeOwnedSessionFromView('session', 'invalid' as never)).rejects.toThrow()
  expect(f.closed).not.toHaveBeenCalled()
})
