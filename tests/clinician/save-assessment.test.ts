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

const validSummaryNoTasks = {
  ...validSummary,
  proposed_tasks: [],
}

// Tracks all calls made to each table, separated by operation type.
type TableCalls = {
  inserts: unknown[]
  updates: { payload: unknown; eqArgs: unknown[][] }[]
  deletes: { eqArgs: unknown[][]; isArgs: unknown[][] }[]
}

type AllCalls = {
  assessments: TableCalls
  patient_tasks: TableCalls
}

function makeTableCalls(): TableCalls {
  return { inserts: [], updates: [], deletes: [] }
}

function makeSupabase({
  reviewerId = 'reviewer-1',
  assessmentsInsertError = null as { message: string } | null,
  assessmentsUpdateError = null as { message: string } | null,
  patientTasksDeleteError = null as { message: string } | null,
  patientTasksUpdateError = null as { message: string } | null,
  patientTasksInsertError = null as { message: string } | null,
  insertedId = 'new-assessment-id',
  calls,
}: {
  reviewerId?: string | null
  assessmentsInsertError?: { message: string } | null
  assessmentsUpdateError?: { message: string } | null
  patientTasksDeleteError?: { message: string } | null
  patientTasksUpdateError?: { message: string } | null
  patientTasksInsertError?: { message: string } | null
  insertedId?: string
  calls: AllCalls
}) {
  function makeAssessmentsTable() {
    const insertChain = {
      select: vi.fn(() => insertChain),
      single: vi.fn(() =>
        Promise.resolve({
          data: assessmentsInsertError ? null : { id: insertedId },
          error: assessmentsInsertError,
        }),
      ),
    }

    return {
      insert: vi.fn((payload: unknown) => {
        calls.assessments.inserts.push(payload)
        return insertChain
      }),
      update: vi.fn((payload: unknown) => {
        const eqArgs: unknown[][] = []
        const updateEntry = { payload, eqArgs }
        calls.assessments.updates.push(updateEntry)
        const chain = {
          eq: vi.fn((...args: unknown[]) => {
            eqArgs.push(args)
            return Promise.resolve({ data: null, error: assessmentsUpdateError })
          }),
        }
        return chain
      }),
    }
  }

  function makePatientTasksTable() {
    const deleteChain = {
      eqArgs: [] as unknown[][],
      isArgs: [] as unknown[][],
      eq: function (...args: unknown[]) {
        this.eqArgs.push(args)
        return this
      },
      is: function (...args: unknown[]) {
        this.isArgs.push(args)
        // Return the settled promise — store refs before returning
        const eqCapture = this.eqArgs
        const isCapture = this.isArgs
        calls.patient_tasks.deletes.push({ eqArgs: eqCapture, isArgs: isCapture })
        return Promise.resolve({ data: null, error: patientTasksDeleteError })
      },
    }

    return {
      insert: vi.fn((payload: unknown) => {
        calls.patient_tasks.inserts.push(payload)
        return Promise.resolve({ data: null, error: patientTasksInsertError })
      }),
      update: vi.fn((payload: unknown) => {
        const eqArgs: unknown[][] = []
        const updateEntry = { payload, eqArgs }
        calls.patient_tasks.updates.push(updateEntry)
        const chain = {
          eq: vi.fn((...args: unknown[]) => {
            eqArgs.push(args)
            // Second eq call (user_id) is the terminal one that resolves
            if (eqArgs.length >= 2) {
              return Promise.resolve({ data: null, error: patientTasksUpdateError })
            }
            return chain
          }),
        }
        return chain
      }),
      delete: vi.fn(() => {
        // Each delete() call gets a fresh chain instance
        const chain = {
          _eqArgs: [] as unknown[][],
          _isArgs: [] as unknown[][],
          eq: function (...args: unknown[]) {
            this._eqArgs.push(args)
            return this
          },
          is: function (...args: unknown[]) {
            this._isArgs.push(args)
            const eqCapture = [...this._eqArgs]
            const isCapture = [...this._isArgs]
            calls.patient_tasks.deletes.push({ eqArgs: eqCapture, isArgs: isCapture })
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
      throw new Error(`Unexpected table: ${table}`)
    }),
  }
}

function makeAllCalls(): AllCalls {
  return {
    assessments: makeTableCalls(),
    patient_tasks: makeTableCalls(),
  }
}

beforeEach(() => {
  createAuthenticatedClientMock.mockReset()
  revalidatePathMock.mockReset()
})

describe('saveAssessmentAction', () => {
  it('inserts a new clinician-authored assessment and supersedes the previous one', async () => {
    const calls = makeAllCalls()
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

    const insertPayload = calls.assessments.inserts[0] as Record<string, unknown>
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

    const updateEntry = calls.assessments.updates[0]
    expect(updateEntry?.payload).toEqual({ status: 'superseded' })
    expect(updateEntry?.eqArgs[0]).toEqual(['id', 'prev-assessment'])

    expect(revalidatePathMock).toHaveBeenCalledWith('/app')
    expect(revalidatePathMock).toHaveBeenCalledWith(
      '/app/clinica/sesion/session-1',
    )
  })

  it('returns {ok:false} on invalid input and does not touch the DB', async () => {
    const calls = makeAllCalls()
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
    expect(calls.assessments.inserts).toHaveLength(0)
    expect(calls.assessments.updates).toHaveLength(0)
    expect(calls.patient_tasks.inserts).toHaveLength(0)
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('returns error when user is not authenticated', async () => {
    const calls = makeAllCalls()
    const supabase = makeSupabase({ calls, reviewerId: null })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const result = await saveAssessmentAction({
      assessmentId: 'prev-assessment',
      sessionId: 'session-1',
      userId: 'user-1',
      summary: validSummary,
    })

    expect(result).toEqual({ ok: false, error: 'No autenticado' })
    expect(calls.assessments.inserts).toHaveLength(0)
    expect(calls.patient_tasks.inserts).toHaveLength(0)
  })

  it('returns error and does not revalidate when the update of the old row fails', async () => {
    const calls = makeAllCalls()
    const supabase = makeSupabase({
      calls,
      assessmentsUpdateError: { message: 'rls_fail' },
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
    const calls = makeAllCalls()
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

  it('returns {ok:false} when inherited_task_updates contains an invalid estado value', async () => {
    const calls = makeAllCalls()
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
    const calls = makeAllCalls()
    const supabase = makeSupabase({ calls, reviewerId: 'reviewer-1' })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    await saveAssessmentAction({
      assessmentId: 'prev-assessment',
      sessionId: 'session-1',
      userId: 'user-1',
      summary: validSummary,
    })

    const insertPayload = calls.assessments.inserts[0] as Record<string, unknown>
    const summaryJson = insertPayload.summary_json as typeof validSummary
    expect(summaryJson.proposed_tasks).toEqual(validSummary.proposed_tasks)
  })

  // ── T4 tests ──────────────────────────────────────────────────────────────

  it('T4: deletes open patient_tasks for the session, applies inherited_task_updates, and inserts proposed_tasks', async () => {
    const calls = makeAllCalls()
    const supabase = makeSupabase({ calls, reviewerId: 'reviewer-1' })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const taskId = '123e4567-e89b-42d3-a456-426614174000'
    const taskId2 = '223e4567-e89b-42d3-a456-426614174001'

    const before = new Date().toISOString()
    const result = await saveAssessmentAction({
      assessmentId: 'prev-assessment',
      sessionId: 'session-1',
      userId: 'user-1',
      summary: validSummary,
      inherited_task_updates: [
        { id: taskId, estado: 'cumplida', nota: 'Completada satisfactoriamente' },
        { id: taskId2, estado: 'parcial', nota: '' },
      ],
    })
    const after = new Date().toISOString()

    expect(result).toEqual({ ok: true, assessmentId: 'new-assessment-id' })

    // 1. cleanup delete was issued
    expect(calls.patient_tasks.deletes).toHaveLength(1)
    const deleteCall = calls.patient_tasks.deletes[0]!
    expect(deleteCall.eqArgs[0]).toEqual(['acordada_en_session_id', 'session-1'])
    expect(deleteCall.isArgs[0]).toEqual(['closed_at', null])

    // 2. inherited_task_updates applied (one update per task)
    expect(calls.patient_tasks.updates).toHaveLength(2)

    // terminal estado 'cumplida' → closed_at and closed_by_assessment_id set
    const cumplidaUpdate = calls.patient_tasks.updates.find(
      (u) => (u.payload as Record<string, unknown>).estado === 'cumplida',
    )!
    expect(cumplidaUpdate).toBeDefined()
    const cumplidaPayload = cumplidaUpdate.payload as Record<string, unknown>
    expect(cumplidaPayload.nota).toBe('Completada satisfactoriamente')
    expect(typeof cumplidaPayload.closed_at).toBe('string')
    expect((cumplidaPayload.closed_at as string) >= before).toBe(true)
    expect((cumplidaPayload.closed_at as string) <= after).toBe(true)
    expect(cumplidaPayload.closed_by_assessment_id).toBe('new-assessment-id')

    // non-terminal estado 'parcial' → closed_at null, nota empty string treated as null
    const parcialUpdate = calls.patient_tasks.updates.find(
      (u) => (u.payload as Record<string, unknown>).estado === 'parcial',
    )!
    expect(parcialUpdate).toBeDefined()
    const parcialPayload = parcialUpdate.payload as Record<string, unknown>
    expect(parcialPayload.closed_at).toBeNull()
    expect(parcialPayload.closed_by_assessment_id).toBeNull()
    expect(parcialPayload.nota).toBeNull() // '' → null

    // 3. proposed_tasks inserted as a batch
    expect(calls.patient_tasks.inserts).toHaveLength(1)
    const insertedTasks = calls.patient_tasks.inserts[0] as unknown[]
    expect(insertedTasks).toHaveLength(2)
    expect(insertedTasks[0]).toMatchObject({
      user_id: 'user-1',
      acordada_en_session_id: 'session-1',
      acordada_en_assessment_id: 'new-assessment-id',
      descripcion: 'Practicar respiración diafragmática',
      nota: 'Al menos 5 minutos al día',
      estado: 'pendiente',
    })
    expect(insertedTasks[1]).toMatchObject({
      descripcion: 'Registro de pensamientos automáticos',
      nota: null,
      estado: 'pendiente',
    })
  })

  it('T4: 0 proposed_tasks + 0 inherited_task_updates → cleanup delete runs but no inserts or updates on patient_tasks', async () => {
    const calls = makeAllCalls()
    const supabase = makeSupabase({ calls, reviewerId: 'reviewer-1' })
    createAuthenticatedClientMock.mockResolvedValue(supabase)

    const result = await saveAssessmentAction({
      assessmentId: 'prev-assessment',
      sessionId: 'session-1',
      userId: 'user-1',
      summary: validSummaryNoTasks,
      inherited_task_updates: [],
    })

    expect(result).toEqual({ ok: true, assessmentId: 'new-assessment-id' })
    // cleanup still runs
    expect(calls.patient_tasks.deletes).toHaveLength(1)
    // no updates or inserts
    expect(calls.patient_tasks.updates).toHaveLength(0)
    expect(calls.patient_tasks.inserts).toHaveLength(0)
  })
})
