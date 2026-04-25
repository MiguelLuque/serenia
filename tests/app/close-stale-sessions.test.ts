import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks (hoisted so the route's module-init imports use them)
// ---------------------------------------------------------------------------

const { createServiceRoleClientMock, enqueueAssessmentGenerationMock } =
  vi.hoisted(() => ({
    createServiceRoleClientMock: vi.fn(),
    enqueueAssessmentGenerationMock: vi.fn(),
  }))

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: createServiceRoleClientMock,
}))

vi.mock('@/lib/workflows', () => ({
  enqueueAssessmentGeneration: enqueueAssessmentGenerationMock,
}))

import { GET, POST } from '@/app/api/internal/close-stale-sessions/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type QueryResult = { data: unknown; error: unknown }

/**
 * Build a chainable Supabase query mock. Any combination of `.select().eq().lt().limit()`
 * resolves to the given { data, error } shape. The chain is also awaitable
 * directly (workflow code does `await supabase.from(...).update(...).in(...)`).
 */
function makeChain(result: QueryResult) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select',
    'insert',
    'update',
    'delete',
    'upsert',
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'in',
    'order',
    'limit',
    'single',
    'maybeSingle',
  ]
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  ;(chain as { then: unknown }).then = (
    resolve: (v: unknown) => unknown,
    reject?: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return chain
}

/**
 * Builds a Supabase mock that returns one chain per `.from()` call so the
 * test can assert which chain handled the SELECT and which handled the
 * UPDATE — and in what order.
 */
function makeSupabase(
  selectResult: QueryResult,
  updateResult: QueryResult = { data: null, error: null },
) {
  const chains: ReturnType<typeof makeChain>[] = []
  let callIndex = 0
  const fromMock = vi.fn((name: string) => {
    void name
    callIndex++
    const result = callIndex === 1 ? selectResult : updateResult
    const chain = makeChain(result)
    chains.push(chain)
    return chain
  })
  return { from: fromMock, _chains: chains }
}

function authedRequest(method: 'GET' | 'POST', secret = 'test-secret'): Request {
  return new Request('https://serenia.test/api/internal/close-stale-sessions', {
    method,
    headers: { authorization: `Bearer ${secret}` },
  })
}

