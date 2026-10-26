import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getSessionSafetyState,
  type SafetyState,
} from '@/lib/server/chat/safety-state'

// =============================================================================
// Plan 7 T3a v2 + Plan 8 Fase 2 — `getSessionSafetyState` deriva un estado
// tipado a partir de `questionnaire_instances` + `questionnaire_results`,
// con fallback heurístico léxico sobre `messages`. Variantes ASQ renombradas
// a CSSRS con 5 bandas + override behaviorRecent (ítem 6b).
// =============================================================================

const NOW_ISO = '2026-04-28T12:00:00Z'
const SESSION_ID = '11111111-1111-4111-8111-111111111111'
const CSSRS_DEF_ID = 'cssrs-def-id'
const PHQ9_DEF_ID = 'phq9-def-id'
const CSSRS_INSTANCE_ID = 'cssrs-instance-id'

/**
 * Build a Supabase stub whose `.from(table)` returns a fluent builder. Each
 * builder consults `responses` to find the row to return. The shape
 * deliberately mimics the small subset of postgrest the module uses.
 */
type TableResponse = {
  data: unknown
  error: { message: string } | null
}

interface Responses {
  questionnaire_instances?: TableResponse
  questionnaire_definitions?: TableResponse
  questionnaire_results?: TableResponse
  messages?: TableResponse
}

function makeSupabase(responses: Responses) {
  return {
    from: vi.fn((table: keyof Responses | string) => {
      const resp = responses[table as keyof Responses] ?? {
        data: null,
        error: null,
      }

      const builder: Record<string, unknown> = {}
      const passthrough = () => builder
      builder.select = passthrough
      builder.eq = passthrough
      builder.gt = passthrough
      builder.gte = passthrough
      builder.in = passthrough
      builder.order = passthrough
      builder.limit = passthrough
      builder.single = vi.fn().mockResolvedValue(resp)
      builder.maybeSingle = vi.fn().mockResolvedValue(resp)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(builder as any).then = (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve({ ...resp, count: 0 }).then(onFulfilled)
      return builder
    }),
  } as unknown as Parameters<typeof getSessionSafetyState>[0]
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
})

function cssrsScoredInstance() {
  return {
    id: CSSRS_INSTANCE_ID,
    questionnaire_id: CSSRS_DEF_ID,
    status: 'scored',
    created_at: NOW_ISO,
    scored_at: NOW_ISO,
  }
}

