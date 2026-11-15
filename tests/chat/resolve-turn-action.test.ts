import { beforeEach, expect, it, vi } from 'vitest'

const f = vi.hoisted(() => ({ user: 'owner' as string | null, owner: 'owner', status: 'busy', error: false, calls: [] as unknown[] }))
vi.mock('@/lib/server/supabase/server', () => ({
  createAuthenticatedClient: async () => ({
    auth: { getUser: async () => ({ data: { user: f.user ? { id: f.user } : null }, error: null }) },
    from: () => { const q = { select: () => q, eq: () => q, single: async () => ({ data: { id: sid, user_id: f.owner, conversation_id: 'conversation', status: 'open', opened_at: new Date().toISOString() }, error: null }) }; return q },
    rpc: async (name: string, args: unknown) => { f.calls.push([name, args]); return { data: f.status, error: f.error ? new Error('unavailable') : null } },
  }),
  createServiceRoleClient: () => { throw new Error('unexpected privileged access') },
}))
import * as actions from '@/app/app/chat-recovery-actions'
const sid = '20000000-0000-4000-8000-000000000001'
const resolve = (session: string, request: string, attempt: number = 1) => (actions as unknown as { resolveOwnedChatTurn: (s: string, r: string, a: number) => Promise<string> }).resolveOwnedChatTurn(session, request, attempt)
beforeEach(() => { f.user = 'owner'; f.owner = 'owner'; f.status = 'busy'; f.error = false; f.calls = [] })

it.each(['busy', 'active', 'failed', 'completed', 'interrupted', 'closed', 'unknown', 'stale'])('returns the validated %s result for the exact owned turn', async status => {
  f.status = status
  expect(await resolve(sid, 'turn-1')).toBe(status)
  expect(f.calls).toEqual([['resolve_expired_chat_turn', { p_session_id: sid, p_request_id: 'turn-1', p_expected_attempt: 1 }]])
})
it.each([0, -1, 1.5, 4, NaN])('rejects invalid attempt %s before the RPC', async attempt => {
  await expect(resolve(sid, 'turn-1', attempt)).rejects.toThrow()
  expect(f.calls).toHaveLength(0)
})
it.each(['', 'bad/id', 'x'.repeat(101)])('rejects invalid request id %s before the RPC', async request => {
  await expect(resolve(sid, request)).rejects.toThrow()
  expect(f.calls).toHaveLength(0)
})
it.each(['no-user', 'foreign', 'invalid-session'])('rejects %s before the RPC', async scenario => {
  if (scenario === 'no-user') f.user = null
  if (scenario === 'foreign') f.owner = 'other'
  await expect(resolve(scenario === 'invalid-session' ? 'bad' : sid, 'turn-1')).rejects.toThrow()
  expect(f.calls).toHaveLength(0)
})
it.each(['error', 'invalid-status'])('does not present %s as a confirmed resolution', async scenario => {
  f.error = scenario === 'error'; f.status = scenario === 'invalid-status' ? 'invented' : 'busy'
  await expect(resolve(sid, 'turn-1')).rejects.toThrow()
})
