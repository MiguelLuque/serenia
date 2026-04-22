import { describe, it, expect, vi, beforeEach } from 'vitest'

const { createAuthenticatedClientMock, revalidatePathMock } = vi.hoisted(() => ({
  createAuthenticatedClientMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createAuthenticatedClient: createAuthenticatedClientMock,
}))

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}))

import { saveAssessmentAction } from '@/app/app/clinica/sesion/[sessionId]/actions'

const validSummary = {
  chief_complaint: 'Tristeza persistente',
  presenting_issues: ['ánimo bajo'],
  mood_affect: 'deprimido',
  cognitive_patterns: ['rumiación'],
  risk_assessment: {
    suicidality: 'none' as const,
    self_harm: 'none' as const,
    notes: '',
  },
  questionnaires: [],
  areas_for_exploration: ['antecedentes'],
  preliminary_impression: 'Sintomatología consistente con ánimo bajo leve.',
  recommended_actions_for_clinician: ['seguimiento en 1 semana'],
  patient_facing_summary: 'Gracias por compartir esto hoy.',
  proposed_tasks: [
    { descripcion: 'Practicar respiración diafragmática', nota: 'Al menos 5 minutos al día' },
    { descripcion: 'Registro de pensamientos automáticos', nota: undefined },
  ],
}

type Calls = {
  insertPayload?: unknown
  updatePayload?: unknown
  updateEqArgs?: unknown[]
}

function makeSupabase({
  reviewerId = 'reviewer-1',
  insertError = null as unknown as { message: string } | null,
  updateError = null as unknown as { message: string } | null,
  insertedId = 'new-assessment-id',
  calls,
}: {
  reviewerId?: string | null
  insertError?: { message: string } | null
  updateError?: { message: string } | null
  insertedId?: string
  calls: Calls
}) {
  const updateChain = {
    eq: vi.fn((...args: unknown[]) => {
      calls.updateEqArgs = args
      return Promise.resolve({ data: null, error: updateError })
    }),
  }

  const insertChain = {
    select: vi.fn(() => insertChain),
    single: vi.fn(() =>
      Promise.resolve({
        data: insertError ? null : { id: insertedId },
        error: insertError,
      }),
    ),
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
    from: vi.fn(() => ({
      insert: vi.fn((payload: unknown) => {
        calls.insertPayload = payload
        return insertChain
      }),
      update: vi.fn((payload: unknown) => {
        calls.updatePayload = payload
        return updateChain
      }),
    })),
  }
}

beforeEach(() => {
  createAuthenticatedClientMock.mockReset()
  revalidatePathMock.mockReset()
})

