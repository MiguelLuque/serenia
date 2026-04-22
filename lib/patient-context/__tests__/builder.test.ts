import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildPatientContext } from '@/lib/patient-context/builder'

const NOW = new Date('2026-04-22T12:00:00Z')

// ── Fixtures ────────────────────────────────────────────────────────────────

const baseSummary = {
  chief_complaint: 'Tristeza persistente',
  presenting_issues: ['ánimo bajo'],
  mood_affect: 'deprimido',
  cognitive_patterns: ['rumiación'],
  risk_assessment: { suicidality: 'none' as const, self_harm: 'none' as const, notes: '' },
  questionnaires: [],
  areas_for_exploration: ['antecedentes'],
  preliminary_impression: 'Impresión preliminar.',
  recommended_actions_for_clinician: ['seguimiento'],
  patient_facing_summary: 'Gracias.',
  proposed_tasks: [],
}

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
}

// ── Supabase mock builder ────────────────────────────────────────────────────
// Each table handler is a map from table name to a function that returns the
// mock data/error for that query. The chain supports: .select, .in, .eq,
// .order, .limit, .maybeSingle (returns Promise), and .head count queries.

type TableResponse = { data: unknown; error: unknown; count?: number | null }
type TableFactory = (table: string) => TableResponse

function makeChain(response: TableResponse) {
  const chain: Record<string, unknown> = {}
  const terminal = () => Promise.resolve(response)
  const self = () => chain

  chain.select = vi.fn(self)
  chain.in = vi.fn(self)
  chain.eq = vi.fn(self)
  chain.order = vi.fn(self)
  chain.limit = vi.fn(self)
  chain.maybeSingle = vi.fn(terminal)
  // For count queries (head: true), the chain itself resolves when awaited
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(response).then(resolve, reject)

  return chain
}

function makeSupabase(tableFactory: TableFactory) {
  return {
    from: vi.fn((table: string) => makeChain(tableFactory(table))),
  }
}

// ── Convenience response builders ────────────────────────────────────────────

function ok(data: unknown, count?: number | null): TableResponse {
  return { data, error: null, count: count ?? null }
}

function noRows(): TableResponse {
  return { data: null, error: null, count: null }
}

