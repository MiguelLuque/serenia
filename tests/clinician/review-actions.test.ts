import { describe, it, expect, vi, beforeEach } from 'vitest'

const { createAuthenticatedClientMock, revalidatePathMock } = vi.hoisted(
  () => ({
    createAuthenticatedClientMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }),
)

vi.mock('@/lib/supabase/server', () => ({
  createAuthenticatedClient: createAuthenticatedClientMock,
}))

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}))

import {
  markReviewedAction,
  rejectAssessmentAction,
} from '@/app/app/clinica/sesion/[sessionId]/actions'

type Calls = {
  fromTable?: string
  updatePayload?: unknown
  updateEqArgs?: unknown[]
}

function makeSupabase({
  reviewerId = 'reviewer-1',
  updateError = null as unknown as { message: string } | null,
  calls,
}: {
  reviewerId?: string | null
  updateError?: { message: string } | null
  calls: Calls
}) {
  const updateChain = {
    eq: vi.fn((...args: unknown[]) => {
      calls.updateEqArgs = args
      return Promise.resolve({ data: null, error: updateError })
    }),
  }

  return {
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: reviewerId ? { user: { id: reviewerId } } : { user: null },
          error: null,
        }),
      ),
    },
    from: vi.fn((table: string) => {
      calls.fromTable = table
      return {
        update: vi.fn((payload: unknown) => {
          calls.updatePayload = payload
          return updateChain
        }),
      }
    }),
  }
}

beforeEach(() => {
  createAuthenticatedClientMock.mockReset()
  revalidatePathMock.mockReset()
})

describe('markReviewedAction', () => {
  it('updates the assessment in place with reviewer + timestamp and revalidates', async () => {
    const calls: Calls = {}
    const supabase = makeSupabase({ calls, reviewerId: 'reviewer-42' })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const before = new Date().toISOString()
    const result = await markReviewedAction({
      assessmentId: 'a-1',
      sessionId: 'session-1',
    })
    const after = new Date().toISOString()

    expect(result).toEqual({ ok: true })

    expect(calls.fromTable).toBe('assessments')
    const payload = calls.updatePayload as Record<string, unknown>
    expect(payload.status).toBe('reviewed_confirmed')
    expect(payload.reviewed_by).toBe('reviewer-42')
    expect(typeof payload.reviewed_at).toBe('string')
    expect((payload.reviewed_at as string) >= before).toBe(true)
    expect((payload.reviewed_at as string) <= after).toBe(true)
    // No supersede / no rejection_reason should leak into the payload.
    expect(payload.rejection_reason).toBeUndefined()
    expect(payload.supersedes_assessment_id).toBeUndefined()

    expect(calls.updateEqArgs).toEqual(['id', 'a-1'])

    expect(revalidatePathMock).toHaveBeenCalledWith('/app')
    expect(revalidatePathMock).toHaveBeenCalledWith(
      '/app/clinica/sesion/session-1',
    )
  })

  it('returns {ok:false} when the user is not authenticated', async () => {
    const calls: Calls = {}
    const supabase = makeSupabase({ calls, reviewerId: null })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const result = await markReviewedAction({
      assessmentId: 'a-1',
      sessionId: 'session-1',
    })

    expect(result).toEqual({ ok: false, error: 'No autenticado' })
    expect(calls.updatePayload).toBeUndefined()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('propagates the supabase error message and does not revalidate', async () => {
    const calls: Calls = {}
    const supabase = makeSupabase({
      calls,
      updateError: { message: 'rls_denied' },
    })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const result = await markReviewedAction({
      assessmentId: 'a-1',
      sessionId: 'session-1',
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.error).toContain('rls_denied')
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})

describe('rejectAssessmentAction', () => {
  it('updates the row to rejected with trimmed reason and revalidates', async () => {
    const calls: Calls = {}
    const supabase = makeSupabase({ calls, reviewerId: 'reviewer-7' })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const before = new Date().toISOString()
    const result = await rejectAssessmentAction({
      assessmentId: 'a-1',
      sessionId: 'session-1',
      reason: '   No refleja la transcripción.   ',
    })
    const after = new Date().toISOString()

    expect(result).toEqual({ ok: true })

    const payload = calls.updatePayload as Record<string, unknown>
    expect(payload.status).toBe('rejected')
    expect(payload.reviewed_by).toBe('reviewer-7')
    expect(payload.rejection_reason).toBe('No refleja la transcripción.')
    expect(typeof payload.reviewed_at).toBe('string')
    expect((payload.reviewed_at as string) >= before).toBe(true)
    expect((payload.reviewed_at as string) <= after).toBe(true)

    expect(calls.updateEqArgs).toEqual(['id', 'a-1'])

    expect(revalidatePathMock).toHaveBeenCalledWith('/app')
    expect(revalidatePathMock).toHaveBeenCalledWith(
      '/app/clinica/sesion/session-1',
    )
  })

  it('returns {ok:false} when reason is blank (min 3 chars after trim) and does not touch the DB', async () => {
    const calls: Calls = {}
    const supabase = makeSupabase({ calls })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const result = await rejectAssessmentAction({
      assessmentId: 'a-1',
      sessionId: 'session-1',
      reason: '  ab ',
    })

    expect(result).toEqual({ ok: false, error: 'Motivo requerido' })
    expect(createAuthenticatedClientMock).not.toHaveBeenCalled()
    expect(calls.updatePayload).toBeUndefined()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('returns {ok:false} when the user is not authenticated', async () => {
    const calls: Calls = {}
    const supabase = makeSupabase({ calls, reviewerId: null })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const result = await rejectAssessmentAction({
      assessmentId: 'a-1',
      sessionId: 'session-1',
      reason: 'Motivo válido',
    })

    expect(result).toEqual({ ok: false, error: 'No autenticado' })
    expect(calls.updatePayload).toBeUndefined()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('propagates supabase update errors and does not revalidate', async () => {
    const calls: Calls = {}
    const supabase = makeSupabase({
      calls,
      updateError: { message: 'constraint_fail' },
    })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const result = await rejectAssessmentAction({
      assessmentId: 'a-1',
      sessionId: 'session-1',
      reason: 'Motivo válido',
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.error).toContain('constraint_fail')
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})
