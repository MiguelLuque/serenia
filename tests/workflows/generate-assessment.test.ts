import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks (must be hoisted so module-init time imports use them)
// ---------------------------------------------------------------------------

const { generateObjectMock, createServiceRoleClientMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn(),
  createServiceRoleClientMock: vi.fn(),
}))

vi.mock('ai', () => ({
  generateObject: generateObjectMock,
}))

vi.mock('@/lib/llm/models', () => ({
  llm: { structured: () => 'openai/gpt-5.4' },
}))

vi.mock('@/lib/llm/prompts/loader', () => ({
  loadPromptFromMarkdown: () => 'SYSTEM PROMPT',
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: createServiceRoleClientMock,
}))

// 'use workflow' / 'use step' directives are no-op string literals at runtime
// outside the WDK plugin context — invoking the workflow function directly in
// vitest just runs each step inline as a regular async function. That's what
// we want for unit testing the orchestration logic (retry → manual_review,
// idempotency short-circuits, FatalError flow, etc.). The actual durable
// retry machinery is owned by `@workflow/core` and out of scope here.
import { generateAssessmentWorkflow } from '@/lib/workflows/generate-assessment'

// ---------------------------------------------------------------------------
// Supabase mock helpers
// ---------------------------------------------------------------------------

type QueryResult = { data: unknown; error: unknown }

/**
 * Build a chainable, awaitable Supabase query mock that resolves with the
 * given { data, error } shape. All filter/select methods return the same
 * chain so any combination of `.eq().order().limit()` etc. works.
 */
function makeChain(result: QueryResult) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select',
    'insert',
    'update',
    'delete',
    'upsert',
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
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
  ) => Promise.resolve(result).then(resolve, reject)
  return chain
}

type TableSpec = {
  /** Default result for any chain on this table. */
  rows?: unknown
  error?: unknown
  /** Override per-method result (e.g. distinguish select vs insert). */
  insertResult?: QueryResult
}

/**
 * Build a Supabase client mock keyed by table name. `assessments` gets a
 * special handler that distinguishes the existence check (select) from the
 * persist insert so the workflow can hit both paths in the same run.
 */
function makeSupabase(tables: Record<string, TableSpec>) {
  const fromMock = vi.fn((name: string) => {
    const spec = tables[name] ?? {}

    if (name === 'assessments') {
      let mode: 'read' | 'write' = 'read'
      const chain: Record<string, unknown> = {}
      const passthrough = () => chain
      chain.select = vi.fn(passthrough)
      chain.insert = vi.fn((row: unknown) => {
        mode = 'write'
        ;(chain as { _insertedRow: unknown })._insertedRow = row
        return chain
      })
      chain.eq = vi.fn(passthrough)
      chain.neq = vi.fn(passthrough)
      chain.in = vi.fn(passthrough)
      chain.not = vi.fn(passthrough)
      chain.maybeSingle = vi.fn(() =>
        Promise.resolve({ data: spec.rows ?? null, error: spec.error ?? null }),
      )
      // Make insert chain awaitable — workflow does `await supabase.from('assessments').insert(...)`
      ;(chain as { then: unknown }).then = (
        resolve: (v: unknown) => unknown,
        reject?: (e: unknown) => unknown,
      ) => {
        if (mode === 'write') {
          const result = spec.insertResult ?? { data: null, error: null }
          return Promise.resolve(result).then(resolve, reject)
        }
        return Promise.resolve({ data: spec.rows ?? null, error: spec.error ?? null }).then(
          resolve,
          reject,
        )
      }
      return chain
    }

    return makeChain({ data: spec.rows ?? null, error: spec.error ?? null })
  })

  return { from: fromMock }
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    user_id: 'user-1',
    conversation_id: 'conv-1',
    status: 'closed',
    closure_reason: 'user_request',
    ...overrides,
  }
}

function makeMessages(userCount: number) {
  return Array.from({ length: userCount * 2 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    parts: [{ type: 'text', text: `msg ${i}` }],
    created_at: new Date(Date.now() + i).toISOString(),
  }))
}

const summaryResult = {
  chief_complaint: 'Tristeza persistente',
  presenting_issues: ['ánimo bajo'],
  mood_affect: 'deprimido',
  cognitive_patterns: ['rumiación'],
  risk_assessment: { suicidality: 'none', self_harm: 'none', notes: '' },
  questionnaires: [],
  areas_for_exploration: ['antecedentes familiares'],
  preliminary_impression: 'Sintomatología consistente con ánimo bajo leve.',
  recommended_actions_for_clinician: ['seguimiento en 1 semana'],
  patient_facing_summary: 'Gracias por compartir esto hoy.',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  generateObjectMock.mockReset()
  createServiceRoleClientMock.mockReset()
})

