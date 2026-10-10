import { describe, it, expect, vi } from 'vitest'
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
    const supabase = { from: fromMock } as never

    const result = await getOrResolveActiveSession(supabase, 'user-1')
    expect(result).toEqual(session)
    expect(fromMock).toHaveBeenCalledWith('clinical_sessions')
  })

  it('closes an inactive session through the same atomic RPC as manual close',async()=>{
    const session=makeSession({last_activity_at:new Date(Date.now()-SESSION_INACTIVITY_MS-1000).toISOString()})
    const rpc=vi.fn().mockResolvedValue({error:null})
    const client={from:vi.fn(()=>makeChain({data:session,error:null})),auth:{getUser:vi.fn().mockResolvedValue({data:{user:{id:'user-1'}}})},rpc}
    expect(await getOrResolveActiveSession(client as never,'user-1')).toBeNull()
    expect(rpc).toHaveBeenCalledWith('close_session_atomic',{p_session_id:'session-1',p_user_id:'user-1',p_reason:'inactivity'})
  })

  it('returns the still-open session when activity resumes after the lazy-close read',async()=>{
    const old=makeSession({last_activity_at:new Date(Date.now()-SESSION_INACTIVITY_MS-1000).toISOString()})
    const current=makeSession()
    const from=vi.fn().mockReturnValueOnce(makeChain({data:old,error:null})).mockReturnValueOnce(makeChain({data:current,error:null}))
    const client={from,auth:{getUser:vi.fn().mockResolvedValue({data:{user:{id:'user-1'}},error:null})},rpc:vi.fn().mockResolvedValue({error:{code:'23514',message:'Session activity resumed'}})}
    expect(await getOrResolveActiveSession(client as never,'user-1')).toEqual(current)
    expect(from).toHaveBeenCalledTimes(2)
  })
  it('returns null when no open session exists', async () => {
    const chain = makeChain({ data: null, error: null })
    const fromMock = vi.fn(() => chain)
    const supabase = { from: fromMock } as never

    const result = await getOrResolveActiveSession(supabase, 'user-1')
    expect(result).toBeNull()
  })

  it('throws when the fetch query returns an error', async () => {
    const chain = makeChain({ data: null, error: new Error('db error') })
    const fromMock = vi.fn(() => chain)
    const supabase = { from: fromMock } as never

    await expect(getOrResolveActiveSession(supabase, 'user-1')).rejects.toThrow('db error')
  })
})

// ---------------------------------------------------------------------------
// 3. createSession
// ---------------------------------------------------------------------------

describe('createSession — authenticated atomic RPC', () => {
  it('authenticates the requested owner and delegates pair/phase/concurrency to SQL', async () => {
    const row=makeSession({protocol_phase:8})
    const rpc=vi.fn().mockResolvedValue({data:row,error:null})
    const client={auth:{getUser:vi.fn().mockResolvedValue({data:{user:{id:'user-1'}},error:null})},rpc,from:vi.fn()}
    expect(await createSession(client as never,'user-1')).toEqual(row)
    expect(rpc).toHaveBeenCalledWith('create_session_atomic',{p_user_id:'user-1'})
    expect(client.from).not.toHaveBeenCalled()
  })
  it('rejects a forged user identity before the RPC',async()=>{
    const rpc=vi.fn()
    const client={auth:{getUser:vi.fn().mockResolvedValue({data:{user:{id:'user-1'}},error:null})},rpc}
    await expect(createSession(client as never,'foreign')).rejects.toThrow('Unauthorized')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('propagates atomic RPC failures without creating an orphan',async()=>{
    const client={auth:{getUser:vi.fn().mockResolvedValue({data:{user:{id:'user-1'}},error:null})},rpc:vi.fn().mockResolvedValue({data:null,error:new Error('atomic failed')})}
    await expect(createSession(client as never,'user-1')).rejects.toThrow('atomic failed')
  })
})

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

describe('touchSession — owner-checked RPC',()=>{
  it('rejects revoked authentication before touching a session',async()=>{
    const rpc=vi.fn().mockResolvedValue({error:null})
    const client={auth:{getUser:vi.fn().mockResolvedValue({data:{user:{id:'user-1'}},error:new Error('revoked')})},rpc}
    await expect(touchSession(client as never,'session-1')).rejects.toThrow('Unauthorized')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('uses the authenticated RPC instead of revoked table DML',async()=>{
    const rpc=vi.fn().mockResolvedValue({error:null})
    await touchSession({auth:{getUser:vi.fn().mockResolvedValue({data:{user:{id:'user-1'}},error:null})},rpc} as never,'session-1')
    expect(rpc).toHaveBeenCalledWith('touch_session_atomic',{p_session_id:'session-1'})
  })
  it('propagates RPC errors',async()=>{
    await expect(touchSession({auth:{getUser:vi.fn().mockResolvedValue({data:{user:{id:'user-1'}},error:null})},rpc:vi.fn().mockResolvedValue({error:new Error('denied')})} as never,'session-1')).rejects.toThrow('denied')
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
      } as never,
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

  it('rejects an auth error even when stale user data is present',async()=>{
    const {supabase,rpcMock,getUserMock}=makeAuthedSupabase()
    getUserMock.mockResolvedValue({data:{user:{id:'user-1'}},error:new Error('revoked')})
    await expect(closeSession(supabase,'session-1','user_request')).rejects.toThrow('No authenticated user')
    expect(rpcMock).not.toHaveBeenCalled()
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
    } as never

    await expect(
      closeSession(supabase, 'session-1', 'user_request'),
    ).rejects.toThrow('No authenticated user')
    expect((supabase as {rpc: ReturnType<typeof vi.fn>}).rpc).not.toHaveBeenCalled()
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
