import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isSessionExpired,
  getOrResolveActiveSession,
  createSession,
  touchSession,
  closeSession,
  SESSION_MAX_DURATION_MS,
  SESSION_INACTIVITY_MS,
} from '@/lib/sessions/service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString()
  return {
    id: 'session-1',
    user_id: 'user-1',
    conversation_id: 'conv-1',
    status: 'open' as const,
    opened_at: now,
    closed_at: null,
    closure_reason: null,
    last_activity_at: now,
    summary_id: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

/** Build a minimal chainable Supabase query mock that resolves with { data, error }. */
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'order', 'limit', 'single', 'maybeSingle',
  ]
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  // Make the chain thenable so `await chain` resolves to result
  ;(chain as { then: unknown }).then = (
    resolve: (v: unknown) => unknown,
    _reject?: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, _reject)
  return chain
}

// ---------------------------------------------------------------------------
// 1. isSessionExpired
// ---------------------------------------------------------------------------

describe('isSessionExpired', () => {
  it('returns false for a session opened 10 minutes ago', () => {
    const openedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    expect(isSessionExpired({ opened_at: openedAt })).toBe(false)
  })

  it('returns true for a session opened 61 minutes ago', () => {
    const openedAt = new Date(Date.now() - 61 * 60 * 1000).toISOString()
    expect(isSessionExpired({ opened_at: openedAt })).toBe(true)
  })

  it('returns false exactly at SESSION_MAX_DURATION_MS - 1ms', () => {
    const openedAt = new Date(Date.now() - SESSION_MAX_DURATION_MS + 1).toISOString()
    expect(isSessionExpired({ opened_at: openedAt })).toBe(false)
  })

  it('returns true exactly at SESSION_MAX_DURATION_MS', () => {
    const now = Date.now()
    const openedAt = new Date(now - SESSION_MAX_DURATION_MS).toISOString()
    expect(isSessionExpired({ opened_at: openedAt }, now)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 2. getOrResolveActiveSession
// ---------------------------------------------------------------------------

describe('getOrResolveActiveSession', () => {
  it('returns session when last_activity_at is less than 30 min ago', async () => {
    const session = makeSession({
      last_activity_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    })

    const chain = makeChain({ data: session, error: null })
    const fromMock = vi.fn(() => chain)
    const supabase = { from: fromMock } as any

    const result = await getOrResolveActiveSession(supabase, 'user-1')
    expect(result).toEqual(session)
    expect(fromMock).toHaveBeenCalledWith('clinical_sessions')
  })

  it('marks session inactive and returns null when last_activity_at >= 30 min ago', async () => {
    const session = makeSession({
      last_activity_at: new Date(Date.now() - SESSION_INACTIVITY_MS - 1000).toISOString(),
    })

    // First call: fetch (maybeSingle resolves with session)
    // Second call: update (resolves with no error)
    let callCount = 0
    const fromMock = vi.fn(() => {
      callCount++
      if (callCount === 1) {
        return makeChain({ data: session, error: null })
      }
      return makeChain({ data: null, error: null })
    })
    const supabase = { from: fromMock } as any

    const result = await getOrResolveActiveSession(supabase, 'user-1')
    expect(result).toBeNull()
    expect(fromMock).toHaveBeenCalledTimes(2)
    expect(fromMock).toHaveBeenNthCalledWith(2, 'clinical_sessions')
  })

  it('returns null when no open session exists', async () => {
    const chain = makeChain({ data: null, error: null })
    const fromMock = vi.fn(() => chain)
    const supabase = { from: fromMock } as any

    const result = await getOrResolveActiveSession(supabase, 'user-1')
    expect(result).toBeNull()
  })

  it('throws when the fetch query returns an error', async () => {
    const chain = makeChain({ data: null, error: new Error('db error') })
    const fromMock = vi.fn(() => chain)
    const supabase = { from: fromMock } as any

    await expect(getOrResolveActiveSession(supabase, 'user-1')).rejects.toThrow('db error')
  })
})

// ---------------------------------------------------------------------------
// 3. createSession
// ---------------------------------------------------------------------------

describe('createSession', () => {
  it('inserts conversation then clinical_session and returns session row', async () => {
    const conversation = { id: 'conv-1', user_id: 'user-1' }
    const session = makeSession({ conversation_id: 'conv-1' })

    let callCount = 0
    const fromMock = vi.fn(() => {
      callCount++
      if (callCount === 1) return makeChain({ data: conversation, error: null })
      return makeChain({ data: session, error: null })
    })
    const supabase = { from: fromMock } as any

    const result = await createSession(supabase, 'user-1')
    expect(result).toEqual(session)
    expect(fromMock).toHaveBeenNthCalledWith(1, 'conversations')
    expect(fromMock).toHaveBeenNthCalledWith(2, 'clinical_sessions')
  })

  it('deletes orphan conversation if session insert fails', async () => {
    const conversation = { id: 'conv-1', user_id: 'user-1' }
    const sessionError = new Error('session insert failed')

    let callCount = 0
    const fromMock = vi.fn(() => {
      callCount++
      if (callCount === 1) return makeChain({ data: conversation, error: null })
      if (callCount === 2) return makeChain({ data: null, error: sessionError })
      // 3rd call: delete orphan conversation
      return makeChain({ data: null, error: null })
    })
    const supabase = { from: fromMock } as any

    await expect(createSession(supabase, 'user-1')).rejects.toThrow('session insert failed')
    expect(fromMock).toHaveBeenCalledTimes(3)
    expect(fromMock).toHaveBeenNthCalledWith(3, 'conversations')
  })

  it('throws when conversation insert fails', async () => {
    const convError = new Error('conv insert failed')
    const fromMock = vi.fn(() => makeChain({ data: null, error: convError }))
    const supabase = { from: fromMock } as any

    await expect(createSession(supabase, 'user-1')).rejects.toThrow('conv insert failed')
    expect(fromMock).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// 4. touchSession
// ---------------------------------------------------------------------------

describe('touchSession', () => {
  it('issues an update with now() filter on id and status=open', async () => {
    const chain = makeChain({ data: null, error: null })
    const fromMock = vi.fn(() => chain)
    const supabase = { from: fromMock } as any

    await touchSession(supabase, 'session-1')

    expect(fromMock).toHaveBeenCalledWith('clinical_sessions')
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_activity_at: expect.any(String) }),
    )
    expect(chain.eq).toHaveBeenCalledWith('id', 'session-1')
    expect(chain.eq).toHaveBeenCalledWith('status', 'open')
  })

  it('throws when the update returns an error', async () => {
    const chain = makeChain({ data: null, error: new Error('update failed') })
    const fromMock = vi.fn(() => chain)
    const supabase = { from: fromMock } as any

    await expect(touchSession(supabase, 'session-1')).rejects.toThrow('update failed')
  })
})

// ---------------------------------------------------------------------------
// 5. closeSession
// ---------------------------------------------------------------------------

describe('closeSession', () => {
  it('updates clinical_sessions and conversations with correct fields', async () => {
    const sessionData = { conversation_id: 'conv-1', user_id: 'user-1' }

    let callCount = 0
    const fromMock = vi.fn(() => {
      callCount++
      // 1st: fetch session (select + single)
      // 2nd: update clinical_sessions
      // 3rd: update conversations
      return makeChain({ data: callCount === 1 ? sessionData : null, error: null })
    })
    const supabase = { from: fromMock } as any

    await closeSession(supabase, 'session-1', 'user_request')

    // 1-3 are the core close flow; the generator may issue extra reads
    // but is wrapped in try/catch and must not block closure.
    expect(fromMock).toHaveBeenNthCalledWith(1, 'clinical_sessions')
    expect(fromMock).toHaveBeenNthCalledWith(2, 'clinical_sessions')
    expect(fromMock).toHaveBeenNthCalledWith(3, 'conversations')
  })

  it('passes closure_reason correctly', async () => {
    const sessionData = { conversation_id: 'conv-1', user_id: 'user-1' }

    let callCount = 0
    const chains: ReturnType<typeof makeChain>[] = []
    const fromMock = vi.fn(() => {
      callCount++
      const chain = makeChain({
        data: callCount === 1 ? sessionData : null,
        error: null,
      })
      chains.push(chain)
      return chain
    })
    const supabase = { from: fromMock } as any

    await closeSession(supabase, 'session-1', 'time_limit')

    // Second chain is the clinical_sessions update
    expect(chains[1].update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'closed',
        closure_reason: 'time_limit',
        closed_at: expect.any(String),
      }),
    )
    // Third chain is the conversations update
    expect(chains[2].update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'closed',
        ended_at: expect.any(String),
      }),
    )
  })

  it('throws when the fetch returns an error', async () => {
    const chain = makeChain({ data: null, error: new Error('fetch failed') })
    const fromMock = vi.fn(() => chain)
    const supabase = { from: fromMock } as any

    await expect(closeSession(supabase, 'session-1', 'inactivity')).rejects.toThrow('fetch failed')
  })
})