function unauthedRequest(method: 'GET' | 'POST'): Request {
  return new Request('https://serenia.test/api/internal/close-stale-sessions', {
    method,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET

beforeEach(() => {
  createServiceRoleClientMock.mockReset()
  enqueueAssessmentGenerationMock.mockReset()
  process.env.CRON_SECRET = 'test-secret'
})

afterEach(() => {
  if (ORIGINAL_CRON_SECRET === undefined) {
    delete process.env.CRON_SECRET
  } else {
    process.env.CRON_SECRET = ORIGINAL_CRON_SECRET
  }
})

describe('POST /api/internal/close-stale-sessions — auth', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await POST(unauthedRequest('POST'))
    expect(res.status).toBe(401)
    expect(createServiceRoleClientMock).not.toHaveBeenCalled()
    expect(enqueueAssessmentGenerationMock).not.toHaveBeenCalled()
  })

  it('returns 401 with an incorrect Bearer token', async () => {
    const res = await POST(authedRequest('POST', 'wrong-secret'))
    expect(res.status).toBe(401)
    expect(createServiceRoleClientMock).not.toHaveBeenCalled()
    expect(enqueueAssessmentGenerationMock).not.toHaveBeenCalled()
  })

  it('returns 401 (refuse-by-default) when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET
    // Even with a Bearer header that "looks valid", missing CRON_SECRET must
    // fail closed — the endpoint never falls back to "no auth required".
    const res = await POST(authedRequest('POST', 'anything'))
    expect(res.status).toBe(401)
    expect(createServiceRoleClientMock).not.toHaveBeenCalled()
    expect(enqueueAssessmentGenerationMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/internal/close-stale-sessions — happy paths', () => {
  it('returns 200 with closed=0 and skips enqueue when no stale sessions exist', async () => {
    const supabase = makeSupabase({ data: [], error: null })
    createServiceRoleClientMock.mockReturnValue(supabase)

    const res = await POST(authedRequest('POST'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true, closed: 0, enqueued: 0 })
    expect(enqueueAssessmentGenerationMock).not.toHaveBeenCalled()
  })

  it('closes N stale sessions and enqueues a workflow per session', async () => {
    const stale = [{ id: 'sess-a' }, { id: 'sess-b' }, { id: 'sess-c' }]
    const supabase = makeSupabase({ data: stale, error: null })
    createServiceRoleClientMock.mockReturnValue(supabase)
    enqueueAssessmentGenerationMock.mockResolvedValue({ runId: 'run-x' })

    const res = await POST(authedRequest('POST'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true, closed: 3, enqueued: 3 })

    expect(enqueueAssessmentGenerationMock).toHaveBeenCalledTimes(3)
    expect(enqueueAssessmentGenerationMock).toHaveBeenNthCalledWith(1, {
      sessionId: 'sess-a',
    })
    expect(enqueueAssessmentGenerationMock).toHaveBeenNthCalledWith(2, {
      sessionId: 'sess-b',
    })
    expect(enqueueAssessmentGenerationMock).toHaveBeenNthCalledWith(3, {
      sessionId: 'sess-c',
    })
  })

  it('issues the bulk-close UPDATE before any workflow enqueue', async () => {
    // Order matters: a failing enqueue still leaves the session closed (which
    // the user cron next tick can pick back up via the existence check). If
    // we enqueued first, a crash between enqueue and update would leave the
    // session open while a workflow runs against an open session.
    const stale = [{ id: 'sess-a' }]
    const supabase = makeSupabase({ data: stale, error: null })
    createServiceRoleClientMock.mockReturnValue(supabase)

    const callOrder: string[] = []
    // Capture the moment the UPDATE chain resolves.
    const origFrom = supabase.from
    supabase.from = vi.fn((name: string) => {
      const chain = origFrom(name) as Record<string, unknown>
      const originalIn = chain.in as (...a: unknown[]) => unknown
      chain.in = vi.fn((...args: unknown[]) => {
        callOrder.push('update.in')
        return originalIn(...args)
      })
      return chain
    })
    enqueueAssessmentGenerationMock.mockImplementation(async () => {
      callOrder.push('enqueue')
      return { runId: 'run-x' }
    })

    await POST(authedRequest('POST'))
    const updateIdx = callOrder.indexOf('update.in')
    const enqueueIdx = callOrder.indexOf('enqueue')
    expect(updateIdx).toBeGreaterThanOrEqual(0)
    expect(enqueueIdx).toBeGreaterThanOrEqual(0)
    expect(updateIdx).toBeLessThan(enqueueIdx)
  })

  it('applies a .limit(200) cap on the stale-session SELECT', async () => {
    const stale = Array.from({ length: 200 }, (_, i) => ({ id: `sess-${i}` }))
    const supabase = makeSupabase({ data: stale, error: null })
    createServiceRoleClientMock.mockReturnValue(supabase)

    const res = await POST(authedRequest('POST'))
    expect(res.status).toBe(200)

    // The SELECT chain is the first .from() call. Verify .limit(200) was applied.
    const selectChain = supabase._chains[0] as { limit: ReturnType<typeof vi.fn> }
    expect(selectChain.limit).toHaveBeenCalledWith(200)

    // Sanity: enqueue runs once per row returned by the (capped) SELECT.
    expect(enqueueAssessmentGenerationMock).toHaveBeenCalledTimes(200)
  })
})

describe('GET /api/internal/close-stale-sessions', () => {
  it('GET also runs the same close-and-enqueue flow (Vercel Cron uses GET)', async () => {
    const stale = [{ id: 'sess-a' }, { id: 'sess-b' }]
    const supabase = makeSupabase({ data: stale, error: null })
    createServiceRoleClientMock.mockReturnValue(supabase)
    enqueueAssessmentGenerationMock.mockResolvedValue({ runId: 'run-x' })

    const res = await GET(authedRequest('GET'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true, closed: 2, enqueued: 2 })
    expect(enqueueAssessmentGenerationMock).toHaveBeenCalledTimes(2)
  })

  it('GET also rejects unauthenticated requests with 401', async () => {
    const res = await GET(unauthedRequest('GET'))
    expect(res.status).toBe(401)
    expect(createServiceRoleClientMock).not.toHaveBeenCalled()
  })
})
