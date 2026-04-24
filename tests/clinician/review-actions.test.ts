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

// ── Shared summary fixture ─────────────────────────────────────────────────

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
    { descripcion: 'Registro de pensamientos automáticos', nota: null },
  ],
}

// ── Mock helpers ────────────────────────────────────────────────────────────

type TableCalls = {
  selects: { eqArgs: unknown[][] }[]
  updates: { payload: unknown; eqArgs: unknown[][] }[]
  inserts: unknown[]
  deletes: { eqArgs: unknown[][]; isArgs: unknown[][] }[]
}

type AllCalls = {
  assessments: TableCalls
  patient_tasks: TableCalls
  // Tracks any tables touched by rejectAssessmentAction
  other: string[]
}

function makeTableCalls(): TableCalls {
  return { selects: [], updates: [], inserts: [], deletes: [] }
}

/**
 * Build a Supabase-shaped mock that covers the full T4 call graph for
 * markReviewedAction and the simple call graph for rejectAssessmentAction.
 */
function makeSupabase({
  reviewerId = 'reviewer-1',
  assessmentData = { user_id: 'user-1', summary_json: validSummary } as unknown,
  assessmentFetchError = null as { message: string } | null,
  updateError = null as { message: string } | null,
  patientTasksDeleteError = null as { message: string } | null,
  patientTasksInsertError = null as { message: string } | null,
  calls,
}: {
  reviewerId?: string | null
  assessmentData?: unknown
  assessmentFetchError?: { message: string } | null
  updateError?: { message: string } | null
  patientTasksDeleteError?: { message: string } | null
  patientTasksInsertError?: { message: string } | null
  calls: AllCalls
}) {
  function makeAssessmentsTable() {
    // select → eq → single chain
    const selectChain = {
      _eqArgs: [] as unknown[][],
      eq: function (...args: unknown[]) {
        this._eqArgs.push(args)
        return this
      },
      single: function () {
        calls.assessments.selects.push({ eqArgs: [...this._eqArgs] })
        return Promise.resolve({
          data: assessmentFetchError ? null : assessmentData,
          error: assessmentFetchError,
        })
      },
    }

    // update → eq chain (resolves on .eq())
    function makeUpdateChain() {
      const eqArgs: unknown[][] = []
      const entry = { payload: undefined as unknown, eqArgs }
      const chain = {
        eq: vi.fn((...args: unknown[]) => {
          eqArgs.push(args)
          return Promise.resolve({ data: null, error: updateError })
        }),
      }
      return { chain, entry }
    }

    return {
      select: vi.fn(() => selectChain),
      update: vi.fn((payload: unknown) => {
        const { chain, entry } = makeUpdateChain()
        entry.payload = payload
        calls.assessments.updates.push(entry)
        return chain
      }),
    }
  }

  function makePatientTasksTable() {
    return {
      insert: vi.fn((payload: unknown) => {
        calls.patient_tasks.inserts.push(payload)
        return Promise.resolve({ data: null, error: patientTasksInsertError })
      }),
      delete: vi.fn(() => {
        const chain = {
          _eqArgs: [] as unknown[][],
          _isArgs: [] as unknown[][],
          eq: function (...args: unknown[]) {
            this._eqArgs.push(args)
            return this
          },
          is: function (...args: unknown[]) {
            this._isArgs.push(args)
            calls.patient_tasks.deletes.push({
              eqArgs: [...this._eqArgs],
              isArgs: [...this._isArgs],
            })
            return Promise.resolve({ data: null, error: patientTasksDeleteError })
          },
        }
        return chain
      }),
    }
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
      if (table === 'assessments') return makeAssessmentsTable()
      if (table === 'patient_tasks') return makePatientTasksTable()
      // rejectAssessmentAction only touches 'assessments' — any other table is unexpected
      calls.other.push(table)
      return makeAssessmentsTable()
    }),
  }
}

function makeAllCalls(): AllCalls {
  return {
    assessments: makeTableCalls(),
    patient_tasks: makeTableCalls(),
    other: [],
  }
}

beforeEach(() => {
  createAuthenticatedClientMock.mockReset()
  revalidatePathMock.mockReset()
})

// ── markReviewedAction ─────────────────────────────────────────────────────

