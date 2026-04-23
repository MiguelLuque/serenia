import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { assemblePlan6ContextPieces } from '@/lib/chat/assemble-plan6-prompt'
import { buildChatSystemPrompt } from '@/lib/chat/system-prompt'
import type { PatientContext } from '@/lib/patient-context/builder'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-04-22T12:00:00Z')

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
}

const baseRisk = { suicidality: 'none' as const, self_harm: 'none' as const, notes: '' }

function makeNoneCtx(overrides: Partial<PatientContext> = {}): PatientContext {
  return {
    tier: 'none',
    isFirstSession: true,
    patient: { displayName: null, age: null },
    validated: null,
    tierBDraft: null,
    recentQuestionnaires: [],
    openRiskEvents: [],
    previousSession: null,
    pendingTasks: [],
    sessionNumber: 1,
    riskState: 'none',
    ...overrides,
  }
}

function makeTierACtx(overrides: Partial<PatientContext> = {}): PatientContext {
  return {
    tier: 'tierA',
    isFirstSession: false,
    patient: { displayName: 'Ana López', age: 30 },
    validated: {
      id: 'assessment-tierA',
      reviewedAt: daysAgo(10),
      summary: {
        chief_complaint: 'Ansiedad persistente.',
        presenting_issues: ['insomnio'],
        areas_for_exploration: ['dinámica familiar'],
        risk_assessment: baseRisk,
        questionnaires: [],
      },
      ageInDays: 10,
    },
    tierBDraft: null,
    recentQuestionnaires: [],
    openRiskEvents: [],
    previousSession: { closedAt: daysAgo(7), closureReason: null, daysAgo: 7 },
    pendingTasks: [
      { id: 't1', descripcion: 'Respiración', estado: 'pendiente', acordadaEn: daysAgo(7) },
      { id: 't2', descripcion: 'Diario', estado: 'parcial', acordadaEn: daysAgo(5) },
    ],
    sessionNumber: 3,
    riskState: 'none',
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('assemblePlan6ContextPieces — tier=none (first session)', () => {
  it('produces a first-session block, empty risk notice, and tier=none telemetry', () => {
    const ctx = makeNoneCtx()
    const { patientContextBlock, riskOpeningNotice, telemetry } = assemblePlan6ContextPieces(ctx, NOW)

    expect(patientContextBlock).toContain('[CONTEXTO DEL PACIENTE — primera sesión]')
    expect(patientContextBlock).toContain('postura de intake habitual')
    expect(riskOpeningNotice).toBe('')

    expect(telemetry).toEqual({
      tier: 'none',
      riskState: 'none',
      blockCharCount: patientContextBlock.length,
      pendingTasksCount: 0,
      riskTriggered: false,
      lastValidatedAssessmentId: null,
      truncatedSections: [],
    })
  })
})

describe('assemblePlan6ContextPieces — tier=tierA with riskState=watch', () => {
  it('includes a full context block and the watch continuity notice; telemetry is populated', () => {
    const ctx = makeTierACtx({ riskState: 'watch' })
    const { patientContextBlock, riskOpeningNotice, telemetry } = assemblePlan6ContextPieces(ctx, NOW)

    // Context block includes patient name, session number, and tier-A header.
    expect(patientContextBlock).toContain('Ana López')
    expect(patientContextBlock).toContain('Sesión nº 3')
    expect(patientContextBlock).toContain('última revisión clínica de hace 10 días')

    // Risk notice is the exact "watch" string.
    expect(riskOpeningNotice).toContain('[AVISO DE CONTINUIDAD — VIGILANCIA]')
    expect(riskOpeningNotice.length).toBeGreaterThan(0)

    expect(telemetry.tier).toBe('tierA')
    expect(telemetry.riskState).toBe('watch')
    expect(telemetry.riskTriggered).toBe(true)
    expect(telemetry.pendingTasksCount).toBe(2)
    expect(telemetry.lastValidatedAssessmentId).toBe('assessment-tierA')
    expect(telemetry.truncatedSections).toEqual([])
    expect(telemetry.blockCharCount).toBe(patientContextBlock.length)
  })

  it('riskState=none produces empty riskOpeningNotice and riskTriggered=false', () => {
    const ctx = makeTierACtx({ riskState: 'none' })
    const { riskOpeningNotice, telemetry } = assemblePlan6ContextPieces(ctx, NOW)

    expect(riskOpeningNotice).toBe('')
    expect(telemetry.riskTriggered).toBe(false)
  })

  it('riskState=acute surfaces the acute continuity notice', () => {
    const ctx = makeTierACtx({ riskState: 'acute' })
    const { riskOpeningNotice, telemetry } = assemblePlan6ContextPieces(ctx, NOW)

    expect(riskOpeningNotice).toContain('[AVISO DE CONTINUIDAD — RIESGO AGUDO]')
    expect(telemetry.riskTriggered).toBe(true)
    expect(telemetry.riskState).toBe('acute')
  })
})

describe('assemblePlan6ContextPieces — retake hint integration', () => {
  it('injects the retake hint as a bullet INSIDE the Instructions section (not below the separator)', () => {
    // PHQ-9 score=18 (severe) scored 10 days ago → severe rule fires (>7 days).
    const ctx = makeTierACtx({
      recentQuestionnaires: [
        {
          code: 'PHQ9',
          score: 18,
          band: 'severe',
          scoredAt: daysAgo(10),
          deltaVsPrevious: null,
        },
      ],
    })
    const { patientContextBlock } = assemblePlan6ContextPieces(ctx, NOW)

    expect(patientContextBlock).toContain('PHQ-9 del paciente era severo')

    const hintIndex = patientContextBlock.indexOf('el PHQ-9 del paciente era severo')
    const instructionsIndex = patientContextBlock.indexOf('Instrucciones para esta sesión:')
    const finalSeparatorIndex = patientContextBlock.lastIndexOf('\n\n---')

    expect(hintIndex).toBeGreaterThan(instructionsIndex)
    // Must be inside Instructions, i.e. before the closing separator.
    expect(hintIndex).toBeLessThan(finalSeparatorIndex)
    // Must be rendered as a bullet.
    expect(patientContextBlock).toContain('- el PHQ-9 del paciente era severo')
  })

  it('omits the hint line when no retake rule fires', () => {
    const ctx = makeTierACtx() // no questionnaires → no hint
    const { patientContextBlock } = assemblePlan6ContextPieces(ctx, NOW)

    expect(patientContextBlock).not.toContain('considera proponerlo de nuevo')
    expect(patientContextBlock).not.toContain('re-administrarlo')
  })
})

describe('assemblePlan6ContextPieces — truncatedSections propagation', () => {
  it('bubbles up the truncatedSections from renderPatientContextBlockWithMeta', () => {
    // Huge summary to trip step 1+2 of truncation (mirrors render.test.ts huge-truncation fixture).
    const hugeCc = 'X'.repeat(400)
    const hugePresenting = Array.from({ length: 10 }, (_, i) => `Síntoma ${i}: ${'A'.repeat(120)}`)
    const hugeAreas = Array.from({ length: 10 }, (_, i) => `Área ${i}: ${'B'.repeat(120)}`)
    const heavyTasks = Array.from({ length: 5 }, (_, i) => ({
      id: `t-${i}`,
      descripcion: `Tarea pesada número ${i}: ${'T'.repeat(90)}`,
      estado: 'pendiente' as const,
      acordadaEn: daysAgo(i + 1),
    }))

    const ctx = makeTierACtx({
      validated: {
        id: 'assessment-trunc',
        reviewedAt: daysAgo(10),
        summary: {
          chief_complaint: hugeCc,
          presenting_issues: hugePresenting,
          areas_for_exploration: hugeAreas,
          risk_assessment: baseRisk,
          questionnaires: [],
        },
        ageInDays: 10,
      },
      pendingTasks: heavyTasks,
    })

    const { telemetry } = assemblePlan6ContextPieces(ctx, NOW)
    expect(telemetry.truncatedSections).toEqual(['areas_for_exploration', 'presenting_issues'])
  })
})

// ── Plan-mandated integration scenarios (plan line 582-586) ─────────────────

describe('buildChatSystemPrompt — plan-mandated system-prompt ordering', () => {
  const BASE = 'BASE_PROMPT_TOKEN\n\n'
  const RISK = '[AVISO DE CONTINUIDAD — RIESGO ACTIVO] RISK_BODY\n\n---\n\n'
  const CRISIS = '[AVISO DE SEGURIDAD — ALERTA ACTIVADA]\nCRISIS_BODY\n\n---\n\n'
  const QNAIRE = '[RESULTADO DE CUESTIONARIO — PHQ9]\nQ_BODY\n\n---\n\n'
  const TIME = '[AVISO DE TIEMPO]\nTIME_BODY\n\n---\n\n'
  const BLOCK = '[CONTEXTO DEL PACIENTE — primera sesión]\nBLOCK_BODY\n\n---'

  it('concatenates in the exact plan order: base → risk → crisis → questionnaire → time → block', () => {
    const prompt = buildChatSystemPrompt({
      basePrompt: BASE,
      riskOpeningNotice: RISK,
      crisisNotice: CRISIS,
      questionnaireNotice: QNAIRE,
      timeNotice: TIME,
      patientContextBlock: BLOCK,
    })

    const baseIdx = prompt.indexOf('BASE_PROMPT_TOKEN')
    const riskIdx = prompt.indexOf('RISK_BODY')
    const crisisIdx = prompt.indexOf('CRISIS_BODY')
    const qnaireIdx = prompt.indexOf('Q_BODY')
    const timeIdx = prompt.indexOf('TIME_BODY')
    const blockIdx = prompt.indexOf('BLOCK_BODY')

    expect(baseIdx).toBeLessThan(riskIdx)
    expect(riskIdx).toBeLessThan(crisisIdx)
    expect(crisisIdx).toBeLessThan(qnaireIdx)
    expect(qnaireIdx).toBeLessThan(timeIdx)
    expect(timeIdx).toBeLessThan(blockIdx)
  })

  it('flag-off semantics: empty block + empty risk → prompt is basePrompt + per-turn notices, no Plan-6 artifacts', () => {
    // Plan line 583: "Flag off → system prompt idéntico al pre-Plan-6."
    // The pre-Plan-6 assembly was basePrompt concatenated with crisisNotice, questionnaireNotice, timeNotice.
    // With Plan-6 pieces empty, buildChatSystemPrompt must produce a string byte-equal to the pre-Plan-6 assembly.
    const flagOff = buildChatSystemPrompt({
      basePrompt: BASE,
      riskOpeningNotice: '',
      crisisNotice: CRISIS,
      questionnaireNotice: QNAIRE,
      timeNotice: TIME,
      patientContextBlock: '',
    })

    expect(flagOff).toBe(BASE + CRISIS + QNAIRE + TIME)
    expect(flagOff).not.toContain('[AVISO DE CONTINUIDAD')
    expect(flagOff).not.toContain('[CONTEXTO DEL PACIENTE')
  })

  it('risk + crisis adjacent do not glue onto the same line (separator fix)', () => {
    // Regression: before the T10 fix, riskOpeningNotice ended with "." and
    // crisisNotice started with "[AVISO DE SEGURIDAD …", producing
    // "…de riesgo.[AVISO DE SEGURIDAD…" on the same line. The separator fix
    // appends "\n\n---\n\n" to every risk notice.
    const prompt = buildChatSystemPrompt({
      basePrompt: BASE,
      riskOpeningNotice: RISK,
      crisisNotice: CRISIS,
      questionnaireNotice: '',
      timeNotice: '',
      patientContextBlock: '',
    })

    expect(prompt).not.toMatch(/riesgo\.\[AVISO DE SEGURIDAD/)
    // Risk block must be terminated by the project separator before crisis starts.
    expect(prompt).toContain('\n\n---\n\n[AVISO DE SEGURIDAD')
  })
})

// ── logContextInjection — writes one row via service role ───────────────────

describe('logContextInjection — plan line 586 ("una fila escrita")', () => {
  // Mock the service-role client so the assertion runs without a live DB.
  const insertMock = vi.fn()
  const fromMock = vi.fn(() => ({ insert: insertMock }))

  beforeEach(() => {
    insertMock.mockReset()
    insertMock.mockResolvedValue({ error: null })
    fromMock.mockClear()
    vi.resetModules()
    vi.doMock('@/lib/supabase/server', () => ({
      createServiceRoleClient: () => ({ from: fromMock }),
    }))
  })

  afterEach(() => {
    vi.doUnmock('@/lib/supabase/server')
  })

  it('inserts exactly one row into patient_context_injections with the full telemetry payload', async () => {
    const { logContextInjection } = await import('@/lib/patient-context/telemetry')

    await logContextInjection({
      userId: 'user-1',
      sessionId: 'session-1',
      tier: 'tierA',
      riskState: 'watch',
      blockCharCount: 1234,
      pendingTasksCount: 2,
      riskTriggered: true,
      lastValidatedAssessmentId: 'assessment-tierA',
      truncatedSections: ['areas_for_exploration'],
    })

    expect(fromMock).toHaveBeenCalledTimes(1)
    expect(fromMock).toHaveBeenCalledWith('patient_context_injections')
    expect(insertMock).toHaveBeenCalledTimes(1)
    expect(insertMock).toHaveBeenCalledWith({
      user_id: 'user-1',
      session_id: 'session-1',
      tier: 'tierA',
      risk_state: 'watch',
      block_char_count: 1234,
      pending_tasks_count: 2,
      risk_triggered: true,
      last_validated_assessment_id: 'assessment-tierA',
      truncated_sections: ['areas_for_exploration'],
    })
  })

  it('propagates insert errors so the caller can .catch them (fire-and-forget semantics)', async () => {
    insertMock.mockResolvedValue({ error: new Error('RLS violation') })
    const { logContextInjection } = await import('@/lib/patient-context/telemetry')

    await expect(
      logContextInjection({
        userId: 'u',
        sessionId: 's',
        tier: 'none',
        riskState: 'none',
        blockCharCount: 0,
        pendingTasksCount: 0,
        riskTriggered: false,
        lastValidatedAssessmentId: null,
        truncatedSections: [],
      }),
    ).rejects.toThrow('RLS violation')
  })
})

// ── Graceful degradation: buildPatientContext rejects → /api/chat still 200 ──
//
// d7ecb08 wrapped buildPatientContext + assembly in try/catch so a DB hiccup,
// query timeout, or unexpected RLS error never 500s /api/chat. Pre-Plan-6 a
// DB hiccup did not break the chat; we preserve that contract.
//
// This test mocks buildPatientContext to reject, invokes POST, and asserts:
//   (a) the response is 200 (the handler didn't throw)
//   (b) the system prompt passed to streamText contains NEITHER the Plan-6
//       patient context block header NOR any riskOpeningNotice (block is ''
//       after the catch, and riskOpeningNotice is '' after the catch).
//   (c) console.error was called with the '[patient-context]' tag.

describe('POST /api/chat — graceful degradation when buildPatientContext rejects', () => {
  const OLD_ENV = process.env.FEATURE_CROSS_SESSION_CONTEXT
  const OLD_LLM_MODEL = process.env.LLM_CONVERSATIONAL_MODEL
  const capturedSystemPrompts: string[] = []
  const capturedConsoleErrors: Array<{ tag: string; err: unknown }> = []

  beforeEach(() => {
    process.env.FEATURE_CROSS_SESSION_CONTEXT = 'on'
    // llm.conversational() requires LLM_CONVERSATIONAL_MODEL; any value works
    // because we mock `streamText` to skip the actual gateway call.
    process.env.LLM_CONVERSATIONAL_MODEL = 'test-model'
    capturedSystemPrompts.length = 0
    capturedConsoleErrors.length = 0
    vi.resetModules()
  })

  afterEach(() => {
    process.env.FEATURE_CROSS_SESSION_CONTEXT = OLD_ENV
    if (OLD_LLM_MODEL === undefined) delete process.env.LLM_CONVERSATIONAL_MODEL
    else process.env.LLM_CONVERSATIONAL_MODEL = OLD_LLM_MODEL
    vi.restoreAllMocks()
    vi.doUnmock('@/lib/supabase/server')
    vi.doUnmock('@/lib/patient-context/builder')
    vi.doUnmock('@/lib/sessions/service')
    vi.doUnmock('@/lib/sessions/messages')
    vi.doUnmock('@/lib/chat/crisis-detector')
    vi.doUnmock('@/lib/questionnaires/service')
    vi.doUnmock('@/lib/patient-context/telemetry')
    vi.doUnmock('ai')
  })

  it('returns 200 and streams normally; system prompt omits patientContextBlock and riskOpeningNotice; logs [patient-context]', async () => {
    // Stub console.error to capture the '[patient-context]' line.
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const tag = typeof args[0] === 'string' ? args[0] : ''
      capturedConsoleErrors.push({ tag, err: args[1] })
    })

    // ── Mock Supabase: auth.getUser + session lookup + questionnaire probe ─
    // The route touches: (a) auth.getUser, (b) clinical_sessions lookup by
    // id + user_id, (c) questionnaire_instances probe (buildQuestionnaireResultNotice).
    // We return a chainable builder that resolves to the right row per table
    // and supports every method the route chains (.select/.eq/.gte/.order/.limit
    // /.single/.maybeSingle).
    const nowIso = new Date().toISOString()
    const fakeSession = {
      id: 'session-graceful',
      user_id: 'user-1',
      conversation_id: 'conv-1',
      status: 'open',
      opened_at: nowIso,
      last_activity_at: nowIso,
    }

    function makeBuilder(resolvedData: unknown) {
      const builder: Record<string, unknown> = {}
      const passthrough = () => builder
      builder.select = passthrough
      builder.eq = passthrough
      builder.gt = passthrough
      builder.gte = passthrough
      builder.in = passthrough
      builder.order = passthrough
      builder.limit = passthrough
      builder.single = vi.fn().mockResolvedValue({ data: resolvedData, error: null })
      builder.maybeSingle = vi.fn().mockResolvedValue({ data: resolvedData, error: null })
      // Allow awaiting the builder directly (rare but defensive):
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(builder as any).then = (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve({ data: resolvedData, error: null, count: 0 }).then(onFulfilled)
      return builder
    }

    const supabaseStub = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn((table: string) => {
        if (table === 'clinical_sessions') return makeBuilder(fakeSession)
        // Any other table (questionnaire_instances, messages, definitions, results)
        // returns an empty-row builder so buildQuestionnaireResultNotice short-circuits.
        return makeBuilder(null)
      }),
    }
    vi.doMock('@/lib/supabase/server', () => ({
      createAuthenticatedClient: async () => supabaseStub,
    }))

    // ── Mock buildPatientContext to reject (the degradation trigger) ─────
    const buildErr = new Error('simulated DB hiccup')
    vi.doMock('@/lib/patient-context/builder', () => ({
      buildPatientContext: vi.fn().mockRejectedValue(buildErr),
    }))

    // ── Mock the rest of the handler's side effects so POST can complete ─
    vi.doMock('@/lib/sessions/service', () => ({
      touchSession: vi.fn().mockResolvedValue(undefined),
      closeSession: vi.fn().mockResolvedValue(undefined),
      isSessionExpired: vi.fn().mockReturnValue(false),
    }))
    vi.doMock('@/lib/sessions/messages', () => ({
      saveUserMessage: vi.fn().mockResolvedValue(undefined),
      saveAssistantMessage: vi.fn().mockResolvedValue(undefined),
    }))
    vi.doMock('@/lib/chat/crisis-detector', () => ({
      detectCrisis: vi.fn().mockReturnValue({ detected: false, matchedTerms: [] }),
    }))
    vi.doMock('@/lib/questionnaires/service', () => ({
      createInstance: vi.fn(),
      getActiveInstanceForSession: vi.fn().mockResolvedValue(null),
    }))
    // logContextInjection should not be called on the error path; stub it
    // anyway so any accidental invocation doesn't hit a live service role.
    vi.doMock('@/lib/patient-context/telemetry', () => ({
      logContextInjection: vi.fn().mockResolvedValue(undefined),
    }))

    // ── Mock `ai` — streamText, tool, convertToModelMessages ─────────────
    // Capture the system prompt passed to streamText.
    const fakeStreamResponse = new Response('streamed', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    })
    vi.doMock('ai', async (importOriginal) => {
      const mod = await importOriginal<typeof import('ai')>()
      return {
        ...mod,
        streamText: (opts: { system: string }) => {
          capturedSystemPrompts.push(opts.system)
          return {
            toUIMessageStreamResponse: (_opts: unknown) => fakeStreamResponse,
          }
        },
        convertToModelMessages: async (msgs: unknown) => msgs as never,
      }
    })

    // Import the handler AFTER all mocks are registered.
    const { POST } = await import('@/app/api/chat/route')

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: '11111111-1111-4111-8111-111111111111',
        messages: [
          { role: 'user', parts: [{ type: 'text', text: 'hola' }] },
        ],
      }),
    })

    const res = await POST(req)

    // (a) 200 — the handler did not throw despite buildPatientContext rejecting.
    expect(res.status).toBe(200)

    // (b) system prompt does not contain any Plan-6 context artifacts.
    expect(capturedSystemPrompts.length).toBe(1)
    const systemPrompt = capturedSystemPrompts[0]!
    expect(systemPrompt).not.toContain('[CONTEXTO DEL PACIENTE')
    expect(systemPrompt).not.toContain('[AVISO DE CONTINUIDAD')

    // (c) console.error was called with the '[patient-context]' tag exactly once.
    const tagged = capturedConsoleErrors.filter((e) => e.tag === '[patient-context]')
    expect(tagged).toHaveLength(1)
    expect(tagged[0]!.err).toBe(buildErr)
  })
})
