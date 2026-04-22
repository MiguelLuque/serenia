import { describe, it, expect, vi } from 'vitest'
import {
  createInstance,
  startInstance,
  getActiveInstanceForSession,
  submitAnswers,
} from '@/lib/questionnaires/service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal chainable Supabase query mock that resolves with { data, error }. */
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'in', 'order', 'limit', 'single', 'maybeSingle',
  ]
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  ;(chain as { then: unknown }).then = (
    resolve: (v: unknown) => unknown,
    _reject?: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, _reject)
  return chain
}

function makeDefinition(overrides: Record<string, unknown> = {}) {
  return {
    id: 'def-1',
    code: 'PHQ9',
    name: 'PHQ-9',
    domain: 'depression',
    version: '1.0',
    language: 'es-ES',
    scoring_strategy: 'sum',
    source_reference: null,
    is_active: true,
    instructions_json: {},
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeInstance(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString()
  return {
    id: 'instance-1',
    user_id: 'user-1',
    session_id: 'session-1',
    conversation_id: 'conv-1',
    questionnaire_id: 'def-1',
    triggered_by: 'ai' as const,
    status: 'proposed' as const,
    trigger_reason: 'depression screening',
    started_at: null,
    submitted_at: null,
    scored_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function makeItems(count: number, questionnaireId = 'def-1') {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i + 1}`,
    questionnaire_id: questionnaireId,
    order_index: i + 1,
    prompt: `Item ${i + 1}`,
    response_type: 'scale',
    options_json: {},
    numeric_value_map_json: {},
    is_required: true,
    risk_flag_rule: null,
    created_at: new Date().toISOString(),
  }))
}

// ---------------------------------------------------------------------------
// createInstance
// ---------------------------------------------------------------------------

describe('createInstance', () => {
  it('inserts with triggered_by=ai, status=proposed', async () => {
    const definition = makeDefinition()
    const instance = makeInstance()

    let callCount = 0
    const chains: ReturnType<typeof makeChain>[] = []
    const fromMock = vi.fn(() => {
      callCount++
      const chain = makeChain({
        data: callCount === 1 ? definition : instance,
        error: null,
      })
      chains.push(chain)
      return chain
    })
    const supabase = { from: fromMock } as any

    const result = await createInstance(supabase, {
      userId: 'user-1',
      sessionId: 'session-1',
      conversationId: 'conv-1',
      questionnaireCode: 'PHQ9',
      triggerReason: 'depression screening',
    })

    expect(result).toEqual(instance)
    expect(fromMock).toHaveBeenNthCalledWith(1, 'questionnaire_definitions')
    expect(fromMock).toHaveBeenNthCalledWith(2, 'questionnaire_instances')
    expect(chains[1].insert).toHaveBeenCalledWith(
      expect.objectContaining({
        triggered_by: 'ai',
        status: 'proposed',
        user_id: 'user-1',
        session_id: 'session-1',
        conversation_id: 'conv-1',
        questionnaire_id: 'def-1',
        trigger_reason: 'depression screening',
      }),
    )
  })

  it('throws when definition lookup fails', async () => {
    const fromMock = vi.fn(() =>
      makeChain({ data: null, error: new Error('not found') }),
    )
    const supabase = { from: fromMock } as any

    await expect(
      createInstance(supabase, {
        userId: 'user-1',
        sessionId: 'session-1',
        conversationId: 'conv-1',
        questionnaireCode: 'PHQ9',
        triggerReason: 'test',
      }),
    ).rejects.toThrow('not found')
  })
})

// ---------------------------------------------------------------------------
// startInstance
// ---------------------------------------------------------------------------

describe('startInstance', () => {
  it('updates status to in_progress', async () => {
    const chain = makeChain({ data: null, error: null })
    const fromMock = vi.fn(() => chain)
    const supabase = { from: fromMock } as any

    await startInstance(supabase, 'instance-1')

    expect(fromMock).toHaveBeenCalledWith('questionnaire_instances')
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'in_progress',
        started_at: expect.any(String),
      }),
    )
    expect(chain.eq).toHaveBeenCalledWith('id', 'instance-1')
    expect(chain.eq).toHaveBeenCalledWith('status', 'proposed')
  })

  it('throws when update fails', async () => {
    const chain = makeChain({ data: null, error: new Error('update failed') })
    const fromMock = vi.fn(() => chain)
    const supabase = { from: fromMock } as any

    await expect(startInstance(supabase, 'instance-1')).rejects.toThrow('update failed')
  })
})

// ---------------------------------------------------------------------------
// getActiveInstanceForSession
// ---------------------------------------------------------------------------

describe('getActiveInstanceForSession', () => {
  it('returns null when no active instance', async () => {
    const chain = makeChain({ data: null, error: null })
    const fromMock = vi.fn(() => chain)
    const supabase = { from: fromMock } as any

    const result = await getActiveInstanceForSession(supabase, 'session-1')
    expect(result).toBeNull()
  })

  it('returns instance, definition, items, and result when found', async () => {
    const instance = makeInstance({ status: 'in_progress' })
    const definition = makeDefinition()
    const items = makeItems(9)
    const resultRow = {
      id: 'result-1',
      instance_id: 'instance-1',
      total_score: 5,
      severity_band: 'mild',
      subscores_json: {},
      flags_json: [],
      requires_review: false,
      interpretation_json: {},
      created_at: new Date().toISOString(),
    }

    let callCount = 0
    const fromMock = vi.fn(() => {
      callCount++
      if (callCount === 1) return makeChain({ data: instance, error: null })
      if (callCount === 2) return makeChain({ data: definition, error: null })
      if (callCount === 3) return makeChain({ data: items, error: null })
      return makeChain({ data: resultRow, error: null })
    })
    const supabase = { from: fromMock } as any

    const result = await getActiveInstanceForSession(supabase, 'session-1')
    expect(result).not.toBeNull()
    expect(result!.instance).toEqual(instance)
    expect(result!.definition).toEqual(definition)
    expect(result!.items).toEqual(items)
    expect(result!.result).toEqual(resultRow)
  })
})

// ---------------------------------------------------------------------------
// submitAnswers — PHQ9 score 15, item9=0 → moderately_severe, no risk_event
// ---------------------------------------------------------------------------

describe('submitAnswers', () => {
  it('PHQ9 score 15 with item9=0 → moderately_severe, inserts result, no risk_event', async () => {
    const instance = makeInstance()
    const definition = makeDefinition({ code: 'PHQ9' })
    // 9 items with order_index 1..9
    const items = makeItems(9)

    // Answers: 2+2+2+2+2+2+1+2+0 = 15, item9(index 8)=0 → no flag
    const answers = [
      { itemOrder: 1, valueNumeric: 2, valueRaw: '2' },
      { itemOrder: 2, valueNumeric: 2, valueRaw: '2' },
      { itemOrder: 3, valueNumeric: 2, valueRaw: '2' },
      { itemOrder: 4, valueNumeric: 2, valueRaw: '2' },
      { itemOrder: 5, valueNumeric: 2, valueRaw: '2' },
      { itemOrder: 6, valueNumeric: 2, valueRaw: '2' },
      { itemOrder: 7, valueNumeric: 1, valueRaw: '1' },
      { itemOrder: 8, valueNumeric: 2, valueRaw: '2' },
      { itemOrder: 9, valueNumeric: 0, valueRaw: '0' },
    ]

    let callCount = 0
    const chains: ReturnType<typeof makeChain>[] = []
    const fromMock = vi.fn(() => {
      callCount++
      // 1: fetch instance, 2: fetch definition, 3: fetch items,
      // 4: insert answers, 5: insert result, 6: update instance
      const chain = makeChain({
        data:
          callCount === 1 ? instance
          : callCount === 2 ? definition
          : callCount === 3 ? items
          : null,
        error: null,
      })
      chains.push(chain)
      return chain
    })
    const supabase = { from: fromMock } as any

    const result = await submitAnswers(supabase, { instanceId: 'instance-1', answers })

    expect(result.totalScore).toBe(15)
    expect(result.severityBand).toBe('moderately_severe')
    expect(result.flags).toHaveLength(0)
    expect(result.requiresReview).toBe(false)

    // Calls: instance, definition, items, answers insert, result insert, instance update
    // No risk_event because no flags
    expect(fromMock).toHaveBeenCalledTimes(6)

    // Check result insert had correct band
    expect(chains[4].insert).toHaveBeenCalledWith(
      expect.objectContaining({
        severity_band: 'moderately_severe',
        total_score: 15,
        requires_review: false,
      }),
    )
  })

  it('PHQ9 with item9=2 → inserts risk_event with severity high', async () => {
    const instance = makeInstance()
    const definition = makeDefinition({ code: 'PHQ9' })
    const items = makeItems(9)

    // items: 2+2+2+2+2+2+1+2+2 = 17, item9=2 → suicidality flag
    const answers = [
      { itemOrder: 1, valueNumeric: 2, valueRaw: '2' },
      { itemOrder: 2, valueNumeric: 2, valueRaw: '2' },
      { itemOrder: 3, valueNumeric: 2, valueRaw: '2' },
      { itemOrder: 4, valueNumeric: 2, valueRaw: '2' },
      { itemOrder: 5, valueNumeric: 2, valueRaw: '2' },
      { itemOrder: 6, valueNumeric: 2, valueRaw: '2' },
      { itemOrder: 7, valueNumeric: 1, valueRaw: '1' },
      { itemOrder: 8, valueNumeric: 2, valueRaw: '2' },
      { itemOrder: 9, valueNumeric: 2, valueRaw: '2' },
    ]

    let callCount = 0
    const chains: ReturnType<typeof makeChain>[] = []
    const fromMock = vi.fn(() => {
      callCount++
      const chain = makeChain({
        data:
          callCount === 1 ? instance
          : callCount === 2 ? definition
          : callCount === 3 ? items
          : null,
        error: null,
      })
      chains.push(chain)
      return chain
    })
    const supabase = { from: fromMock } as any

    const result = await submitAnswers(supabase, { instanceId: 'instance-1', answers })

    expect(result.flags).toHaveLength(1)
    expect(result.flags[0].reason).toBe('suicidality')

    // 7 calls: instance, definition, items, answers, result, update instance, risk_event
    expect(fromMock).toHaveBeenCalledTimes(7)
    expect(fromMock).toHaveBeenNthCalledWith(7, 'risk_events')
    expect(chains[6].insert).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'high',
        risk_type: 'suicidal_ideation',
        source_type: 'questionnaire',
      }),
    )
  })

  it('ASQ acute → inserts risk_event with severity critical', async () => {
    const instance = makeInstance({ questionnaire_id: 'def-asq' })
    const definition = makeDefinition({ id: 'def-asq', code: 'ASQ', domain: 'risk' })
    const items = makeItems(5, 'def-asq')

    // [1,0,0,0,1] → positive + acute_risk flag
    const answers = [
      { itemOrder: 1, valueNumeric: 1, valueRaw: '1' },
      { itemOrder: 2, valueNumeric: 0, valueRaw: '0' },
      { itemOrder: 3, valueNumeric: 0, valueRaw: '0' },
      { itemOrder: 4, valueNumeric: 0, valueRaw: '0' },
      { itemOrder: 5, valueNumeric: 1, valueRaw: '1' },
    ]

    let callCount = 0
    const chains: ReturnType<typeof makeChain>[] = []
    const fromMock = vi.fn(() => {
      callCount++
      const chain = makeChain({
        data:
          callCount === 1 ? instance
          : callCount === 2 ? definition
          : callCount === 3 ? items
          : null,
        error: null,
      })
      chains.push(chain)
      return chain
    })
    const supabase = { from: fromMock } as any

    const result = await submitAnswers(supabase, { instanceId: 'instance-1', answers })

    expect(result.severityBand).toBe('positive')
    expect(result.flags).toHaveLength(1)
    expect(result.flags[0].reason).toBe('acute_risk')

    // 7 calls: instance, definition, items, answers, result, update instance, risk_event
    expect(fromMock).toHaveBeenCalledTimes(7)
    expect(fromMock).toHaveBeenNthCalledWith(7, 'risk_events')
    expect(chains[6].insert).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'critical',
        risk_type: 'suicidal_ideation',
        source_type: 'questionnaire',
      }),
    )
  })

  it('ASQ positive without acute → inserts risk_event with severity high', async () => {
    const instance = makeInstance({ questionnaire_id: 'def-asq' })
    const definition = makeDefinition({ id: 'def-asq', code: 'ASQ', domain: 'risk' })
    const items = makeItems(4, 'def-asq')

    // [1,0,0,0] → positive, no acute flag (only 4 answers submitted)
    const answers = [
      { itemOrder: 1, valueNumeric: 1, valueRaw: '1' },
      { itemOrder: 2, valueNumeric: 0, valueRaw: '0' },
      { itemOrder: 3, valueNumeric: 0, valueRaw: '0' },
      { itemOrder: 4, valueNumeric: 0, valueRaw: '0' },
    ]

    let callCount = 0
    const chains: ReturnType<typeof makeChain>[] = []
    const fromMock = vi.fn(() => {
      callCount++
      const chain = makeChain({
        data:
          callCount === 1 ? instance
          : callCount === 2 ? definition
          : callCount === 3 ? items
          : null,
        error: null,
      })
      chains.push(chain)
      return chain
    })
    const supabase = { from: fromMock } as any

    const result = await submitAnswers(supabase, { instanceId: 'instance-1', answers })

    expect(result.severityBand).toBe('positive')
    expect(result.flags).toHaveLength(0)

    // 7 calls: instance, definition, items, answers, result, update instance, risk_event
    expect(fromMock).toHaveBeenCalledTimes(7)
    expect(fromMock).toHaveBeenNthCalledWith(7, 'risk_events')
    expect(chains[6].insert).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'high',
        risk_type: 'suicidal_ideation',
        source_type: 'questionnaire',
      }),
    )
  })
})