describe('saveAssessmentAction', () => {
  it('inserts a new clinician-authored assessment and supersedes the previous one', async () => {
    const calls: Calls = {}
    const supabase = makeSupabase({ calls, reviewerId: 'reviewer-42' })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const before = new Date().toISOString()
    const result = await saveAssessmentAction({
      assessmentId: 'prev-assessment',
      sessionId: 'session-1',
      userId: 'user-1',
      summary: validSummary,
    })
    const after = new Date().toISOString()

    expect(result).toEqual({ ok: true, assessmentId: 'new-assessment-id' })

    const insertPayload = calls.insertPayload as Record<string, unknown>
    expect(insertPayload).toMatchObject({
      user_id: 'user-1',
      session_id: 'session-1',
      assessment_type: 'closure',
      status: 'reviewed_modified',
      generated_by: 'clinician',
      supersedes_assessment_id: 'prev-assessment',
      reviewed_by: 'reviewer-42',
    })
    expect(insertPayload.summary_json).toEqual(validSummary)
    expect(typeof insertPayload.reviewed_at).toBe('string')
    expect((insertPayload.reviewed_at as string) >= before).toBe(true)
    expect((insertPayload.reviewed_at as string) <= after).toBe(true)

    expect(calls.updatePayload).toEqual({ status: 'superseded' })
    expect(calls.updateEqArgs).toEqual(['id', 'prev-assessment'])

    expect(revalidatePathMock).toHaveBeenCalledWith('/app')
    expect(revalidatePathMock).toHaveBeenCalledWith(
      '/app/clinica/sesion/session-1',
    )
  })

  it('returns {ok:false} on invalid input and does not touch the DB', async () => {
    const calls: Calls = {}
    const supabase = makeSupabase({ calls })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const result = await saveAssessmentAction({
      assessmentId: 'prev-assessment',
      sessionId: 'session-1',
      userId: 'user-1',
      summary: { chief_complaint: 'missing the rest' },
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.error).toBeTruthy()

    expect(createAuthenticatedClientMock).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
    expect(calls.insertPayload).toBeUndefined()
    expect(calls.updatePayload).toBeUndefined()
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('returns error when user is not authenticated', async () => {
    const calls: Calls = {}
    const supabase = makeSupabase({ calls, reviewerId: null })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const result = await saveAssessmentAction({
      assessmentId: 'prev-assessment',
      sessionId: 'session-1',
      userId: 'user-1',
      summary: validSummary,
    })

    expect(result).toEqual({ ok: false, error: 'No autenticado' })
    expect(calls.insertPayload).toBeUndefined()
    expect(calls.updatePayload).toBeUndefined()
  })

  it('returns error and does not revalidate when the update of the old row fails', async () => {
    const calls: Calls = {}
    const supabase = makeSupabase({
      calls,
      updateError: { message: 'rls_fail' },
    })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const result = await saveAssessmentAction({
      assessmentId: 'prev-assessment',
      sessionId: 'session-1',
      userId: 'user-1',
      summary: validSummary,
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.error).toContain('rls_fail')
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('accepts empty inherited_task_updates without regression', async () => {
    const calls: Calls = {}
    const supabase = makeSupabase({ calls, reviewerId: 'reviewer-1' })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const result = await saveAssessmentAction({
      assessmentId: 'prev-assessment',
      sessionId: 'session-1',
      userId: 'user-1',
      summary: validSummary,
      inherited_task_updates: [],
    })

    expect(result).toEqual({ ok: true, assessmentId: 'new-assessment-id' })
  })

  it('accepts valid inherited_task_updates and returns ok:true (updates dropped until T4)', async () => {
    const calls: Calls = {}
    const supabase = makeSupabase({ calls, reviewerId: 'reviewer-1' })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const result = await saveAssessmentAction({
      assessmentId: 'prev-assessment',
      sessionId: 'session-1',
      userId: 'user-1',
      summary: validSummary,
      inherited_task_updates: [
        {
          id: '123e4567-e89b-42d3-a456-426614174000',
          estado: 'cumplida',
          nota: 'Completada satisfactoriamente',
        },
      ],
    })

    expect(result).toEqual({ ok: true, assessmentId: 'new-assessment-id' })
  })

  it('returns {ok:false} when inherited_task_updates contains an invalid estado value', async () => {
    const calls: Calls = {}
    const supabase = makeSupabase({ calls })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const result = await saveAssessmentAction({
      assessmentId: 'prev-assessment',
      sessionId: 'session-1',
      userId: 'user-1',
      summary: validSummary,
      inherited_task_updates: [
        {
          id: '123e4567-e89b-42d3-a456-426614174000',
          estado: 'invalido' as never,
        },
      ],
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.error).toBeTruthy()
  })

  it('preserves proposed_tasks in the inserted summary_json', async () => {
    const calls: Calls = {}
    const supabase = makeSupabase({ calls, reviewerId: 'reviewer-1' })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    await saveAssessmentAction({
      assessmentId: 'prev-assessment',
      sessionId: 'session-1',
      userId: 'user-1',
      summary: validSummary,
    })

    const insertPayload = calls.insertPayload as Record<string, unknown>
    const summaryJson = insertPayload.summary_json as typeof validSummary
    expect(summaryJson.proposed_tasks).toEqual(validSummary.proposed_tasks)
  })
})
