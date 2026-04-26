import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getSessionDetail } from '@/lib/clinician/session-detail'

// ── Supabase mock helpers ──────────────────────────────────────────────────
//
// The chain shapes used by getSessionDetail:
//   - clinical_sessions: select(...).eq('id', id).maybeSingle()
//   - user_profiles:     select(...).eq('user_id', uid).maybeSingle()
//   - assessments (live): select(...).eq().eq().neq().order().limit().maybeSingle()
//   - assessments (superseded): select(...).eq().eq().eq().order().limit().maybeSingle()
//   - messages:          select(...).eq().in().order()       → awaitable
//   - patient_tasks:     select(...).eq().in().neq().order() → awaitable

type Result = { data: unknown; error: unknown }

function makeChain(result: Result) {
  const chain: Record<string, unknown> = {}
  const passthrough = () => chain
  for (const m of [
    'select',
    'eq',
    'neq',
    'in',
    'order',
    'limit',
    'gt',
    'gte',
    'lt',
    'lte',
  ]) {
    chain[m] = vi.fn(passthrough)
  }
  chain.maybeSingle = vi.fn(() => Promise.resolve(result))
  ;(chain as { then: unknown }).then = (
    resolve: (v: unknown) => unknown,
    reject?: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return chain
}

/**
 * The two `assessments` queries inside getSessionDetail are differentiated
 * by their filters: the live-row query calls `.neq('status','superseded')`,
 * the recent-superseded query calls `.eq('status','superseded')`.
 *
 * This factory returns a fresh chain for each `from('assessments')` call and
 * tracks the eq/neq calls so we can route results: the first chain is the
 * live-row query, the second is the recent-superseded query. Tests pass two
 * results in order.
 */
function makeAssessmentsRouter(results: [Result, Result]) {
  let i = 0
  return () => {
    const result = results[i] ?? { data: null, error: null }
    i++
    return makeChain(result)
  }
}

type SessionRow = {
  id: string
  user_id: string
  opened_at: string
  closed_at: string | null
  closure_reason: string | null
  conversation_id: string | null
}

function makeSupabase({
  session,
  profile,
  liveAssessment,
  recentSuperseded,
  messages = { data: [], error: null },
  patientTasks = { data: [], error: null },
}: {
  session: SessionRow | null
  profile?: Result
  liveAssessment?: Result
  recentSuperseded?: Result
  messages?: Result
  patientTasks?: Result
}) {
  const assessmentsRouter = makeAssessmentsRouter([
    liveAssessment ?? { data: null, error: null },
    recentSuperseded ?? { data: null, error: null },
  ])

  return {
    from: vi.fn((table: string) => {
      switch (table) {
        case 'clinical_sessions':
          return makeChain({ data: session, error: null })
        case 'user_profiles':
          return makeChain(profile ?? { data: null, error: null })
        case 'assessments':
          return assessmentsRouter()
        case 'messages':
          return makeChain(messages)
        case 'patient_tasks':
          return makeChain(patientTasks)
        default:
          throw new Error(`Unexpected table in test: ${table}`)
      }
    }),
  }
}

const baseSession: SessionRow = {
  id: 'session-1',
  user_id: 'user-1',
  opened_at: '2026-04-23T10:00:00.000Z',
  closed_at: '2026-04-23T10:30:00.000Z',
  closure_reason: 'user_request',
  conversation_id: 'conv-1',
}

const validSummary = {
  chief_complaint: 'Tristeza',
  presenting_issues: ['ánimo bajo'],
  mood_affect: 'apagado',
  cognitive_patterns: ['rumiación'],
  risk_assessment: { suicidality: 'none', self_harm: 'none', notes: '' },
  questionnaires: [],
  areas_for_exploration: [],
  preliminary_impression: 'leve',
  recommended_actions_for_clinician: [],
  patient_facing_summary: 'Gracias por compartir esto.',
  proposed_tasks: [],
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-04-24T12:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getSessionDetail', () => {
  it('returns null when the session does not exist', async () => {
    const supabase = makeSupabase({ session: null })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getSessionDetail(supabase as any, 'session-1')
    expect(result).toBeNull()
  })

  it('parses summary_json for normal statuses (e.g. draft_ai)', async () => {
    const supabase = makeSupabase({
      session: baseSession,
      liveAssessment: {
        data: {
          id: 'a-1',
          status: 'draft_ai',
          summary_json: validSummary,
          generated_by: 'ai',
          created_at: '2026-04-23T10:30:05.000Z',
          clinical_notes: null,
          rejection_reason: null,
        },
        error: null,
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getSessionDetail(supabase as any, 'session-1')

    expect(result).not.toBeNull()
    expect(result!.assessment).not.toBeNull()
    expect(result!.assessment!.status).toBe('draft_ai')
    expect(result!.assessment!.summary).toEqual(
      expect.objectContaining({ chief_complaint: 'Tristeza' }),
    )
    expect(result!.regenerationInProgress).toBe(false)
  })

  // Blocker 1a — requires_manual_review rows hold a generation_failure
  // payload that doesn't validate against AssessmentSchema. The page must
  // not throw; instead, surface summary=null and let the view render the
  // failure UI.
  it('returns summary=null without parsing for requires_manual_review', async () => {
    const supabase = makeSupabase({
      session: baseSession,
      liveAssessment: {
        data: {
          id: 'a-mr-1',
          status: 'requires_manual_review',
          summary_json: {
            generation_failure: {
              error: 'LLM 5xx upstream timeout',
              occurred_at: '2026-04-23T10:30:05.000Z',
            },
          },
          generated_by: 'ai',
          created_at: '2026-04-23T10:30:05.000Z',
          clinical_notes: null,
          rejection_reason: null,
        },
        error: null,
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getSessionDetail(supabase as any, 'session-1')

    expect(result!.assessment).not.toBeNull()
    expect(result!.assessment!.status).toBe('requires_manual_review')
    expect(result!.assessment!.summary).toBeNull()
    // regenerationInProgress is only meaningful when assessment is null
    expect(result!.regenerationInProgress).toBe(false)
  })

  // Blocker 2a — when there's no live row but a superseded row was touched
  // within the window, signal "regenerating". This keeps the UI from
  // showing terminal-failure copy during the LLM round-trip.
  it('flags regenerationInProgress=true when the only row is a recently-superseded one', async () => {
    const supabase = makeSupabase({
      session: baseSession,
      liveAssessment: { data: null, error: null },
      recentSuperseded: {
        // 30 seconds ago — well within the 5min window
        data: {
          id: 'a-old',
          updated_at: '2026-04-24T11:59:30.000Z',
          created_at: '2026-04-23T10:00:00.000Z',
        },
        error: null,
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getSessionDetail(supabase as any, 'session-1')

    expect(result!.assessment).toBeNull()
    expect(result!.regenerationInProgress).toBe(true)
  })

  it('flags regenerationInProgress=false when the superseded row is older than the window', async () => {
    const supabase = makeSupabase({
      session: baseSession,
      liveAssessment: { data: null, error: null },
      recentSuperseded: {
        // 10 minutes ago — outside the 5min window
        data: {
          id: 'a-ancient',
          updated_at: '2026-04-24T11:50:00.000Z',
          created_at: '2026-04-23T10:00:00.000Z',
        },
        error: null,
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getSessionDetail(supabase as any, 'session-1')

    expect(result!.assessment).toBeNull()
    expect(result!.regenerationInProgress).toBe(false)
  })

  it('flags regenerationInProgress=false when there are no superseded rows at all', async () => {
    const supabase = makeSupabase({
      session: baseSession,
      liveAssessment: { data: null, error: null },
      recentSuperseded: { data: null, error: null },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getSessionDetail(supabase as any, 'session-1')

    expect(result!.assessment).toBeNull()
    expect(result!.regenerationInProgress).toBe(false)
  })

  it('does NOT flag regenerationInProgress when a live row exists, even if there is also a recent superseded row', async () => {
    const supabase = makeSupabase({
      session: baseSession,
      liveAssessment: {
        data: {
          id: 'a-new',
          status: 'draft_ai',
          summary_json: validSummary,
          generated_by: 'ai',
          created_at: '2026-04-24T12:00:00.000Z',
          clinical_notes: null,
          rejection_reason: null,
        },
        error: null,
      },
      recentSuperseded: {
        data: {
          id: 'a-old',
          updated_at: '2026-04-24T11:59:30.000Z',
          created_at: '2026-04-23T10:00:00.000Z',
        },
        error: null,
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getSessionDetail(supabase as any, 'session-1')

    expect(result!.assessment).not.toBeNull()
    expect(result!.regenerationInProgress).toBe(false)
  })
})