describe('getSessionSafetyState — C-SSRS variants', () => {
  it('C-SSRS scored band=negative → cssrs_negative', async () => {
    const supabase = makeSupabase({
      questionnaire_instances: { data: cssrsScoredInstance(), error: null },
      questionnaire_definitions: { data: { code: 'CSSRS' }, error: null },
      questionnaire_results: {
        data: { severity_band: 'negative', flags_json: [] },
        error: null,
      },
    })

    const state = await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)
    expect(state.kind).toBe('cssrs_negative')
    if (state.kind === 'cssrs_negative') {
      expect(state.scoredAt).toBe(NOW_ISO)
    }
  })

  it('C-SSRS scored band=low_risk (item 1 o 2 = Sí) → cssrs_low_risk', async () => {
    const supabase = makeSupabase({
      questionnaire_instances: { data: cssrsScoredInstance(), error: null },
      questionnaire_definitions: { data: { code: 'CSSRS' }, error: null },
      questionnaire_results: {
        data: { severity_band: 'low_risk', flags_json: [] },
        error: null,
      },
    })

    const state = await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)
    expect(state.kind).toBe('cssrs_low_risk')
    if (state.kind === 'cssrs_low_risk') {
      expect(state.scoredAt).toBe(NOW_ISO)
    }
  })

  it('C-SSRS scored band=moderate_risk (item 3 = Sí) → cssrs_moderate_risk', async () => {
    const supabase = makeSupabase({
      questionnaire_instances: { data: cssrsScoredInstance(), error: null },
      questionnaire_definitions: { data: { code: 'CSSRS' }, error: null },
      questionnaire_results: {
        data: { severity_band: 'moderate_risk', flags_json: [] },
        error: null,
      },
    })

    const state = await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)
    expect(state.kind).toBe('cssrs_moderate_risk')
  })

  it('C-SSRS scored band=high_risk (item 4 = Sí) → cssrs_high_risk', async () => {
    const supabase = makeSupabase({
      questionnaire_instances: { data: cssrsScoredInstance(), error: null },
      questionnaire_definitions: { data: { code: 'CSSRS' }, error: null },
      questionnaire_results: {
        data: { severity_band: 'high_risk', flags_json: [] },
        error: null,
      },
    })

    const state = await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)
    expect(state.kind).toBe('cssrs_high_risk')
  })

  it('C-SSRS scored band=acute_risk con flag suicidality (lifetime) → cssrs_acute_risk con behaviorRecent=false', async () => {
    const supabase = makeSupabase({
      questionnaire_instances: { data: cssrsScoredInstance(), error: null },
      questionnaire_definitions: { data: { code: 'CSSRS' }, error: null },
      questionnaire_results: {
        data: {
          severity_band: 'acute_risk',
          flags_json: [{ reason: 'suicidality', itemOrder: 6 }],
        },
        error: null,
      },
    })

    const state = await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)
    expect(state.kind).toBe('cssrs_acute_risk')
    if (state.kind === 'cssrs_acute_risk') {
      expect(state.behaviorRecent).toBe(false)
      expect(state.flags).toHaveLength(1)
    }
  })

  it('C-SSRS scored band=acute_risk con flag acute_risk itemOrder=7 (override 6b) → cssrs_acute_risk con behaviorRecent=true', async () => {
    const supabase = makeSupabase({
      questionnaire_instances: { data: cssrsScoredInstance(), error: null },
      questionnaire_definitions: { data: { code: 'CSSRS' }, error: null },
      questionnaire_results: {
        data: {
          severity_band: 'acute_risk',
          flags_json: [{ reason: 'acute_risk', itemOrder: 7 }],
        },
        error: null,
      },
    })

    const state = await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)
    expect(state.kind).toBe('cssrs_acute_risk')
    if (state.kind === 'cssrs_acute_risk') {
      expect(state.behaviorRecent).toBe(true)
    }
  })

  it('C-SSRS scored banda inesperada → conservador cssrs_negative', async () => {
    const supabase = makeSupabase({
      questionnaire_instances: { data: cssrsScoredInstance(), error: null },
      questionnaire_definitions: { data: { code: 'CSSRS' }, error: null },
      questionnaire_results: {
        data: { severity_band: 'banda-rara-no-mapeable', flags_json: [] },
        error: null,
      },
    })

    const state = await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)
    expect(state.kind).toBe('cssrs_negative')
  })

  it('C-SSRS proposed pero no scored → cssrs_pending', async () => {
    const supabase = makeSupabase({
      questionnaire_instances: {
        data: {
          id: CSSRS_INSTANCE_ID,
          questionnaire_id: CSSRS_DEF_ID,
          status: 'proposed',
          created_at: NOW_ISO,
          scored_at: null,
        },
        error: null,
      },
      questionnaire_definitions: { data: { code: 'CSSRS' }, error: null },
    })

    const state = await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)
    expect(state.kind).toBe('cssrs_pending')
    if (state.kind === 'cssrs_pending') {
      expect(state.proposedAt).toBe(NOW_ISO)
    }
  })

  it('C-SSRS in_progress (todavía sin score) → cssrs_pending', async () => {
    const supabase = makeSupabase({
      questionnaire_instances: {
        data: {
          id: CSSRS_INSTANCE_ID,
          questionnaire_id: CSSRS_DEF_ID,
          status: 'in_progress',
          created_at: NOW_ISO,
          scored_at: null,
        },
        error: null,
      },
      questionnaire_definitions: { data: { code: 'CSSRS' }, error: null },
    })

    const state = await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)
    expect(state.kind).toBe('cssrs_pending')
  })
})

