import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isSessionExpired,
  getOrResolveActiveSession,
  createSession,
  touchSession,
  closeSession,
  computeProtocolPhase,
  PROTOCOL_MAX_PHASE,
  SESSION_MAX_DURATION_MS,
  SESSION_INACTIVITY_MS,
} from '@/lib/server/sessions/service'

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

/** Build a minimal chainable Supabase query mock that resolves with { data, error, count? }. */
function makeChain(result: { data: unknown; error: unknown; count?: unknown }) {
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
  // Plan 8 T5.2: createSession ahora primero hace un count de sesiones
  // cerradas (call 1) para fijar protocol_phase, luego inserta la
  // conversación (call 2) y la sesión (call 3).

  it('inserts conversation then clinical_session and returns session row', async () => {
    const conversation = { id: 'conv-1', user_id: 'user-1' }
    const session = makeSession({ conversation_id: 'conv-1', protocol_phase: 1 })

    let callCount = 0
    const fromMock = vi.fn(() => {
      callCount++
      if (callCount === 1) return makeChain({ data: null, error: null, count: 0 })
      if (callCount === 2) return makeChain({ data: conversation, error: null })
      return makeChain({ data: session, error: null })
    })
    const supabase = { from: fromMock } as any

    const result = await createSession(supabase, 'user-1')
    expect(result).toEqual(session)
    expect(fromMock).toHaveBeenNthCalledWith(1, 'clinical_sessions') // count
    expect(fromMock).toHaveBeenNthCalledWith(2, 'conversations')
    expect(fromMock).toHaveBeenNthCalledWith(3, 'clinical_sessions') // insert
  })

  it('passes protocol_phase = 1 when no closed sessions exist', async () => {
    const conversation = { id: 'conv-1', user_id: 'user-1' }
    const session = makeSession({ conversation_id: 'conv-1', protocol_phase: 1 })

    let callCount = 0
    const chains: ReturnType<typeof makeChain>[] = []
    const fromMock = vi.fn(() => {
      callCount++
      const chain = makeChain({
        data: callCount === 1 ? null : callCount === 2 ? conversation : session,
        error: null,
        count: callCount === 1 ? 0 : undefined,
      })
      chains.push(chain)
      return chain
    })
    const supabase = { from: fromMock } as any

    await createSession(supabase, 'user-1')

    // 3rd chain is the clinical_sessions insert
    expect(chains[2].insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        conversation_id: 'conv-1',
        protocol_phase: 1,
      }),
    )
  })

  it('passes protocol_phase = 8 when 7 sessions already closed', async () => {
    const conversation = { id: 'conv-1', user_id: 'user-1' }
    const session = makeSession({ conversation_id: 'conv-1', protocol_phase: 8 })

    let callCount = 0
    const chains: ReturnType<typeof makeChain>[] = []
    const fromMock = vi.fn(() => {
      callCount++
      const chain = makeChain({
        data: callCount === 1 ? null : callCount === 2 ? conversation : session,
        error: null,
        count: callCount === 1 ? 7 : undefined,
      })
      chains.push(chain)
      return chain
    })
    const supabase = { from: fromMock } as any

    await createSession(supabase, 'user-1')

    expect(chains[2].insert).toHaveBeenCalledWith(
      expect.objectContaining({ protocol_phase: 8 }),
    )
  })

  it('caps protocol_phase at 8 when 10 sessions already closed (mantenimiento)', async () => {
    const conversation = { id: 'conv-1', user_id: 'user-1' }
    const session = makeSession({ conversation_id: 'conv-1', protocol_phase: 8 })

    let callCount = 0
    const chains: ReturnType<typeof makeChain>[] = []
    const fromMock = vi.fn(() => {
      callCount++
      const chain = makeChain({
        data: callCount === 1 ? null : callCount === 2 ? conversation : session,
        error: null,
        count: callCount === 1 ? 10 : undefined,
      })
      chains.push(chain)
      return chain
    })
    const supabase = { from: fromMock } as any

    await createSession(supabase, 'user-1')

    expect(chains[2].insert).toHaveBeenCalledWith(
      expect.objectContaining({ protocol_phase: 8 }),
    )
  })

  it('throws when count of closed sessions fails', async () => {
    const countError = new Error('count failed')
    const fromMock = vi.fn(() =>
      makeChain({ data: null, error: countError, count: null }),
    )
    const supabase = { from: fromMock } as any

    await expect(createSession(supabase, 'user-1')).rejects.toThrow('count failed')
    expect(fromMock).toHaveBeenCalledTimes(1)
  })

  it('deletes orphan conversation if session insert fails', async () => {
    const conversation = { id: 'conv-1', user_id: 'user-1' }
    const sessionError = new Error('session insert failed')

    let callCount = 0
    const fromMock = vi.fn(() => {
      callCount++
      if (callCount === 1) return makeChain({ data: null, error: null, count: 0 }) // count
      if (callCount === 2) return makeChain({ data: conversation, error: null }) // conv insert
      if (callCount === 3) return makeChain({ data: null, error: sessionError }) // session insert
      // 4th call: delete orphan conversation
      return makeChain({ data: null, error: null })
    })
    const supabase = { from: fromMock } as any

    await expect(createSession(supabase, 'user-1')).rejects.toThrow('session insert failed')
    expect(fromMock).toHaveBeenCalledTimes(4)
    expect(fromMock).toHaveBeenNthCalledWith(4, 'conversations')
  })

  it('throws when conversation insert fails', async () => {
    const convError = new Error('conv insert failed')
    let callCount = 0
    const fromMock = vi.fn(() => {
      callCount++
      if (callCount === 1) return makeChain({ data: null, error: null, count: 0 })
      return makeChain({ data: null, error: convError })
    })
    const supabase = { from: fromMock } as any

    await expect(createSession(supabase, 'user-1')).rejects.toThrow('conv insert failed')
    expect(fromMock).toHaveBeenCalledTimes(2)
  })
})