describe('generateAssessmentWorkflow', () => {
  it('happy path: inserts draft_ai assessment with the generated summary', async () => {
    generateObjectMock.mockResolvedValue({
      object: summaryResult,
      usage: { inputTokens: 100, outputTokens: 200 },
    })

    const supabase = makeSupabase({
      clinical_sessions: { rows: makeSession() },
      assessments: { rows: null }, // existence check returns null
      messages: { rows: makeMessages(4) },
      questionnaire_instances: { rows: [] },
      risk_events: { rows: [] },
    })
    createServiceRoleClientMock.mockReturnValue(supabase)

    const result = await generateAssessmentWorkflow({ sessionId: 'session-1' })

    expect(result).toEqual({ status: 'completed' })
    expect(generateObjectMock).toHaveBeenCalledOnce()

    // Verify the persist insert shape
    const assessmentsCalls = supabase.from.mock.calls.filter(
      ([name]) => name === 'assessments',
    )
    expect(assessmentsCalls.length).toBeGreaterThanOrEqual(2) // existence check + insert

    const assessmentChains = supabase.from.mock.results
      .filter((_r, i) => supabase.from.mock.calls[i][0] === 'assessments')
      .map((r) => r.value as { insert: ReturnType<typeof vi.fn>; _insertedRow?: unknown })
    const insertCall = assessmentChains.find((c) => c.insert.mock.calls.length > 0)
    expect(insertCall).toBeDefined()
    expect(insertCall!.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        session_id: 'session-1',
        assessment_type: 'closure',
        status: 'draft_ai',
        generated_by: 'ai',
        summary_json: summaryResult,
      }),
    )
  })

  it('idempotent: bails with already_exists when an assessment row already exists', async () => {
    const supabase = makeSupabase({
      clinical_sessions: { rows: makeSession() },
      assessments: { rows: { id: 'existing-assessment' } }, // existence check returns a row
    })
    createServiceRoleClientMock.mockReturnValue(supabase)

    const result = await generateAssessmentWorkflow({ sessionId: 'session-1' })

    expect(result).toEqual({ status: 'skipped', reason: 'already_exists' })
    // The LLM must not be invoked when we short-circuit on existence.
    expect(generateObjectMock).not.toHaveBeenCalled()
  })

  // T-B blocker 1d: a `requires_manual_review` row is "live" — it must block
  // a SPONTANEOUS spawn of the workflow (e.g. cron retry firing on the same
  // session). The explicit regenerate path (`prepareRegeneration`) handles
  // it correctly because it flips the row to `superseded` BEFORE enqueueing
  // the workflow, so by the time `assessmentExistsStep` runs there is no
  // live row left. This test pins both sides of that contract.
  it('T-B: requires_manual_review row blocks a spontaneous workflow run', async () => {
    const supabase = makeSupabase({
      clinical_sessions: { rows: makeSession() },
      // The assessmentExistsStep query filters status NOT IN
      // (superseded,rejected); a requires_manual_review row PASSES that
      // filter and so the existence check returns truthy.
      assessments: { rows: { id: 'manual-review-row' } },
    })
    createServiceRoleClientMock.mockReturnValue(supabase)

    const result = await generateAssessmentWorkflow({ sessionId: 'session-1' })

    expect(result).toEqual({ status: 'skipped', reason: 'already_exists' })
    expect(generateObjectMock).not.toHaveBeenCalled()
  })

  it('T-B: explicit regenerate from requires_manual_review proceeds (row was flipped to superseded by prepareRegeneration)', async () => {
    // Simulate the post-prepareRegeneration state: the manual-review row is
    // now superseded, so the live-status filter excludes it and the
    // existence check returns null. This is the contract that makes the
    // regenerate-from-manual-review path work end-to-end.
    generateObjectMock.mockResolvedValue({
      object: summaryResult,
      usage: { inputTokens: 5, outputTokens: 5 },
    })
    const supabase = makeSupabase({
      clinical_sessions: { rows: makeSession() },
      assessments: { rows: null }, // post-flip: no live row
      messages: { rows: makeMessages(4) },
      questionnaire_instances: { rows: [] },
      risk_events: { rows: [] },
    })
    createServiceRoleClientMock.mockReturnValue(supabase)

    const result = await generateAssessmentWorkflow({
      sessionId: 'session-1',
      rejectionContext: {
        // requires_manual_review rows have no rejection_reason; pass empty
        // string + null clinical_notes — the prompt section is still added.
        rejectionReason: '',
        clinicalNotes: null,
      },
    })

    expect(result).toEqual({ status: 'completed' })
    expect(generateObjectMock).toHaveBeenCalledOnce()
  })

  it('skips with no_session when the session is missing or still open', async () => {
    const supabase = makeSupabase({
      clinical_sessions: { rows: null },
    })
    createServiceRoleClientMock.mockReturnValue(supabase)

    const result = await generateAssessmentWorkflow({ sessionId: 'session-1' })
    expect(result).toEqual({ status: 'skipped', reason: 'no_session' })
    expect(generateObjectMock).not.toHaveBeenCalled()
  })

  it('skips with no_session when session exists but is still open', async () => {
    const supabase = makeSupabase({
      clinical_sessions: { rows: makeSession({ status: 'open' }) },
    })
    createServiceRoleClientMock.mockReturnValue(supabase)

    const result = await generateAssessmentWorkflow({ sessionId: 'session-1' })
    expect(result).toEqual({ status: 'skipped', reason: 'no_session' })
    expect(generateObjectMock).not.toHaveBeenCalled()
  })

  it('retry → manual_review: persists requires_manual_review when the LLM keeps failing', async () => {
    // Simulate WDK-exhausted retries: from the workflow body's perspective, the
    // step throws once (the catch sees a single error after WDK has retried).
    const llmError = new Error('LLM 5xx upstream timeout')
    generateObjectMock.mockRejectedValue(llmError)

    const supabase = makeSupabase({
      clinical_sessions: { rows: makeSession() },
      assessments: { rows: null },
      messages: { rows: makeMessages(4) },
      questionnaire_instances: { rows: [] },
      risk_events: { rows: [] },
    })
    createServiceRoleClientMock.mockReturnValue(supabase)

    const result = await generateAssessmentWorkflow({ sessionId: 'session-1' })

    expect(result).toEqual({
      status: 'manual_review',
      error: 'LLM 5xx upstream timeout',
    })

    // Verify a single requires_manual_review insert with the failure payload.
    const assessmentChains = supabase.from.mock.results
      .filter((_r, i) => supabase.from.mock.calls[i][0] === 'assessments')
      .map((r) => r.value as { insert: ReturnType<typeof vi.fn> })
    const insertCalls = assessmentChains.flatMap((c) => c.insert.mock.calls)
    expect(insertCalls).toHaveLength(1)
    const inserted = insertCalls[0][0] as Record<string, unknown>
    expect(inserted.status).toBe('requires_manual_review')
    expect(inserted.session_id).toBe('session-1')
    expect(inserted.user_id).toBe('user-1')
    expect(inserted.assessment_type).toBe('closure')
    expect(inserted.generated_by).toBe('ai')
    const failure = inserted.summary_json as {
      generation_failure: { error: string; occurred_at: string }
    }
    expect(failure.generation_failure.error).toBe('LLM 5xx upstream timeout')
    expect(failure.generation_failure.occurred_at).toEqual(expect.any(String))
  })

  it('FatalError path (session too short): persists requires_manual_review with the FatalError message', async () => {
    // Only 1 user message → step throws FatalError before the LLM is called.
    const supabase = makeSupabase({
      clinical_sessions: { rows: makeSession() },
      assessments: { rows: null },
      messages: { rows: makeMessages(1) },
      questionnaire_instances: { rows: [] },
      risk_events: { rows: [] },
    })
    createServiceRoleClientMock.mockReturnValue(supabase)

    const result = await generateAssessmentWorkflow({ sessionId: 'session-1' })

    expect(generateObjectMock).not.toHaveBeenCalled()
    expect(result.status).toBe('manual_review')
    expect((result as { status: 'manual_review'; error: string }).error).toMatch(
      /only 1 user messages/,
    )

    const assessmentChains = supabase.from.mock.results
      .filter((_r, i) => supabase.from.mock.calls[i][0] === 'assessments')
      .map((r) => r.value as { insert: ReturnType<typeof vi.fn> })
    const insertCalls = assessmentChains.flatMap((c) => c.insert.mock.calls)
    expect(insertCalls).toHaveLength(1)
    const inserted = insertCalls[0][0] as Record<string, unknown>
    expect(inserted.status).toBe('requires_manual_review')
    const failure = inserted.summary_json as {
      generation_failure: { error: string }
    }
    expect(failure.generation_failure.error).toMatch(/only 1 user messages/)
  })

  // ── T-B: assessmentExistsStep filters by live status ──────────────────────
  // The existence check must IGNORE rows with status in ('superseded',
  // 'rejected'); otherwise rejecting a draft + enqueueing regeneration would
  // hit `already_exists` and the new draft would never persist. This test
  // asserts the filter is in the query (the supabase mock records `.not(…)`
  // calls) AND that when the stub returns null for the live-row check the
  // workflow proceeds to generation.
  it('T-B: assessmentExistsStep filters by status NOT IN (superseded, rejected) and proceeds to generation when only rejected/superseded rows exist', async () => {
    generateObjectMock.mockResolvedValue({
      object: summaryResult,
      usage: { inputTokens: 10, outputTokens: 20 },
    })

    // The mock returns null because the live-status filter excludes the
    // pre-existing rejected row. If the filter were missing, the test
    // setup would have to choose between simulating the rejected row
    // (causing `already_exists`) or hiding it (passing trivially).
    const supabase = makeSupabase({
      clinical_sessions: { rows: makeSession() },
      assessments: { rows: null },
      messages: { rows: makeMessages(4) },
      questionnaire_instances: { rows: [] },
      risk_events: { rows: [] },
    })
    createServiceRoleClientMock.mockReturnValue(supabase)

    const result = await generateAssessmentWorkflow({
      sessionId: 'session-1',
      rejectionContext: {
        rejectionReason: 'No refleja la transcripción',
        clinicalNotes: 'Profundizar en duelo reciente',
      },
    })

    expect(result).toEqual({ status: 'completed' })

    // Confirm the filter was actually applied — the existence-check chain
    // must have called `.not('status', 'in', …)` with the live-row exclusion.
    const assessmentChains = supabase.from.mock.results
      .filter((_r, i) => supabase.from.mock.calls[i][0] === 'assessments')
      .map((r) => r.value as { not?: ReturnType<typeof vi.fn> })
    const notCalls = assessmentChains.flatMap((c) => c.not?.mock.calls ?? [])
    expect(notCalls.length).toBeGreaterThanOrEqual(1)
    const [column, op, value] = notCalls[0] as [string, string, string]
    expect(column).toBe('status')
    expect(op).toBe('in')
    expect(value).toContain('superseded')
    expect(value).toContain('rejected')
  })

  it('T-B: passes rejectionContext into the user prompt of generateObject', async () => {
    generateObjectMock.mockResolvedValue({
      object: summaryResult,
      usage: { inputTokens: 10, outputTokens: 20 },
    })

    const supabase = makeSupabase({
      clinical_sessions: { rows: makeSession() },
      assessments: { rows: null },
      messages: { rows: makeMessages(4) },
      questionnaire_instances: { rows: [] },
      risk_events: { rows: [] },
    })
    createServiceRoleClientMock.mockReturnValue(supabase)

    await generateAssessmentWorkflow({
      sessionId: 'session-1',
      rejectionContext: {
        rejectionReason: 'Falta detalle del riesgo de autolesión',
        clinicalNotes: 'Paciente reporta cortes superficiales recientes',
      },
    })

    const promptArg = generateObjectMock.mock.calls[0][0] as { prompt: string }
    expect(promptArg.prompt).toContain('Contexto de regeneración')
    expect(promptArg.prompt).toContain('Falta detalle del riesgo de autolesión')
    expect(promptArg.prompt).toContain(
      'Paciente reporta cortes superficiales recientes',
    )
  })

  it('manual_review insert idempotency: unique-violation (23505) is treated as success', async () => {
    generateObjectMock.mockRejectedValue(new Error('LLM unavailable'))

    const supabase = makeSupabase({
      clinical_sessions: { rows: makeSession() },
      assessments: {
        rows: null, // existence check returns null
        insertResult: {
          data: null,
          error: { code: '23505', message: 'duplicate key value' },
        },
      },
      messages: { rows: makeMessages(4) },
      questionnaire_instances: { rows: [] },
      risk_events: { rows: [] },
    })
    createServiceRoleClientMock.mockReturnValue(supabase)

    // Should not throw despite the unique-violation on the manual_review insert.
    const result = await generateAssessmentWorkflow({ sessionId: 'session-1' })

    expect(result.status).toBe('manual_review')
    expect((result as { status: 'manual_review'; error: string }).error).toBe(
      'LLM unavailable',
    )
  })
})
