import { describe, it, expect, vi } from 'vitest'
import {
  createInstance,
  submitAnswers,
} from '@/lib/questionnaires/service'

/**
 * Integration flow: AI proposes PHQ-9 -> user submits 9 answers summing to 12
 * -> service scores -> persists result with band='moderate' -> no risk_event
 * since item 9 = 0.
 *
 * Mocks the Supabase client shape since real DB access is out of scope here.
 */

function makeChain(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select',
    'insert',
    'update',
    'eq',
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
  ) => Promise.resolve({ data, error }).then(resolve, reject)
  return chain
}

describe('questionnaire flow — end to end (mocked DB)', () => {
  it('PHQ-9 score=12 produces moderate band and no risk event', async () => {
    const definition = {
      id: 'def-phq9',
      code: 'PHQ9',
      name: 'PHQ-9',
    }
    const instance = {
      id: 'inst-1',
      user_id: 'user-1',
      session_id: 'sess-1',
      conversation_id: 'conv-1',
      questionnaire_id: 'def-phq9',
      status: 'proposed',
    }
    const items = Array.from({ length: 9 }, (_, i) => ({
      id: `item-${i + 1}`,
      questionnaire_id: 'def-phq9',
      order_index: i + 1,
      prompt: `Item ${i + 1}`,
      options_json: {},
      numeric_value_map_json: {},
    }))

    const insertedRows: Array<{ table: string; payload: unknown }> = []
    const callOrder: string[] = []

    const fromMock = vi.fn((table: string) => {
      callOrder.push(table)

      if (table === 'questionnaire_definitions') {
        return makeChain(definition)
      }
      if (table === 'questionnaire_instances') {
        const isFetch = callOrder.filter((t) => t === 'questionnaire_instances').length > 1
        const chain = makeChain(instance)
        // createInstance uses .insert().select().single() flow — first call = insert, fetch fine.
        // submitAnswers uses .select().eq().single() for fetch, then .update().eq() for status.
        ;(chain.insert as ReturnType<typeof vi.fn>).mockImplementation(
          (payload: unknown) => {
            insertedRows.push({ table, payload })
            return chain
          },
        )
        ;(chain.update as ReturnType<typeof vi.fn>).mockImplementation(
          (payload: unknown) => {
            insertedRows.push({ table: `${table}:update`, payload })
            return chain
          },
        )
        void isFetch
        return chain
      }
      if (table === 'questionnaire_items') {
        return makeChain(items)
      }
      if (table === 'questionnaire_answers') {
        const chain = makeChain(null)
        ;(chain.insert as ReturnType<typeof vi.fn>).mockImplementation(
          (payload: unknown) => {
            insertedRows.push({ table, payload })
            return chain
          },
        )
        return chain
      }
      if (table === 'questionnaire_results') {
        const chain = makeChain(null)
        ;(chain.insert as ReturnType<typeof vi.fn>).mockImplementation(
          (payload: unknown) => {
            insertedRows.push({ table, payload })
            return chain
          },
        )
        return chain
      }
      if (table === 'risk_events') {
        const chain = makeChain(null)
        ;(chain.insert as ReturnType<typeof vi.fn>).mockImplementation(
          (payload: unknown) => {
            insertedRows.push({ table, payload })
            return chain
          },
        )
        return chain
      }
      return makeChain(null)
    })

    const supabase = { from: fromMock } as unknown as Parameters<
      typeof createInstance
    >[0]

    // 1. AI proposes the questionnaire.
    const created = await createInstance(supabase, {
      userId: 'user-1',
      sessionId: 'sess-1',
      conversationId: 'conv-1',
      questionnaireCode: 'PHQ9',
      triggerReason: 'ánimo bajo sostenido durante 4 turnos',
    })
    expect(created.id).toBe('inst-1')

    // 2. User submits 9 answers summing to 12, item 9 = 0 (no suicidality).
    const rawValues = [2, 2, 1, 2, 1, 2, 1, 1, 0]
    const answers = rawValues.map((v, i) => ({
      itemOrder: i + 1,
      valueNumeric: v,
      valueRaw: String(v),
    }))

    const scoring = await submitAnswers(supabase, {
      instanceId: 'inst-1',
      answers,
    })

    expect(scoring.totalScore).toBe(12)
    expect(scoring.severityBand).toBe('moderate')
    expect(scoring.flags).toEqual([])
    expect(scoring.requiresReview).toBe(false)

    // 3. questionnaire_results inserted with matching band.
    const resultInsert = insertedRows.find(
      (r) => r.table === 'questionnaire_results',
    )
    expect(resultInsert?.payload).toMatchObject({
      instance_id: 'inst-1',
      total_score: 12,
      severity_band: 'moderate',
      requires_review: false,
    })

    // 4. No risk_event emitted (no flags).
    expect(insertedRows.find((r) => r.table === 'risk_events')).toBeUndefined()
  })

  it('ASQ item 5 = 1 produces critical risk_event with acute_risk flag', async () => {
    const definition = { id: 'def-asq', code: 'ASQ', name: 'ASQ' }
    const instance = {
      id: 'inst-asq',
      user_id: 'user-1',
      session_id: 'sess-1',
      conversation_id: 'conv-1',
      questionnaire_id: 'def-asq',
      status: 'proposed',
    }
    const items = Array.from({ length: 5 }, (_, i) => ({
      id: `item-${i + 1}`,
      questionnaire_id: 'def-asq',
      order_index: i + 1,
      prompt: `Item ${i + 1}`,
      options_json: {},
      numeric_value_map_json: {},
    }))

    const insertedRows: Array<{ table: string; payload: unknown }> = []

    const fromMock = vi.fn((table: string) => {
      if (table === 'questionnaire_instances') {
        const chain = makeChain(instance)
        ;(chain.insert as ReturnType<typeof vi.fn>).mockImplementation(() => chain)
        return chain
      }
      if (table === 'questionnaire_items') return makeChain(items)
      if (table === 'questionnaire_definitions') return makeChain(definition)
      if (
        table === 'questionnaire_answers' ||
        table === 'questionnaire_results' ||
        table === 'risk_events'
      ) {
        const chain = makeChain(null)
        ;(chain.insert as ReturnType<typeof vi.fn>).mockImplementation(
          (payload: unknown) => {
            insertedRows.push({ table, payload })
            return chain
          },
        )
        return chain
      }
      return makeChain(null)
    })

    const supabase = { from: fromMock } as unknown as Parameters<
      typeof submitAnswers
    >[0]

    const scoring = await submitAnswers(supabase, {
      instanceId: 'inst-asq',
      answers: [
        { itemOrder: 1, valueNumeric: 1, valueRaw: 'Sí' },
        { itemOrder: 2, valueNumeric: 0, valueRaw: 'No' },
        { itemOrder: 3, valueNumeric: 0, valueRaw: 'No' },
        { itemOrder: 4, valueNumeric: 0, valueRaw: 'No' },
        { itemOrder: 5, valueNumeric: 1, valueRaw: 'Sí' },
      ],
    })

    expect(scoring.severityBand).toBe('positive')
    expect(scoring.flags).toEqual([{ itemOrder: 5, reason: 'acute_risk' }])

    const risk = insertedRows.find((r) => r.table === 'risk_events')
    expect(risk).toBeDefined()
    expect(risk?.payload).toMatchObject({
      risk_type: 'suicidal_ideation',
      severity: 'critical',
      source_type: 'questionnaire',
    })
  })
})