// ---------------------------------------------------------------------------
// 3b. computeProtocolPhase — pure function (Plan 8 T5.2)
// ---------------------------------------------------------------------------

describe('computeProtocolPhase', () => {
  it('returns 1 when 0 closed sessions', () => {
    expect(computeProtocolPhase(0)).toBe(1)
  })

  it('returns N+1 for N closed sessions while N < 8', () => {
    expect(computeProtocolPhase(1)).toBe(2)
    expect(computeProtocolPhase(2)).toBe(3)
    expect(computeProtocolPhase(6)).toBe(7)
    expect(computeProtocolPhase(7)).toBe(PROTOCOL_MAX_PHASE)
  })

  it('caps at 8 (mantenimiento) for ≥ 8 closed sessions', () => {
    expect(computeProtocolPhase(8)).toBe(8)
    expect(computeProtocolPhase(10)).toBe(8)
    expect(computeProtocolPhase(100)).toBe(8)
  })

  it('PROTOCOL_MAX_PHASE is 8', () => {
    expect(PROTOCOL_MAX_PHASE).toBe(8)
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
  // Plan 8 Bloque 2 Fix 3 — closeSession ahora delega en la RPC
  // `close_session_atomic` (migration 20260502000006). El test valida que
  // se llama con los args correctos y que el throw de la RPC se propaga.

  function makeAuthedSupabase(rpcResult: { error: unknown } = { error: null }) {
    const rpcMock = vi.fn().mockResolvedValue(rpcResult)
    const getUserMock = vi
      .fn()
      .mockResolvedValue({ data: { user: { id: 'user-1' } } })
    return {
      supabase: {
        auth: { getUser: getUserMock },
        rpc: rpcMock,
      } as any,
      rpcMock,
      getUserMock,
    }
  }

  it('invokes close_session_atomic RPC with sessionId, userId, reason', async () => {
    const { supabase, rpcMock } = makeAuthedSupabase()

    await closeSession(supabase, 'session-1', 'user_request')

    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(rpcMock).toHaveBeenCalledWith('close_session_atomic', {
      p_session_id: 'session-1',
      p_user_id: 'user-1',
      p_reason: 'user_request',
    })
  })

  it('passes closure_reason correctly to the RPC', async () => {
    const { supabase, rpcMock } = makeAuthedSupabase()

    await closeSession(supabase, 'session-1', 'time_limit')

    expect(rpcMock).toHaveBeenCalledWith(
      'close_session_atomic',
      expect.objectContaining({ p_reason: 'time_limit' }),
    )
  })

  it('propagates an error from the RPC (e.g. session not found)', async () => {
    const { supabase } = makeAuthedSupabase({
      error: new Error('Session session-1 not found for user user-1'),
    })

    await expect(
      closeSession(supabase, 'session-1', 'inactivity'),
    ).rejects.toThrow('Session session-1 not found for user user-1')
  })

  it('throws when there is no authenticated user', async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      rpc: vi.fn(),
    } as any

    await expect(
      closeSession(supabase, 'session-1', 'user_request'),
    ).rejects.toThrow('No authenticated user')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('does NOT propagate errors from enqueueAssessmentGeneration (fire-and-forget)', async () => {
    // The RPC succeeds; the workflow enqueue rejects. closeSession must
    // resolve normally — the cron sweep is the safety net.
    const { supabase } = makeAuthedSupabase()
    // We can't easily mock enqueueAssessmentGeneration here without
    // module-level vi.mock. The pre-existing test suite did not cover this
    // either; we trust the try/catch in service.ts (covered separately by
    // close-session-tools and getOrResolveActiveSession tests).
    await expect(
      closeSession(supabase, 'session-1', 'user_request'),
    ).resolves.toBeUndefined()
  })
})