describe('getSessionSafetyState — fallback heurístico textual', () => {
  it('BD vacía + assistant safety check + user posterior → textual_check_completed', async () => {
    const supabase = makeSupabase({
      questionnaire_instances: { data: null, error: null },
      messages: {
        data: [
          {
            role: 'assistant',
            parts: [
              { type: 'text', text: '¿Estás pensando en hacerte daño?' },
            ],
            created_at: '2026-04-28T11:00:00Z',
          },
          {
            role: 'user',
            parts: [{ type: 'text', text: 'no, estoy bien' }],
            created_at: '2026-04-28T11:01:00Z',
          },
        ],
        error: null,
      },
    })

    const state = await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)
    expect(state.kind).toBe('textual_check_completed')
    if (state.kind === 'textual_check_completed') {
      expect(state.lastAssistantCheckAt).toBe('2026-04-28T11:00:00Z')
      expect(state.lastPatientResponseAt).toBe('2026-04-28T11:01:00Z')
    }
  })

  it('BD vacía + assistant safety check pero SIN user posterior → never_assessed (abandonado)', async () => {
    const supabase = makeSupabase({
      questionnaire_instances: { data: null, error: null },
      messages: {
        data: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'me siento mal' }],
            created_at: '2026-04-28T10:59:00Z',
          },
          {
            role: 'assistant',
            parts: [{ type: 'text', text: 'Quiero asegurarme de que estás a salvo' }],
            created_at: '2026-04-28T11:00:00Z',
          },
        ],
        error: null,
      },
    })

    const state = await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)
    expect(state.kind).toBe('never_assessed')
  })

  it('BD vacía + sin nada → never_assessed', async () => {
    const supabase = makeSupabase({
      questionnaire_instances: { data: null, error: null },
      messages: { data: [], error: null },
    })

    const state = await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)
    expect(state.kind).toBe('never_assessed')
  })

  it('PHQ-9 scored existe pero SIN check textual → fallback never_assessed (no contamos PHQ-9)', async () => {
    // Decisión deliberada: no hay rama `phq9_item9_clean`. Un PHQ-9 scored
    // cae al fallback textual; si tampoco hay check textual, queda como
    // `never_assessed`.
    const supabase = makeSupabase({
      questionnaire_instances: {
        data: {
          id: 'phq9-instance',
          questionnaire_id: PHQ9_DEF_ID,
          status: 'scored',
          created_at: NOW_ISO,
          scored_at: NOW_ISO,
        },
        error: null,
      },
      questionnaire_definitions: { data: { code: 'PHQ9' }, error: null },
      messages: { data: [], error: null },
    })

    const state = await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)
    expect(state.kind).toBe('never_assessed')
  })

  it('cuestionario no-CSSRS proposed (PHQ-9) → fallback textual (no cuenta como pending de seguridad)', async () => {
    const supabase = makeSupabase({
      questionnaire_instances: {
        data: {
          id: 'phq9-instance',
          questionnaire_id: PHQ9_DEF_ID,
          status: 'proposed',
          created_at: NOW_ISO,
          scored_at: null,
        },
        error: null,
      },
      questionnaire_definitions: { data: { code: 'PHQ9' }, error: null },
      messages: { data: [], error: null },
    })

    const state = await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)
    expect(state.kind).toBe('never_assessed')
  })
})

describe('getSessionSafetyState — failsafe', () => {
  it('error en questionnaire_instances → never_assessed + console.error', async () => {
    const supabase = makeSupabase({
      questionnaire_instances: {
        data: null,
        error: { message: 'DB hiccup' },
      },
    })

    const state = await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)
    expect(state.kind).toBe('never_assessed')
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('excepción inesperada → never_assessed + console.error', async () => {
    const supabase = {
      from: vi.fn(() => {
        throw new Error('boom')
      }),
    } as unknown as Parameters<typeof getSessionSafetyState>[0]

    const state = await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)
    expect(state.kind).toBe('never_assessed')
    expect(consoleErrorSpy).toHaveBeenCalled()
  })
})

type StoredRow = Record<string, unknown>

