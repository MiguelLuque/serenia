import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SafetyState } from '@/lib/chat/safety-state'

// =============================================================================
// Plan 7 T3a v2 — POST /api/chat con `getSessionSafetyState` + `buildCrisisNotice`
// integrados. Capturamos el `system` que recibe `streamText` y verificamos que
// el bloque del crisisNotice corresponda al SafetyState mockeado y al detector
// léxico.
// =============================================================================

const NOW_ISO = '2026-04-28T12:00:00Z'
const SESSION_ID = '11111111-1111-4111-8111-111111111111'

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
  builder.maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: resolvedData, error: null })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(builder as any).then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve({ data: resolvedData, error: null, count: 0 }).then(
      onFulfilled,
    )
  return builder
}

interface RunHandlerOpts {
  safetyState: SafetyState
  // Texto crudo del último mensaje del usuario (lo recibe `detectCrisis` real,
  // así dejamos que el detector léxico decida si triggea o no).
  lastUserText: string
}

describe('POST /api/chat — safety flow integration (T3a v2)', () => {
  const OLD_LLM_MODEL = process.env.LLM_CONVERSATIONAL_MODEL
  const capturedSystemPrompts: string[] = []

  beforeEach(() => {
    process.env.LLM_CONVERSATIONAL_MODEL = 'test-model'
    capturedSystemPrompts.length = 0
    vi.resetModules()
  })

  afterEach(() => {
    if (OLD_LLM_MODEL === undefined) delete process.env.LLM_CONVERSATIONAL_MODEL
    else process.env.LLM_CONVERSATIONAL_MODEL = OLD_LLM_MODEL
    vi.restoreAllMocks()
    vi.doUnmock('@/lib/supabase/server')
    vi.doUnmock('@/lib/sessions/service')
    vi.doUnmock('@/lib/sessions/messages')
    vi.doUnmock('@/lib/chat/safety-state')
    vi.doUnmock('@/lib/questionnaires/service')
    vi.doUnmock('@/lib/patient-context/telemetry')
    vi.doUnmock('ai')
  })

  async function runHandler(opts: RunHandlerOpts): Promise<string> {
    const fakeSession = {
      id: SESSION_ID,
      user_id: 'user-1',
      conversation_id: 'conv-1',
      status: 'open',
      opened_at: NOW_ISO,
      last_activity_at: NOW_ISO,
    }

    const supabaseStub = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn((table: string) => {
        if (table === 'clinical_sessions') return makeBuilder(fakeSession)
        return makeBuilder(null)
      }),
    }
    vi.doMock('@/lib/supabase/server', () => ({
      createAuthenticatedClient: async () => supabaseStub,
    }))
    vi.doMock('@/lib/sessions/service', () => ({
      touchSession: vi.fn().mockResolvedValue(undefined),
      closeSession: vi.fn().mockResolvedValue(undefined),
      isSessionExpired: vi.fn().mockReturnValue(false),
    }))
    vi.doMock('@/lib/sessions/messages', () => ({
      saveUserMessage: vi.fn().mockResolvedValue(undefined),
      saveAssistantMessage: vi.fn().mockResolvedValue(undefined),
    }))
    // SafetyState lo controlamos directamente desde el test.
    vi.doMock('@/lib/chat/safety-state', () => ({
      getSessionSafetyState: vi.fn().mockResolvedValue(opts.safetyState),
    }))
    vi.doMock('@/lib/questionnaires/service', () => ({
      createInstance: vi.fn(),
      getActiveInstanceForSession: vi.fn().mockResolvedValue(null),
    }))
    vi.doMock('@/lib/patient-context/telemetry', () => ({
      logContextInjection: vi.fn().mockResolvedValue(undefined),
    }))

    const fakeStreamResponse = new Response('streamed', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    })
    vi.doMock('ai', async (importOriginal) => {
      const mod = await importOriginal<typeof import('ai')>()
      return {
        ...mod,
        streamText: (apiOpts: { system: string }) => {
          capturedSystemPrompts.push(apiOpts.system)
          return {
            toUIMessageStreamResponse: () => fakeStreamResponse,
          }
        },
        convertToModelMessages: async (msgs: unknown) => msgs as never,
      }
    })

    const { POST } = await import('@/app/api/chat/route')
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        messages: [
          { role: 'user', parts: [{ type: 'text', text: opts.lastUserText }] },
        ],
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(capturedSystemPrompts.length).toBe(1)
    return capturedSystemPrompts[0]!
  }

  it('ASQ scored negativo + texto neutro → variante "ASQ NEGATIVO YA APLICADO" (no [AVISO])', async () => {
    const prompt = await runHandler({
      safetyState: {
        kind: 'asq_negative',
        scoredAt: NOW_ISO,
        coversAcuteIdeation: true,
      },
      lastUserText: 'estoy un poco cansada',
    })

    expect(prompt).toContain('[CONTEXTO DE SEGURIDAD — ASQ NEGATIVO YA APLICADO]')
    expect(prompt).not.toContain('[AVISO DE SEGURIDAD — POSIBLE SEÑAL]')
  })

  it('ASQ acute → variante "RIESGO AGUDO"', async () => {
    const prompt = await runHandler({
      safetyState: {
        kind: 'asq_acute_risk',
        scoredAt: NOW_ISO,
        flags: [{ reason: 'acute_risk', itemOrder: 5 }],
      },
      lastUserText: 'no sé qué hacer',
    })

    expect(prompt).toContain('[RESULTADO DE CUESTIONARIO — ASQ — RIESGO AGUDO]')
    expect(prompt).toContain('Activa el protocolo de crisis AHORA')
  })

  it('ASQ pending → variante "ASQ PROPUESTO PENDIENTE"', async () => {
    const prompt = await runHandler({
      safetyState: { kind: 'asq_proposed_pending', proposedAt: NOW_ISO },
      lastUserText: 'no quiero hacerlo ahora',
    })

    expect(prompt).toContain('[ASQ PROPUESTO PENDIENTE]')
    expect(prompt).toContain('NO propongas otro cuestionario')
  })

  it('never_assessed + último mensaje con palabra alta-señal "suicidarme" → variante "primera vez" no imperativa', async () => {
    const prompt = await runHandler({
      safetyState: { kind: 'never_assessed' },
      lastUserText: 'a veces pienso en suicidarme',
    })

    expect(prompt).toContain('[AVISO DE SEGURIDAD — POSIBLE SEÑAL]')
    expect(prompt).toContain('Lee el contexto')
    // El imperativo viejo NO debe aparecer.
    expect(prompt).not.toContain('Activa el protocolo de crisis AHORA')
  })

  it('never_assessed + sin crisis → notice vacío', async () => {
    const prompt = await runHandler({
      safetyState: { kind: 'never_assessed' },
      lastUserText: 'estoy bien, gracias',
    })

    expect(prompt).not.toContain('[AVISO DE SEGURIDAD')
    expect(prompt).not.toContain('[CONTEXTO DE SEGURIDAD')
    expect(prompt).not.toContain('[RE-ESCALADA')
  })

  it('ASQ negativo + último mensaje "voy a quitarme la vida esta noche" → prepende RE-ESCALADA', async () => {
    const prompt = await runHandler({
      safetyState: {
        kind: 'asq_negative',
        scoredAt: NOW_ISO,
        coversAcuteIdeation: true,
      },
      lastUserText: 'voy a quitarme la vida esta noche',
    })

    expect(prompt).toContain('[RE-ESCALADA — SEÑAL NUEVA POST-CRIBADO]')
    expect(prompt).toContain('[CONTEXTO DE SEGURIDAD — ASQ NEGATIVO YA APLICADO]')
    // RE-ESCALADA debe ir ANTES de la variante 3 en el prompt final.
    const idxReEsc = prompt.indexOf('[RE-ESCALADA')
    const idxBase = prompt.indexOf('[CONTEXTO DE SEGURIDAD — ASQ NEGATIVO YA APLICADO]')
    expect(idxReEsc).toBeLessThan(idxBase)
  })

  it('ASQ negativo + último mensaje "totalmente desbordado" (sin alta señal) → variante 3 sin RE-ESCALADA', async () => {
    const prompt = await runHandler({
      safetyState: {
        kind: 'asq_negative',
        scoredAt: NOW_ISO,
        coversAcuteIdeation: true,
      },
      lastUserText: 'estoy totalmente desbordado',
    })

    expect(prompt).toContain('[CONTEXTO DE SEGURIDAD — ASQ NEGATIVO YA APLICADO]')
    expect(prompt).not.toContain('[RE-ESCALADA')
    expect(prompt).not.toContain('[AVISO DE SEGURIDAD')
  })
})