describe('markReviewedAction', () => {
  it('updates the assessment in place with reviewer + timestamp and revalidates', async () => {
    const calls = makeAllCalls()
    const supabase = makeSupabase({ calls, reviewerId: 'reviewer-42' })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const before = new Date().toISOString()
    const result = await markReviewedAction({
      assessmentId: 'a-1',
      sessionId: 'session-1',
    })
    const after = new Date().toISOString()

    expect(result).toEqual({ ok: true })

    const updateEntry = calls.assessments.updates[0]!
    const payload = updateEntry.payload as Record<string, unknown>
    expect(payload.status).toBe('reviewed_confirmed')
    expect(payload.reviewed_by).toBe('reviewer-42')
    expect(typeof payload.reviewed_at).toBe('string')
    expect((payload.reviewed_at as string) >= before).toBe(true)
    expect((payload.reviewed_at as string) <= after).toBe(true)
    expect(payload.rejection_reason).toBeUndefined()
    expect(payload.supersedes_assessment_id).toBeUndefined()

    expect(updateEntry.eqArgs[0]).toEqual(['id', 'a-1'])

    expect(revalidatePathMock).toHaveBeenCalledWith('/app')
    expect(revalidatePathMock).toHaveBeenCalledWith(
      '/app/clinica/sesion/session-1',
    )
  })

  it('returns {ok:false} when the user is not authenticated', async () => {
    const calls = makeAllCalls()
    const supabase = makeSupabase({ calls, reviewerId: null })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const result = await markReviewedAction({
      assessmentId: 'a-1',
      sessionId: 'session-1',
    })

    expect(result).toEqual({ ok: false, error: 'No autenticado' })
    expect(calls.assessments.updates).toHaveLength(0)
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('propagates the supabase error message and does not revalidate', async () => {
    const calls = makeAllCalls()
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

  // ── T4 tests ─────────────────────────────────────────────────────────────

  it('T4: inserts 2 patient_tasks rows using the existing assessmentId when summary has 2 proposed_tasks', async () => {
    const calls = makeAllCalls()
    const supabase = makeSupabase({ calls, reviewerId: 'reviewer-42' })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const result = await markReviewedAction({
      assessmentId: 'a-1',
      sessionId: 'session-1',
    })

    expect(result).toEqual({ ok: true })

    // cleanup delete was issued
    expect(calls.patient_tasks.deletes).toHaveLength(1)
    const deleteCall = calls.patient_tasks.deletes[0]!
    expect(deleteCall.eqArgs[0]).toEqual(['acordada_en_session_id', 'session-1'])
    expect(deleteCall.isArgs[0]).toEqual(['closed_at', null])

    // rows inserted using the EXISTING assessmentId (no new row created)
    expect(calls.patient_tasks.inserts).toHaveLength(1)
    const inserted = calls.patient_tasks.inserts[0] as unknown[]
    expect(inserted).toHaveLength(2)
    expect(inserted[0]).toMatchObject({
      user_id: 'user-1',
      acordada_en_session_id: 'session-1',
      acordada_en_assessment_id: 'a-1',
      descripcion: 'Practicar respiración diafragmática',
      nota: 'Al menos 5 minutos al día',
      estado: 'pendiente',
    })
    expect(inserted[1]).toMatchObject({
      acordada_en_assessment_id: 'a-1',
      descripcion: 'Registro de pensamientos automáticos',
      nota: null,
      estado: 'pendiente',
    })
  })

  it('T4: returns {ok:false} when summary_json fails AssessmentSchema parse', async () => {
    const calls = makeAllCalls()
    const supabase = makeSupabase({
      calls,
      assessmentData: { user_id: 'user-1', summary_json: { broken: true } },
    })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const result = await markReviewedAction({
      assessmentId: 'a-1',
      sessionId: 'session-1',
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.error).toBeTruthy()
    // No patient_tasks calls should have been made
    expect(calls.patient_tasks.inserts).toHaveLength(0)
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })
})

// ── rejectAssessmentAction ─────────────────────────────────────────────────

describe('rejectAssessmentAction', () => {
  it('updates the row to rejected with trimmed reason and revalidates', async () => {
    const calls = makeAllCalls()
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

    const updateEntry = calls.assessments.updates[0]!
    const payload = updateEntry.payload as Record<string, unknown>
    expect(payload.status).toBe('rejected')
    expect(payload.reviewed_by).toBe('reviewer-7')
    expect(payload.rejection_reason).toBe('No refleja la transcripción.')
    expect(typeof payload.reviewed_at).toBe('string')
    expect((payload.reviewed_at as string) >= before).toBe(true)
    expect((payload.reviewed_at as string) <= after).toBe(true)

    expect(updateEntry.eqArgs[0]).toEqual(['id', 'a-1'])

    expect(revalidatePathMock).toHaveBeenCalledWith('/app')
    expect(revalidatePathMock).toHaveBeenCalledWith(
      '/app/clinica/sesion/session-1',
    )
  })

  it('returns {ok:false} when reason is blank (min 3 chars after trim) and does not touch the DB', async () => {
    const calls = makeAllCalls()
    const supabase = makeSupabase({ calls })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const result = await rejectAssessmentAction({
      assessmentId: 'a-1',
      sessionId: 'session-1',
      reason: '  ab ',
    })

    expect(result).toEqual({ ok: false, error: 'Motivo requerido' })
    expect(createAuthenticatedClientMock).not.toHaveBeenCalled()
    expect(calls.assessments.updates).toHaveLength(0)
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('returns {ok:false} when the user is not authenticated', async () => {
    const calls = makeAllCalls()
    const supabase = makeSupabase({ calls, reviewerId: null })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const result = await rejectAssessmentAction({
      assessmentId: 'a-1',
      sessionId: 'session-1',
      reason: 'Motivo válido',
    })

    expect(result).toEqual({ ok: false, error: 'No autenticado' })
    expect(calls.assessments.updates).toHaveLength(0)
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('propagates supabase update errors and does not revalidate', async () => {
    const calls = makeAllCalls()
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

  it('T4: rejectAssessmentAction makes zero calls to patient_tasks', async () => {
    const calls = makeAllCalls()
    const supabase = makeSupabase({ calls, reviewerId: 'reviewer-1' })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const result = await rejectAssessmentAction({
      assessmentId: 'a-1',
      sessionId: 'session-1',
      reason: 'Motivo válido',
    })

    expect(result).toEqual({ ok: true })
    expect(calls.patient_tasks.inserts).toHaveLength(0)
    expect(calls.patient_tasks.updates).toHaveLength(0)
    expect(calls.patient_tasks.deletes).toHaveLength(0)
  })
})