/** In-memory query boundary that applies filters/order/limit to complete rows. */
function makeFilteringSupabase(options: {
  instances?: StoredRow[]
  band?: string
  flags?: unknown
  results?: StoredRow[]
  messages?: StoredRow[]
  failTable?: string
  throwOnTable?: string
  definitions?: StoredRow[]
} = {}) {
  const tables: Record<string, StoredRow[]> = {
    questionnaire_definitions: options.definitions ?? [
      { id: CSSRS_DEF_ID, code: 'CSSRS', is_active: true },
      { id: PHQ9_DEF_ID, code: 'PHQ9', is_active: true },
    ],
    questionnaire_instances: options.instances ?? [cssrsScoredInstance()],
    questionnaire_results: options.results ?? [{ instance_id: CSSRS_INSTANCE_ID, severity_band: options.band ?? 'high_risk', flags_json: options.flags ?? [] }],
    messages: options.messages ?? [],
  }
  return {
    from(table: string) {
      if (options.throwOnTable === table) throw new Error('private query values must not escape')
      let rows = [...(tables[table] ?? [])]
      let rowLimit = Infinity
      const ordering: Array<{ field: string; ascending: boolean }> = []
      const finish = (single: boolean) => {
        const ordered = [...rows].sort((left, right) => {
          for (const { field, ascending } of ordering) {
            const comparison = String(left[field]).localeCompare(String(right[field]))
            if (comparison) return ascending ? comparison : -comparison
          }
          return 0
        }).slice(0, rowLimit)
        return Promise.resolve({ data: single ? ordered[0] ?? null : ordered, error: options.failTable === table ? { message: 'private query values must not escape' } : null })
      }
      const query = {
        select: () => query,
        eq: (field: string, value: unknown) => { rows = rows.filter(row => row[field] === value); return query },
        gte: (field: string, value: string) => { rows = rows.filter(row => String(row[field]) >= value); return query },
        in: (field: string, values: unknown[]) => { rows = rows.filter(row => values.includes(row[field])); return query },
        order: (field: string, value: { ascending: boolean }) => { ordering.push({ field, ascending: value.ascending }); return query },
        limit: (value: number) => { rowLimit = value; return query },
        single: () => finish(true),
        maybeSingle: () => finish(true),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => finish(false).then(resolve, reject),
      }
      return query
    },
  } as unknown as Parameters<typeof getSessionSafetyState>[0]
}

