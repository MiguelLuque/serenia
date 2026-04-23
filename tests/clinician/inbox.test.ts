import { describe, it, expect, vi } from 'vitest'
import { sortInboxRows, getClinicianInbox, type InboxRow } from '@/lib/clinician/inbox'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

function makeRow(overrides: Partial<InboxRow>): InboxRow {
  return {
    sessionId: 's',
    userId: 'u',
    displayName: null,
    closedAt: null,
    closureReason: null,
    assessmentStatus: null,
    hasCrisis: false,
    topRisk: null,
    sessionNumber: 1,
    daysSincePrevious: null,
    phq9Trend: [],
    gad7Trend: [],
    openTasksCount: 0,
    riskState: 'none',
    ...overrides,
  }
}

describe('sortInboxRows', () => {
  it('places unreviewed (draft_ai) rows before reviewed, and sorts by closed_at desc within each group', () => {
    const draftOld = makeRow({
      sessionId: 'draft-old',
      assessmentStatus: 'draft_ai',
      closedAt: '2026-04-10T10:00:00.000Z',
    })
    const reviewedNew = makeRow({
      sessionId: 'reviewed-new',
      assessmentStatus: 'reviewed_confirmed',
      closedAt: '2026-04-22T10:00:00.000Z',
    })
    const draftNew = makeRow({
      sessionId: 'draft-new',
      assessmentStatus: 'draft_ai',
      closedAt: '2026-04-21T10:00:00.000Z',
    })

    const sorted = sortInboxRows([reviewedNew, draftOld, draftNew])

    expect(sorted.map((r) => r.sessionId)).toEqual([
      'draft-new',
      'draft-old',
      'reviewed-new',
    ])
  })

  it('treats rows without an assessment (null) as unreviewed', () => {
    const noAssessment = makeRow({
      sessionId: 'none',
      assessmentStatus: null,
      closedAt: '2026-04-01T10:00:00.000Z',
    })
    const reviewed = makeRow({
      sessionId: 'reviewed',
      assessmentStatus: 'reviewed_confirmed',
      closedAt: '2026-04-22T10:00:00.000Z',
    })

    const sorted = sortInboxRows([reviewed, noAssessment])

    expect(sorted.map((r) => r.sessionId)).toEqual(['none', 'reviewed'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getClinicianInbox — longitudinal per-row enrichments (T11)
// ─────────────────────────────────────────────────────────────────────────────

type InboxFixture = {
  // All closed sessions for the two users in chronological ascending order.
  // The inbox window is the two NEWEST by closed_at desc.
  sessions: Array<{
    id: string
    user_id: string
    closed_at: string
    closure_reason: string | null
    status: 'closed'
  }>
  assessments: Array<{
    id: string
    session_id: string | null
    user_id: string | null
    status: Database['public']['Enums']['assessment_status']
    assessment_type: 'closure'
    created_at: string
    reviewed_at: string | null
    summary_json: unknown
  }>
  riskEvents: Array<{
    id: string
    session_id: string | null
    user_id: string
    severity: Database['public']['Enums']['risk_severity']
    status: 'open' | 'closed'
    created_at: string
  }>
  profiles: Array<{ user_id: string; display_name: string | null }>
  patientTasks: Array<{ id: string; user_id: string; estado: string }>
  questionnaires: Array<{
    user_id: string
    code: 'PHQ9' | 'GAD7'
    total_score: number
    scored_at: string
  }>
}

/**
 * Minimal Supabase mock that implements only the call shapes used by
 * getClinicianInbox. Each from(table) returns a fresh chain-builder that
 * inspects filters and resolves with an array drawn from `fixture`.
 */
function makeSupabaseForInbox(fixture: InboxFixture) {
  function makeChain(tableName: string) {
    const state: {
      filters: Array<{ op: string; col: string; val: unknown }>
      selectArg: string | null
      order: { col: string; asc: boolean } | null
    } = { filters: [], selectArg: null, order: null }

    const resolver = () => {
      let data: unknown[] = []
      if (tableName === 'clinical_sessions') {
        data = fixture.sessions.filter((s) => {
          return state.filters.every((f) => {
            if (f.op === 'eq' && f.col === 'status') return s.status === f.val
            if (f.op === 'in' && f.col === 'user_id') {
              return (f.val as string[]).includes(s.user_id)
            }
            return true
          })
        })
      } else if (tableName === 'assessments') {
        data = fixture.assessments.filter((a) => {
          return state.filters.every((f) => {
            if (f.op === 'eq' && f.col === 'assessment_type')
              return a.assessment_type === f.val
            if (f.op === 'eq' && f.col === 'status') return a.status === f.val
            if (f.op === 'neq' && f.col === 'status') return a.status !== f.val
            if (f.op === 'in' && f.col === 'session_id') {
              return a.session_id !== null && (f.val as string[]).includes(a.session_id)
            }
            if (f.op === 'in' && f.col === 'status') {
              return (f.val as string[]).includes(a.status)
            }
            if (f.op === 'in' && f.col === 'user_id') {
              return a.user_id !== null && (f.val as string[]).includes(a.user_id)
            }
            return true
          })
        })
      } else if (tableName === 'risk_events') {
        data = fixture.riskEvents.filter((r) => {
          return state.filters.every((f) => {
            if (f.op === 'in' && f.col === 'user_id')
              return (f.val as string[]).includes(r.user_id)
            if (f.op === 'eq' && f.col === 'status') return r.status === f.val
            return true
          })
        })
      } else if (tableName === 'user_profiles') {
        data = fixture.profiles.filter((p) =>
          state.filters.every((f) =>
            f.op === 'in' && f.col === 'user_id'
              ? (f.val as string[]).includes(p.user_id)
              : true,
          ),
        )
      } else if (tableName === 'patient_tasks') {
        data = fixture.patientTasks.filter((t) =>
          state.filters.every((f) => {
            if (f.op === 'in' && f.col === 'user_id')
              return (f.val as string[]).includes(t.user_id)
            if (f.op === 'in' && f.col === 'estado')
              return (f.val as string[]).includes(t.estado)
            return true
          }),
        )
      } else if (tableName === 'questionnaire_instances') {
        // Rows are reshaped to match the join-alias payload produced by
        // the select string. We deliberately return the flat shape
        // getClinicianInbox expects: {user_id, scored_at, questionnaire_definitions:{code}, questionnaire_results:{total_score}}
        data = fixture.questionnaires
          .filter((q) =>
            state.filters.every((f) => {
              if (f.op === 'in' && f.col === 'user_id')
                return (f.val as string[]).includes(q.user_id)
              if (
                f.op === 'in' &&
                f.col === 'questionnaire_definitions.code'
              ) {
                return (f.val as string[]).includes(q.code)
              }
              if (f.op === 'eq' && f.col === 'status') return f.val === 'scored'
              return true
            }),
          )
          .map((q) => ({
            user_id: q.user_id,
            scored_at: q.scored_at,
            questionnaire_definitions: { code: q.code },
            questionnaire_results: { total_score: q.total_score },
          }))
      }

      if (state.order) {
        const { col, asc } = state.order
        data = [...(data as Array<Record<string, unknown>>)].sort((a, b) => {
          const av = (a[col] ?? '') as string
          const bv = (b[col] ?? '') as string
          return asc
            ? av.localeCompare(bv)
            : bv.localeCompare(av)
        })
      }

      return Promise.resolve({ data, error: null })
    }

    const chain: Record<string, unknown> = {}
    chain.select = vi.fn((arg?: string) => {
      state.selectArg = arg ?? null
      return chain
    })
    chain.eq = vi.fn((col: string, val: unknown) => {
      state.filters.push({ op: 'eq', col, val })
      return chain
    })
    chain.neq = vi.fn((col: string, val: unknown) => {
      state.filters.push({ op: 'neq', col, val })
      return chain
    })
    chain.in = vi.fn((col: string, val: unknown) => {
      state.filters.push({ op: 'in', col, val })
      return chain
    })
    chain.order = vi.fn((col: string, opts?: { ascending?: boolean }) => {
      state.order = { col, asc: opts?.ascending ?? true }
      return chain
    })
    chain.limit = vi.fn(() => chain)
    chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      resolver().then(onFulfilled, onRejected)
    return chain
  }

  return {
    from: vi.fn((table: string) => makeChain(table)),
  } as unknown as SupabaseClient<Database>
}

describe('getClinicianInbox — longitudinal enrichments (T11)', () => {
  // Scenario: two patients
  //  - User A has 3 closed sessions. The newest is the inbox row → sessionNumber=3.
  //    Previous closed at 2026-04-12, newest at 2026-04-20 → daysSincePrevious=8.
  //    PHQ-9 history: 18 (old) → 15 (mid) → 12 (latest) → phq9Trend [18,15,12].
  //    GAD-7 history: 10 (old) → 8 (latest) → gad7Trend [10, 8].
  //    2 open patient_tasks.
  //    Suicidality 'none' on a validated assessment → riskState 'none'.
  //  - User B has 1 closed session (first one ever) → sessionNumber=1, daysSincePrevious=null.
  //    No PHQ/GAD, 0 open tasks.
  //    1 open risk event 'critical' → riskState 'acute'.
  const baseFixture: InboxFixture = {
    sessions: [
      // User A history
      {
        id: 's-a1',
        user_id: 'user-a',
        closed_at: '2026-03-01T10:00:00.000Z',
        closure_reason: null,
        status: 'closed',
      },
      {
        id: 's-a2',
        user_id: 'user-a',
        closed_at: '2026-04-12T10:00:00.000Z',
        closure_reason: null,
        status: 'closed',
      },
      {
        id: 's-a3',
        user_id: 'user-a',
        closed_at: '2026-04-20T10:00:00.000Z',
        closure_reason: null,
        status: 'closed',
      },
      // User B history
      {
        id: 's-b1',
        user_id: 'user-b',
        closed_at: '2026-04-22T10:00:00.000Z',
        closure_reason: 'crisis_detected',
        status: 'closed',
      },
    ],
    assessments: [
      {
        id: 'a-a3',
        session_id: 's-a3',
        user_id: 'user-a',
        status: 'reviewed_confirmed',
        assessment_type: 'closure',
        created_at: '2026-04-20T12:00:00.000Z',
        reviewed_at: '2026-04-20T13:00:00.000Z',
        summary_json: {
          risk_assessment: { suicidality: 'none', self_harm: 'none', notes: '' },
        },
      },
    ],
    riskEvents: [
      {
        id: 'r-b-crit',
        session_id: 's-b1',
        user_id: 'user-b',
        severity: 'critical',
        status: 'open',
        created_at: '2026-04-22T10:30:00.000Z',
      },
    ],
    profiles: [
      { user_id: 'user-a', display_name: 'Ana' },
      { user_id: 'user-b', display_name: 'Borja' },
    ],
    patientTasks: [
      { id: 't1', user_id: 'user-a', estado: 'pendiente' },
      { id: 't2', user_id: 'user-a', estado: 'parcial' },
      { id: 't3', user_id: 'user-a', estado: 'cumplida' },
    ],
    questionnaires: [
      // User A PHQ9 oldest → newest
      { user_id: 'user-a', code: 'PHQ9', total_score: 18, scored_at: '2026-02-20T10:00:00.000Z' },
      { user_id: 'user-a', code: 'PHQ9', total_score: 15, scored_at: '2026-03-15T10:00:00.000Z' },
      { user_id: 'user-a', code: 'PHQ9', total_score: 12, scored_at: '2026-04-19T10:00:00.000Z' },
      // User A GAD7
      { user_id: 'user-a', code: 'GAD7', total_score: 10, scored_at: '2026-03-10T10:00:00.000Z' },
      { user_id: 'user-a', code: 'GAD7', total_score: 8, scored_at: '2026-04-19T10:00:00.000Z' },
    ],
  }

  it('computes sessionNumber, daysSincePrevious and PHQ/GAD trends per patient without leaking across rows', async () => {
    const supabase = makeSupabaseForInbox(baseFixture)
    const rows = await getClinicianInbox(supabase)

    const rowA = rows.find((r) => r.sessionId === 's-a3')!
    const rowB = rows.find((r) => r.sessionId === 's-b1')!

    expect(rowA.sessionId).toBe('s-a3')
    expect(rowA.sessionNumber).toBe(3)
    expect(rowA.daysSincePrevious).toBe(8)
    expect(rowA.phq9Trend).toEqual([18, 15, 12])
    expect(rowA.gad7Trend).toEqual([10, 8])
    expect(rowA.openTasksCount).toBe(2)

    expect(rowB.sessionId).toBe('s-b1')
    expect(rowB.sessionNumber).toBe(1)
    expect(rowB.daysSincePrevious).toBeNull()
    expect(rowB.phq9Trend).toEqual([])
    expect(rowB.gad7Trend).toEqual([])
    expect(rowB.openTasksCount).toBe(0)
  })

  it('derives riskState from user-scoped risk inputs (acute from critical open risk, none from clean validated assessment)', async () => {
    const supabase = makeSupabaseForInbox(baseFixture)
    const rows = await getClinicianInbox(supabase)

    const rowA = rows.find((r) => r.sessionId === 's-a3')!
    const rowB = rows.find((r) => r.sessionId === 's-b1')!

    // User A: last validated assessment has suicidality 'none' and no active
    // risk events. crisis session? No (closure_reason null).
    expect(rowA.riskState).toBe('none')
    // User B: open risk event severity 'critical' → acute.
    expect(rowB.riskState).toBe('acute')
  })

  it('caps PHQ-9 trend at the last 3 scores oldest→newest (drops older entries)', async () => {
    const fixture: InboxFixture = {
      ...baseFixture,
      questionnaires: [
        // Four PHQ9 scores — expect only the newest 3, oldest→newest.
        { user_id: 'user-a', code: 'PHQ9', total_score: 24, scored_at: '2026-01-01T00:00:00.000Z' },
        { user_id: 'user-a', code: 'PHQ9', total_score: 18, scored_at: '2026-02-20T10:00:00.000Z' },
        { user_id: 'user-a', code: 'PHQ9', total_score: 15, scored_at: '2026-03-15T10:00:00.000Z' },
        { user_id: 'user-a', code: 'PHQ9', total_score: 12, scored_at: '2026-04-19T10:00:00.000Z' },
      ],
    }
    const supabase = makeSupabaseForInbox(fixture)
    const rows = await getClinicianInbox(supabase)
    const rowA = rows.find((r) => r.sessionId === 's-a3')!
    expect(rowA.phq9Trend).toEqual([18, 15, 12])
  })
})
