import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getSessionSafetyState,
  type SafetyState,
} from '@/lib/chat/safety-state'

// =============================================================================
// Plan 7 T3a v2 — `getSessionSafetyState` deriva un estado tipado a partir de
// `questionnaire_instances` + `questionnaire_results` + `questionnaire_answers`,
// con fallback heurístico léxico sobre `messages`.
// =============================================================================

const NOW_ISO = '2026-04-28T12:00:00Z'
const SESSION_ID = '11111111-1111-4111-8111-111111111111'
const ASQ_DEF_ID = 'asq-def-id'
const PHQ9_DEF_ID = 'phq9-def-id'
const ASQ_INSTANCE_ID = 'asq-instance-id'
const ITEM_5_ID = 'item-5-id'

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
  questionnaire_items?: TableResponse
  questionnaire_answers?: TableResponse
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

describe('getSessionSafetyState — ASQ variants', () => {
  it('ASQ scored negativo + answer al item 5 → asq_negative con coversAcuteIdeation=true (caso del smoke)', async () => {
    const supabase = makeSupabase({
      questionnaire_instances: {
        data: {
          id: ASQ_INSTANCE_ID,
          questionnaire_id: ASQ_DEF_ID,
          status: 'scored',
          created_at: NOW_ISO,
          scored_at: NOW_ISO,
        },
        error: null,
      },
      questionnaire_definitions: {
        data: { code: 'ASQ' },
        error: null,
      },
      questionnaire_results: {
        data: { severity_band: 'negative', flags_json: [] },
        error: null,
      },
      questionnaire_items: {
        data: { id: ITEM_5_ID, order_index: 5 },
        error: null,
      },
      questionnaire_answers: {
        data: { id: 'answer-5-id' },
        error: null,
      },
    })

    const state = await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)
    expect(state.kind).toBe('asq_negative')
    if (state.kind === 'asq_negative') {
      expect(state.coversAcuteIdeation).toBe(true)
      expect(state.scoredAt).toBe(NOW_ISO)
    }
  })

  it('ASQ scored negativo SIN answer al item 5 → asq_negative con coversAcuteIdeation=false', async () => {
    const supabase = makeSupabase({
      questionnaire_instances: {
        data: {
          id: ASQ_INSTANCE_ID,
          questionnaire_id: ASQ_DEF_ID,
          status: 'scored',
          created_at: NOW_ISO,
          scored_at: NOW_ISO,
        },
        error: null,
      },
      questionnaire_definitions: {
        data: { code: 'ASQ' },
        error: null,
      },
      questionnaire_results: {
        data: { severity_band: 'negative', flags_json: [] },
        error: null,
      },
      questionnaire_items: {
        data: { id: ITEM_5_ID, order_index: 5 },
        error: null,
      },
      questionnaire_answers: {
        data: null, // sin respuesta al item 5
        error: null,
      },
    })

    const state = await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)
    expect(state.kind).toBe('asq_negative')
    if (state.kind === 'asq_negative') {
      expect(state.coversAcuteIdeation).toBe(false)
    }
  })

  it('ASQ scored positivo sin acute_risk flag → asq_positive_non_acute', async () => {
    const supabase = makeSupabase({
      questionnaire_instances: {
        data: {
          id: ASQ_INSTANCE_ID,
          questionnaire_id: ASQ_DEF_ID,
          status: 'scored',
          created_at: NOW_ISO,
          scored_at: NOW_ISO,
        },
        error: null,
      },
      questionnaire_definitions: { data: { code: 'ASQ' }, error: null },
      questionnaire_results: {
        data: {
          severity_band: 'positive',
          flags_json: [{ reason: 'suicidality', itemOrder: 1 }],
        },
        error: null,
      },
    })

    const state = await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)
    expect(state.kind).toBe('asq_positive_non_acute')
    if (state.kind === 'asq_positive_non_acute') {
      expect(state.flags).toHaveLength(1)
    }
  })

  it('ASQ scored con acute_risk flag → asq_acute_risk', async () => {
    const supabase = makeSupabase({
      questionnaire_instances: {
        data: {
          id: ASQ_INSTANCE_ID,
          questionnaire_id: ASQ_DEF_ID,
          status: 'scored',
          created_at: NOW_ISO,
          scored_at: NOW_ISO,
        },
        error: null,
      },
      questionnaire_definitions: { data: { code: 'ASQ' }, error: null },
      questionnaire_results: {
        data: {
          severity_band: 'positive',
          flags_json: [{ reason: 'acute_risk', itemOrder: 5 }],
        },
        error: null,
      },
    })

    const state = await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)
    expect(state.kind).toBe('asq_acute_risk')
    if (state.kind === 'asq_acute_risk') {
      expect(state.flags).toHaveLength(1)
    }
  })

  it('ASQ proposed pero no scored → asq_proposed_pending', async () => {
    const supabase = makeSupabase({
      questionnaire_instances: {
        data: {
          id: ASQ_INSTANCE_ID,
          questionnaire_id: ASQ_DEF_ID,
          status: 'proposed',
          created_at: NOW_ISO,
          scored_at: null,
        },
        error: null,
      },
      questionnaire_definitions: { data: { code: 'ASQ' }, error: null },
    })

    const state = await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)
    expect(state.kind).toBe('asq_proposed_pending')
    if (state.kind === 'asq_proposed_pending') {
      expect(state.proposedAt).toBe(NOW_ISO)
    }
  })

  it('ASQ in_progress (todavía sin score) → asq_proposed_pending', async () => {
    const supabase = makeSupabase({
      questionnaire_instances: {
        data: {
          id: ASQ_INSTANCE_ID,
          questionnaire_id: ASQ_DEF_ID,
          status: 'in_progress',
          created_at: NOW_ISO,
          scored_at: null,
        },
        error: null,
      },
      questionnaire_definitions: { data: { code: 'ASQ' }, error: null },
    })

    const state = await getSessionSafetyState(supabase, SESSION_ID, NOW_ISO)
    expect(state.kind).toBe('asq_proposed_pending')
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
    // Decisión deliberada de v2: no hay rama `phq9_item9_clean`. Un PHQ-9
    // scored cae al fallback textual; si tampoco hay check textual, queda
    // como `never_assessed`.
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

describe('SafetyState type', () => {
  it('discriminated union exhaustivo (compile-time)', () => {
    const cases: SafetyState[] = [
      { kind: 'never_assessed' },
      { kind: 'asq_proposed_pending', proposedAt: NOW_ISO },
      { kind: 'asq_negative', scoredAt: NOW_ISO, coversAcuteIdeation: true },
      { kind: 'asq_positive_non_acute', scoredAt: NOW_ISO, flags: [] },
      { kind: 'asq_acute_risk', scoredAt: NOW_ISO, flags: [] },
      {
        kind: 'textual_check_completed',
        lastAssistantCheckAt: NOW_ISO,
        lastPatientResponseAt: NOW_ISO,
      },
    ]
    expect(cases).toHaveLength(6)
  })
})
