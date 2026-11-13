import { beforeEach, expect, it, vi } from 'vitest'

const f = vi.hoisted(() => ({
  user: 'owner' as string | null, sessionOwner: 'owner', conversationOwner: 'owner',
  receipt: null as string | null, receiptError: false, serviceCalls: 0,
  filters: [] as Array<[string, string]>, selected: '', events: [] as string[],
}))
vi.mock('@/lib/server/supabase/server', () => ({
  createAuthenticatedClient: async () => ({
    auth: { getUser: async () => ({ data: { user: f.user ? { id: f.user } : null }, error: null }) },
    from: (table: string) => {
      const q = { select: () => q, eq: () => q, single: async () => ({ data: table === 'clinical_sessions'
        ? { id: '20000000-0000-4000-8000-000000000001', user_id: f.sessionOwner, conversation_id: 'conversation', status: 'open', opened_at: new Date().toISOString() }
        : { id: 'conversation', user_id: f.conversationOwner }, error: null }) }
      return q
    },
  }),
  createServiceRoleClient: () => {
    f.serviceCalls++
    return { from: (table: string) => {
      if (table !== 'chat_turns') throw new Error('unexpected table')
      const q = { select: (value: string) => { f.selected = value; return q }, eq: (key: string, value: string) => { f.filters.push([key, value]); return q }, maybeSingle: async () => { f.events.push('receipt'); return { data: f.receipt === null ? null : { status: f.receipt }, error: f.receiptError ? { code: 'fictional' } : null } } }
      return q
    } }
  },
}))
vi.mock('@/lib/server/chat/owned-snapshot', () => ({ readOwnedChatSnapshot: async (_client: unknown, session: unknown) => { f.events.push('snapshot'); return { session, rows: [], recovery: null } } }))
import { getOwnedChatState } from '@/app/app/chat-recovery-actions'

const sid = '20000000-0000-4000-8000-000000000001'
const read = getOwnedChatState as unknown as (sessionId: string, requestId?: string) => Promise<{ receipt?: string }>
beforeEach(() => { f.user = 'owner'; f.sessionOwner = 'owner'; f.conversationOwner = 'owner'; f.receipt = null; f.receiptError = false; f.serviceCalls = 0; f.filters = []; f.selected = ''; f.events = [] })

it('reads a minimal exact receipt before the transcript', async () => {
  f.receipt = 'completed'
  const result = await read(sid, 'turn-1')
  expect(result.receipt).toBe('completed')
  expect(f.selected).toBe('status')
  expect(f.filters).toEqual([['session_id', sid], ['user_id', 'owner'], ['request_id', 'turn-1']])
  expect(f.events).toEqual(['receipt', 'snapshot'])
})

it('does not access service role for the ordinary read', async () => {
  await read(sid)
  expect(f.serviceCalls).toBe(0)
})

it.each(['', 'x'.repeat(101), 'bad/value'])('rejects invalid request ID before privileged access: %s', async id => {
  await expect(read(sid, id)).rejects.toThrow()
  expect(f.serviceCalls).toBe(0)
})

it('rejects an invalid session ID before privileged access', async () => {
  await expect(read('not-a-uuid', 'turn-1')).rejects.toThrow()
  expect(f.serviceCalls).toBe(0)
})

it.each(['no-user', 'foreign-session', 'foreign-conversation'])('rejects %s before privileged access', async scenario => {
  if (scenario === 'no-user') f.user = null
  if (scenario === 'foreign-session') f.sessionOwner = 'other'
  if (scenario === 'foreign-conversation') f.conversationOwner = 'other'
  await expect(read(sid, 'turn-1')).rejects.toThrow()
  expect(f.serviceCalls).toBe(0)
})

it('reports an absent row as missing and does not infer failure', async () => {
  expect((await read(sid, 'turn-1')).receipt).toBe('missing')
})

it.each(['bad-status', 'query-error'])('fails closed for %s', async scenario => {
  f.receipt = scenario === 'bad-status' ? 'invented' : null
  f.receiptError = scenario === 'query-error'
  await expect(read(sid, 'turn-1')).rejects.toThrow()
})