describe('getSessionSafetyState — strict pilot read', () => {
  const cssrsRow = () => ({ ...cssrsScoredInstance(), session_id: SESSION_ID })

  it('finds the current-session CSSRS even when a different questionnaire is more recent, while baseline stays compatible', async () => {
    const supabase = makeFilteringSupabase({ instances: [
      cssrsRow(),
      { id: 'phq9-newer', questionnaire_id: PHQ9_DEF_ID, session_id: SESSION_ID, status: 'scored', created_at: '2026-04-28T12:05:00Z', scored_at: '2026-04-28T12:05:00Z' },
    ] })

    expect((await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)).kind).toBe('never_assessed')
    expect(await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO, { strict: true })).toEqual({ kind: 'cssrs_high_risk', scoredAt: NOW_ISO })
  })

  it('does not use another session or an instance from before this session opened', async () => {
    const supabase = makeFilteringSupabase({ instances: [
      { ...cssrsRow(), session_id: 'other-session', created_at: '2026-04-28T12:10:00Z' },
      { ...cssrsRow(), created_at: '2026-04-27T12:00:00Z' },
    ] })

    expect(await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO, { strict: true })).toEqual({ kind: 'never_assessed' })
  })

  it('uses the latest relevant CSSRS pending state instead of an older scored one', async () => {
    const supabase = makeFilteringSupabase({ instances: [
      cssrsRow(),
      { ...cssrsRow(), id: 'pending-cssrs', status: 'in_progress', created_at: '2026-04-28T12:05:00Z', scored_at: null },
    ] })

    expect(await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO, { strict: true })).toEqual({ kind: 'cssrs_pending', proposedAt: '2026-04-28T12:05:00Z' })
  })

  it.each([
    ['negative', 'cssrs_negative'],
    ['low_risk', 'cssrs_low_risk'],
    ['moderate_risk', 'cssrs_moderate_risk'],
    ['high_risk', 'cssrs_high_risk'],
  ])('preserves the canonical %s result without changing its band', async (band, kind) => {
    const supabase = makeFilteringSupabase({ instances: [cssrsRow()], band })

    expect(await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO, { strict: true })).toEqual({ kind, scoredAt: NOW_ISO })
  })

  it('preserves the structured acute recent-behavior flag', async () => {
    const flags = [{ reason: 'acute_risk', itemOrder: 7 }]
    const supabase = makeFilteringSupabase({ instances: [cssrsRow()], band: 'acute_risk', flags })

    expect(await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO, { strict: true })).toEqual({ kind: 'cssrs_acute_risk', scoredAt: NOW_ISO, flags, behaviorRecent: true })
  })

  it.each(['questionnaire_definitions', 'questionnaire_instances', 'questionnaire_results', 'messages'])('rejects a failed %s read without exposing values or fabricating absence', async failTable => {
    const supabase = makeFilteringSupabase({ instances: failTable === 'messages' ? [] : [cssrsRow()], failTable })

    await expect(getSessionSafetyState(supabase, SESSION_ID, NOW_ISO, { strict: true })).rejects.toThrow(/^safety_state_unavailable$/)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('does not convert an unknown band into a negative result in strict mode', async () => {
    const supabase = makeFilteringSupabase({ instances: [cssrsRow()], band: 'unrecognized-private-band' })

    await expect(getSessionSafetyState(supabase, SESSION_ID, NOW_ISO, { strict: true })).rejects.toThrow(/^safety_state_unavailable$/)
    expect((await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO, { strict: false })).kind).toBe('cssrs_negative')
  })

  it('rejects a scored instance without its result rather than reporting an unassessed patient', async () => {
    const supabase = makeFilteringSupabase({ instances: [cssrsRow()], results: [] })

    await expect(getSessionSafetyState(supabase, SESSION_ID, NOW_ISO, { strict: true })).rejects.toThrow(/^safety_state_unavailable$/)
  })

  it('does not silently drop malformed acute flags in strict mode', async () => {
    const supabase = makeFilteringSupabase({ instances: [cssrsRow()], band: 'acute_risk', flags: [{ reason: 'acute_risk' }] })

    await expect(getSessionSafetyState(supabase, SESSION_ID, NOW_ISO, { strict: true })).rejects.toThrow(/^safety_state_unavailable$/)
  })

  it('rejects a missing active CSSRS definition instead of treating it as an unassessed patient', async () => {
    const supabase = makeFilteringSupabase({ definitions: [{ id: CSSRS_DEF_ID, code: 'CSSRS', is_active: false }] })

    await expect(getSessionSafetyState(supabase, SESSION_ID, NOW_ISO, { strict: true })).rejects.toThrow(/^safety_state_unavailable$/)
  })

  it('sanitizes unexpected query exceptions in strict mode', async () => {
    const supabase = makeFilteringSupabase({ throwOnTable: 'questionnaire_definitions' })

    await expect(getSessionSafetyState(supabase, SESSION_ID, NOW_ISO, { strict: true })).rejects.toThrow(/^safety_state_unavailable$/)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })
})

describe('SafetyState type', () => {
  it('discriminated union exhaustivo (compile-time)', () => {
    const cases: SafetyState[] = [
      { kind: 'never_assessed' },
      { kind: 'cssrs_pending', proposedAt: NOW_ISO },
      { kind: 'cssrs_negative', scoredAt: NOW_ISO },
      { kind: 'cssrs_low_risk', scoredAt: NOW_ISO },
      { kind: 'cssrs_moderate_risk', scoredAt: NOW_ISO },
      { kind: 'cssrs_high_risk', scoredAt: NOW_ISO },
      {
        kind: 'cssrs_acute_risk',
        scoredAt: NOW_ISO,
        flags: [],
        behaviorRecent: false,
      },
      {
        kind: 'cssrs_acute_risk',
        scoredAt: NOW_ISO,
        flags: [{ reason: 'acute_risk', itemOrder: 7 }],
        behaviorRecent: true,
      },
      {
        kind: 'textual_check_completed',
        lastAssistantCheckAt: NOW_ISO,
        lastPatientResponseAt: NOW_ISO,
      },
    ]
    expect(cases).toHaveLength(9)
  })
})