// Default table factory: no data anywhere (fresh patient)
function emptyFactory(table: string): TableResponse {
  if (table === 'clinical_sessions') return { data: null, error: null, count: 0 }
  return noRows()
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('buildPatientContext', () => {
  // 1. No history → tier=none, isFirstSession=true
  it('case 1: no history → tier=none, isFirstSession=true, validated=null, tierBDraft=null, sessionNumber=1', async () => {
    const supabase = makeSupabase((table) => {
      if (table === 'clinical_sessions') return { data: null, error: null, count: 0 }
      return noRows()
    })

    const ctx = await buildPatientContext(supabase as never, 'user-1', NOW)

    expect(ctx.tier).toBe('none')
    expect(ctx.isFirstSession).toBe(true)
    expect(ctx.validated).toBeNull()
    expect(ctx.tierBDraft).toBeNull()
    expect(ctx.sessionNumber).toBe(1)
    expect(ctx.recentQuestionnaires).toHaveLength(0)
    expect(ctx.openRiskEvents).toHaveLength(0)
    expect(ctx.previousSession).toBeNull()
    expect(ctx.pendingTasks).toHaveLength(0)
  })

  // 2. Has draft_ai but no validated → tier=tierB, isFirstSession=false (prior closed session)
  it('case 2: draft_ai + prior closed session → tier=tierB, isFirstSession=false', async () => {
    const sessionClosedAt = daysAgo(7)
    const draftAssessmentRow = {
      summary_json: baseSummary,
      clinical_sessions: { closed_at: sessionClosedAt, status: 'closed' },
    }

    const supabase = makeSupabase((table) => {
      if (table === 'assessments') return ok(draftAssessmentRow)
      if (table === 'clinical_sessions') {
        // count query — 1 closed session
        return { data: null, error: null, count: 1 }
      }
      return noRows()
    })

    // assessments is queried twice: validated (Q1) returns null, draft (Q2) returns row
    let assessmentsCallCount = 0
    const customFrom = vi.fn((table: string) => {
      if (table === 'assessments') {
        assessmentsCallCount++
        if (assessmentsCallCount === 1) {
          // Q1: validated → nothing
          return makeChain(noRows())
        }
        // Q2: draft → row
        return makeChain(ok(draftAssessmentRow))
      }
      if (table === 'clinical_sessions') {
        return makeChain({ data: null, error: null, count: 1 })
      }
      return makeChain(noRows())
    })

    const supabase2 = { from: customFrom }
    const ctx = await buildPatientContext(supabase2 as never, 'user-1', NOW)

    expect(ctx.tier).toBe('tierB')
    expect(ctx.isFirstSession).toBe(false)
    expect(ctx.tierBDraft).not.toBeNull()
    expect(ctx.tierBDraft!.closedAt).toBe(sessionClosedAt)
    expect(ctx.tierBDraft!.summary.chief_complaint).toBe(baseSummary.chief_complaint)
    expect(ctx.validated).toBeNull()
    expect(ctx.sessionNumber).toBe(2)
  })

  // 3. Has reviewed_modified from 15 days ago → tier=tierA, ageInDays=15
  it('case 3: reviewed_modified 15 days ago → tier=tierA, ageInDays=15', async () => {
    const reviewedAt = daysAgo(15)
    const assessmentRow = { id: 'a-1', reviewed_at: reviewedAt, summary_json: baseSummary }

    const supabase = makeSupabase((table) => {
      if (table === 'assessments') return ok(assessmentRow)
      if (table === 'clinical_sessions') return { data: null, error: null, count: 2 }
      return noRows()
    })

    const ctx = await buildPatientContext(supabase as never, 'user-1', NOW)

    expect(ctx.tier).toBe('tierA')
    expect(ctx.validated).not.toBeNull()
    expect(ctx.validated!.ageInDays).toBe(15)
    expect(ctx.validated!.reviewedAt).toBe(reviewedAt)
    expect(ctx.tierBDraft).toBeNull()
    expect(ctx.isFirstSession).toBe(false)
  })

  // 4. Has reviewed_confirmed from 120 days ago → tier=historic, ageInDays=120, tierBDraft=null
  it('case 4: reviewed_confirmed 120 days ago → tier=historic, ageInDays=120, tierBDraft=null', async () => {
    const reviewedAt = daysAgo(120)
    const assessmentRow = { id: 'a-old', reviewed_at: reviewedAt, summary_json: baseSummary }

    const supabase = makeSupabase((table) => {
      if (table === 'assessments') return ok(assessmentRow)
      if (table === 'clinical_sessions') return { data: null, error: null, count: 3 }
      return noRows()
    })

    const ctx = await buildPatientContext(supabase as never, 'user-1', NOW)

    expect(ctx.tier).toBe('historic')
    expect(ctx.validated!.ageInDays).toBe(120)
    expect(ctx.tierBDraft).toBeNull()
  })

  // 5. Has reviewed_confirmed (15 days) + draft_ai (1 day) → tier=tierA, tierBDraft=null
  it('case 5: tierA + draft → tier=tierA, tierBDraft=null (draft ignored)', async () => {
    const reviewedAt = daysAgo(15)
    const validatedRow = { id: 'a-v', reviewed_at: reviewedAt, summary_json: baseSummary }
    const draftRow = {
      summary_json: baseSummary,
      clinical_sessions: { closed_at: daysAgo(1), status: 'closed' },
    }

    let assessmentsCallCount = 0
    const customFrom = vi.fn((table: string) => {
      if (table === 'assessments') {
        assessmentsCallCount++
        if (assessmentsCallCount === 1) return makeChain(ok(validatedRow))
        return makeChain(ok(draftRow))
      }
      if (table === 'clinical_sessions') {
        return makeChain({ data: null, error: null, count: 2 })
      }
      return makeChain(noRows())
    })

    const supabase = { from: customFrom }
    const ctx = await buildPatientContext(supabase as never, 'user-1', NOW)

    expect(ctx.tier).toBe('tierA')
    expect(ctx.tierBDraft).toBeNull()
    expect(ctx.validated).not.toBeNull()
  })

  // 6. 2 PHQ-9 scores → deltaVsPrevious correctly signed
  it('case 6: PHQ-9 score 15 then 9 → delta=-6; second pair 9→15 → delta=+6', async () => {
    const makeQRow = (score: number, offset: number) => ({
      total_score: score,
      severity_band: 'moderate',
      created_at: daysAgo(offset),
      questionnaire_instances: {
        user_id: 'user-1',
        questionnaire_definitions: { code: 'PHQ9' },
      },
    })

    // Latest=9 (1 day ago), previous=15 (2 days ago) → delta = 9-15 = -6
    const qRows = [makeQRow(9, 1), makeQRow(15, 2)]

    const supabase = makeSupabase((table) => {
      if (table === 'questionnaire_results') return ok(qRows)
      if (table === 'clinical_sessions') return { data: null, error: null, count: 0 }
      return noRows()
    })

    const ctx = await buildPatientContext(supabase as never, 'user-1', NOW)

    expect(ctx.recentQuestionnaires).toHaveLength(1)
    const phq9 = ctx.recentQuestionnaires[0]!
    expect(phq9.code).toBe('PHQ9')
    expect(phq9.score).toBe(9)
    expect(phq9.deltaVsPrevious).toBe(-6)

    // Reverse: latest=15, previous=9 → delta=+6
    const qRows2 = [makeQRow(15, 1), makeQRow(9, 2)]
    const supabase2 = makeSupabase((table) => {
      if (table === 'questionnaire_results') return ok(qRows2)
      if (table === 'clinical_sessions') return { data: null, error: null, count: 0 }
      return noRows()
    })
    const ctx2 = await buildPatientContext(supabase2 as never, 'user-1', NOW)
    expect(ctx2.recentQuestionnaires[0]!.deltaVsPrevious).toBe(6)
  })

  // 7. 1 open risk_event → appears in openRiskEvents and feeds riskState
  it('case 7: 1 open critical risk event → openRiskEvents populated, riskState=acute', async () => {
    const riskRow = {
      risk_type: 'suicidal_ideation',
      severity: 'critical',
      created_at: daysAgo(1),
    }

    const supabase = makeSupabase((table) => {
      if (table === 'risk_events') return ok([riskRow])
      if (table === 'clinical_sessions') return { data: null, error: null, count: 1 }
      return noRows()
    })

    const ctx = await buildPatientContext(supabase as never, 'user-1', NOW)

    expect(ctx.openRiskEvents).toHaveLength(1)
    expect(ctx.openRiskEvents[0]).toMatchObject({
      severity: 'critical',
      riskType: 'suicidal_ideation',
    })
    expect(ctx.riskState).toBe('acute')
  })

  // 8. Crisis-closure previous session + tier-A suicidality=none after it → riskState=none
  it('case 8: crisis-closure session + tier-A suicidality=none (reviewed after crisis) → riskState=none', async () => {
    const crisisClosedAt = daysAgo(10)
    const reviewedAt = daysAgo(5) // reviewed AFTER the crisis session closed

    const assessmentRow = {
      id: 'a-recovery',
      reviewed_at: reviewedAt,
      summary_json: {
        ...baseSummary,
        risk_assessment: { suicidality: 'none' as const, self_harm: 'none' as const, notes: '' },
      },
    }

    const supabase = makeSupabase((table) => {
      if (table === 'assessments') return ok(assessmentRow)
      if (table === 'clinical_sessions') {
        return {
          data: { closed_at: crisisClosedAt, closure_reason: 'crisis_detected' },
          error: null,
          count: 2,
        }
      }
      return noRows()
    })

    const ctx = await buildPatientContext(supabase as never, 'user-1', NOW)

    expect(ctx.tier).toBe('tierA')
    expect(ctx.riskState).toBe('none')
    expect(ctx.previousSession).not.toBeNull()
    expect(ctx.previousSession!.closureReason).toBe('crisis_detected')
  })

  // 9. Malformed summary_json on validated → logs error, falls back to tier-B logic
  it('case 9: malformed summary_json on validated → logs error, falls back to tier-B', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const closedAt = daysAgo(3)
    const draftRow = {
      summary_json: baseSummary,
      clinical_sessions: { closed_at: closedAt, status: 'closed' },
    }

    let assessmentsCallCount = 0
    const customFrom = vi.fn((table: string) => {
      if (table === 'assessments') {
        assessmentsCallCount++
        if (assessmentsCallCount === 1) {
          // Q1: validated row exists but summary_json is malformed
          return makeChain(
            ok({
              id: 'bad-assessment',
              reviewed_at: daysAgo(10),
              summary_json: { broken: true },
            }),
          )
        }
        // Q2: tier-B draft
        return makeChain(ok(draftRow))
      }
      if (table === 'clinical_sessions') {
        return makeChain({ data: null, error: null, count: 1 })
      }
      return makeChain(noRows())
    })

    const supabase = { from: customFrom }
    const ctx = await buildPatientContext(supabase as never, 'user-1', NOW)

    expect(consoleSpy).toHaveBeenCalled()
    const firstCall = consoleSpy.mock.calls[0]!
    expect(firstCall[0]).toContain('[buildPatientContext]')
    expect(firstCall[1]).toMatchObject({ assessmentId: 'bad-assessment' })

    // Falls back to tier-B because validated parse failed
    expect(ctx.tier).toBe('tierB')
    expect(ctx.validated).toBeNull()
    expect(ctx.tierBDraft).not.toBeNull()
    expect(ctx.tierBDraft!.closedAt).toBe(closedAt)

    consoleSpy.mockRestore()
  })

  // Extra: single questionnaire score → deltaVsPrevious=null
  it('single PHQ-9 score → deltaVsPrevious=null', async () => {
    const qRow = {
      total_score: 12,
      severity_band: 'moderate',
      created_at: daysAgo(1),
      questionnaire_instances: {
        user_id: 'user-1',
        questionnaire_definitions: { code: 'PHQ9' },
      },
    }

    const supabase = makeSupabase((table) => {
      if (table === 'questionnaire_results') return ok([qRow])
      if (table === 'clinical_sessions') return { data: null, error: null, count: 0 }
      return noRows()
    })

    const ctx = await buildPatientContext(supabase as never, 'user-1', NOW)

    expect(ctx.recentQuestionnaires[0]!.deltaVsPrevious).toBeNull()
  })

  // Extra: previousSession.daysAgo is computed correctly
  it('previousSession.daysAgo is floor of days since closure', async () => {
    const closedAt = daysAgo(7)

    const supabase = makeSupabase((table) => {
      if (table === 'clinical_sessions') {
        return {
          data: { closed_at: closedAt, closure_reason: null },
          error: null,
          count: 1,
        }
      }
      return noRows()
    })

    const ctx = await buildPatientContext(supabase as never, 'user-1', NOW)

    expect(ctx.previousSession).not.toBeNull()
    expect(ctx.previousSession!.daysAgo).toBe(7)
  })

  // I3.1: all 3 questionnaire codes present — prove grouping + emit-up-to-3
  it('recentQuestionnaires: PHQ9 + GAD7 + ASQ all present → 3 entries with correct deltas', async () => {
    const makeQRow = (code: 'PHQ9' | 'GAD7' | 'ASQ', score: number, offset: number) => ({
      total_score: score,
      severity_band: 'moderate',
      created_at: daysAgo(offset),
      questionnaire_instances: {
        user_id: 'user-1',
        questionnaire_definitions: { code },
      },
    })

    // DB-order: newest first. For each code, the first occurrence is latest.
    const qRows = [
      makeQRow('PHQ9', 10, 1), // latest PHQ9
      makeQRow('GAD7', 8, 2), // latest GAD7
      makeQRow('ASQ', 3, 3), // latest ASQ (only one → null delta)
      makeQRow('PHQ9', 14, 5), // previous PHQ9 → delta 10-14=-4
      makeQRow('GAD7', 5, 6), // previous GAD7 → delta 8-5=+3
    ]

    const supabase = makeSupabase((table) => {
      if (table === 'questionnaire_results') return ok(qRows)
      if (table === 'clinical_sessions') return { data: null, error: null, count: 0 }
      return noRows()
    })

    const ctx = await buildPatientContext(supabase as never, 'user-1', NOW)

    expect(ctx.recentQuestionnaires).toHaveLength(3)

    const byCode = Object.fromEntries(ctx.recentQuestionnaires.map((q) => [q.code, q]))
    expect(byCode.PHQ9).toMatchObject({ score: 10, deltaVsPrevious: -4 })
    expect(byCode.GAD7).toMatchObject({ score: 8, deltaVsPrevious: 3 })
    expect(byCode.ASQ).toMatchObject({ score: 3, deltaVsPrevious: null })
  })

  // I3.2: pendingTasks estado narrowing and acordadaEn = created_at
  it('pendingTasks: pendiente + parcial tasks are emitted; terminal estados excluded', async () => {
    const task1 = {
      id: 'task-1',
      descripcion: 'Practicar respiración',
      estado: 'pendiente' as const,
      created_at: daysAgo(2),
    }
    const task2 = {
      id: 'task-2',
      descripcion: 'Registro de pensamientos',
      estado: 'parcial' as const,
      created_at: daysAgo(5),
    }
    // Terminal rows: if the DB filter regressed and they leaked into the mock
    // result, the JS-level estado filter must still exclude them.
    const taskCumplida = {
      id: 'task-cumplida',
      descripcion: 'Cerrada — cumplida',
      estado: 'cumplida',
      created_at: daysAgo(3),
    }
    const taskNoRealizada = {
      id: 'task-no-realizada',
      descripcion: 'Cerrada — no realizada',
      estado: 'no_realizada',
      created_at: daysAgo(4),
    }
    const taskNoAbordada = {
      id: 'task-no-abordada',
      descripcion: 'Cerrada — no abordada',
      estado: 'no_abordada',
      created_at: daysAgo(6),
    }

    const supabase = makeSupabase((table) => {
      if (table === 'patient_tasks')
        return ok([task1, taskCumplida, task2, taskNoRealizada, taskNoAbordada])
      if (table === 'clinical_sessions') return { data: null, error: null, count: 0 }
      return noRows()
    })

    const ctx = await buildPatientContext(supabase as never, 'user-1', NOW)

    expect(ctx.pendingTasks).toHaveLength(2)
    const ids = ctx.pendingTasks.map((t) => t.id)
    expect(ids).toEqual(['task-1', 'task-2'])
    expect(ids).not.toContain('task-cumplida')
    expect(ids).not.toContain('task-no-realizada')
    expect(ids).not.toContain('task-no-abordada')

    expect(ctx.pendingTasks[0]).toEqual({
      id: 'task-1',
      descripcion: 'Practicar respiración',
      estado: 'pendiente',
      acordadaEn: task1.created_at,
    })
    expect(ctx.pendingTasks[1]).toEqual({
      id: 'task-2',
      descripcion: 'Registro de pensamientos',
      estado: 'parcial',
      acordadaEn: task2.created_at,
    })
  })

  // I3.3: patient.displayName + patient.age with birthday-tomorrow edge case
  it('patient profile: displayName + age computed from birth_date; birthday tomorrow → age = N-1', async () => {
    // NOW = 2026-04-22. Birthday tomorrow = 2026-04-23. Born 2000-04-23 → age=25 today (turning 26 tomorrow).
    const profile = { display_name: 'María García', birth_date: '2000-04-23' }

    const supabase = makeSupabase((table) => {
      if (table === 'user_profiles') return ok(profile)
      if (table === 'clinical_sessions') return { data: null, error: null, count: 0 }
      return noRows()
    })

    const ctx = await buildPatientContext(supabase as never, 'user-1', NOW)

    expect(ctx.patient.displayName).toBe('María García')
    expect(ctx.patient.age).toBe(25)

    // Sanity: same year, birthday already passed → age=26
    const profileAfter = { display_name: 'Pedro', birth_date: '2000-01-15' }
    const supabase2 = makeSupabase((table) => {
      if (table === 'user_profiles') return ok(profileAfter)
      if (table === 'clinical_sessions') return { data: null, error: null, count: 0 }
      return noRows()
    })
    const ctx2 = await buildPatientContext(supabase2 as never, 'user-1', NOW)
    expect(ctx2.patient.age).toBe(26)

    // Birthday TODAY (NOW = 2026-04-22, born 2000-04-22 → age=26 exactly).
    // Guards the `>=` in computeAge: if someone refactors to `>`, this regresses.
    const profileToday = { display_name: 'Hoy', birth_date: '2000-04-22' }
    const supabaseToday = makeSupabase((table) => {
      if (table === 'user_profiles') return ok(profileToday)
      if (table === 'clinical_sessions') return { data: null, error: null, count: 0 }
      return noRows()
    })
    const ctxToday = await buildPatientContext(supabaseToday as never, 'user-1', NOW)
    expect(ctxToday.patient.age).toBe(26)

    // Null birth_date → null age
    const profileNoDob = { display_name: 'Sin fecha', birth_date: null }
    const supabase3 = makeSupabase((table) => {
      if (table === 'user_profiles') return ok(profileNoDob)
      if (table === 'clinical_sessions') return { data: null, error: null, count: 0 }
      return noRows()
    })
    const ctx3 = await buildPatientContext(supabase3 as never, 'user-1', NOW)
    expect(ctx3.patient.displayName).toBe('Sin fecha')
    expect(ctx3.patient.age).toBeNull()
  })
})
