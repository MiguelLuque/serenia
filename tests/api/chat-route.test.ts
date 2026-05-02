import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// =============================================================================
// Plan 8 Bloque 2 — Fix 1: validation hardening for POST /api/chat
//
// Bug: The route used `BodySchema.parse(...)` which throws on malformed input,
// returning 500 + stack trace to the client. It also accepted
// `messages: z.array(z.any())` so a malicious payload could blow up
// `convertToModelMessages` later. The fix replaces both with `safeParse` +
// `safeValidateUIMessages` and answers 400 with a generic message.
//
// Strategy: mock everything downstream of the validation layer (supabase,
// streamText, side-effect persisters) so we can assert pure response status
// + the absence of side-effects when validation fails.
// =============================================================================

const SESSION_ID = '11111111-1111-4111-8111-111111111111'

const saveUserMessageMock = vi.fn(async () => undefined)
const closeSessionMock = vi.fn(async () => undefined)
let capturedSystemPrompts: unknown[] = []

const OLD_LLM_MODEL = process.env.LLM_CONVERSATIONAL_MODEL

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

beforeEach(() => {
  vi.resetModules()
  saveUserMessageMock.mockClear()
  closeSessionMock.mockClear()
  capturedSystemPrompts = []
  process.env.LLM_CONVERSATIONAL_MODEL = 'test-model'

  const nowIso = new Date().toISOString()
  const fakeSession = {
    id: SESSION_ID,
    user_id: 'user-1',
    conversation_id: 'conv-1',
    status: 'open',
    opened_at: nowIso,
    last_activity_at: nowIso,
    protocol_phase: 1,
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

  vi.doMock('@/lib/server/supabase/server', () => ({
    createAuthenticatedClient: async () => supabaseStub,
  }))

  vi.doMock('@/lib/server/sessions/service', () => ({
    touchSession: vi.fn().mockResolvedValue(undefined),
    closeSession: closeSessionMock,
    isSessionExpired: vi.fn().mockReturnValue(false),
  }))

  vi.doMock('@/lib/server/sessions/messages', () => ({
    saveUserMessage: saveUserMessageMock,
    saveAssistantMessage: vi.fn().mockResolvedValue(undefined),
  }))

  vi.doMock('@/lib/shared/chat/crisis-detector', () => ({
    detectCrisis: vi.fn().mockReturnValue({ detected: false, matchedTerms: [] }),
  }))

  vi.doMock('@/lib/server/chat/safety-state', () => ({
    getSessionSafetyState: vi
      .fn()
      .mockResolvedValue({ kind: 'never_assessed' }),
  }))

  vi.doMock('@/lib/server/questionnaires/service', () => ({
    createInstance: vi.fn(),
    getActiveInstanceForSession: vi.fn().mockResolvedValue(null),
  }))

  vi.doMock('@/lib/server/patient-context/telemetry', () => ({
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
      streamText: (opts: { system: string; tools: unknown }) => {
        capturedSystemPrompts.push(opts.system)
        return {
          toUIMessageStreamResponse: () => fakeStreamResponse,
        }
      },
      convertToModelMessages: async (msgs: unknown) => msgs as never,
    }
  })
})

afterEach(() => {
  vi.doUnmock('@/lib/server/supabase/server')
  vi.doUnmock('@/lib/server/sessions/service')
  vi.doUnmock('@/lib/server/sessions/messages')
  vi.doUnmock('@/lib/shared/chat/crisis-detector')
  vi.doUnmock('@/lib/server/chat/safety-state')
  vi.doUnmock('@/lib/server/questionnaires/service')
  vi.doUnmock('@/lib/server/patient-context/telemetry')
  vi.doUnmock('ai')
  if (OLD_LLM_MODEL === undefined) delete process.env.LLM_CONVERSATIONAL_MODEL
  else process.env.LLM_CONVERSATIONAL_MODEL = OLD_LLM_MODEL
})

async function postBody(body: unknown): Promise<Response> {
  const { POST } = await import('@/app/api/chat/route')
  const req = new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  return POST(req)
}

describe('POST /api/chat — body validation (Plan 8 Bloque 2 Fix 1)', () => {
  it('returns 400 (not 500) when sessionId is missing', async () => {
    const res = await postBody({
      messages: [
        { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hola' }] },
      ],
    })
    expect(res.status).toBe(400)
    expect(saveUserMessageMock).not.toHaveBeenCalled()
  })

  it('returns 400 when messages are missing', async () => {
    const res = await postBody({ sessionId: SESSION_ID })
    expect(res.status).toBe(400)
    expect(saveUserMessageMock).not.toHaveBeenCalled()
  })

  it('returns 400 when sessionId is not a uuid', async () => {
    const res = await postBody({
      sessionId: 'not-a-uuid',
      messages: [
        { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hola' }] },
      ],
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when messages contain an invalid role', async () => {
    const res = await postBody({
      sessionId: SESSION_ID,
      // role: 'banana' is not in the UIMessage role enum.
      messages: [{ id: 'm1', role: 'banana', parts: [{ type: 'text', text: 'x' }] }],
    })
    expect(res.status).toBe(400)
    expect(saveUserMessageMock).not.toHaveBeenCalled()
  })

  it('returns 400 when message parts are missing required fields', async () => {
    const res = await postBody({
      sessionId: SESSION_ID,
      // text part missing the `text` field.
      messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text' }] }],
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is not valid JSON', async () => {
    const res = await postBody('not-json{')
    expect(res.status).toBe(400)
    expect(saveUserMessageMock).not.toHaveBeenCalled()
  })

  it('does NOT leak validation detail in the 400 response (returns generic message)', async () => {
    const res = await postBody({})
    expect(res.status).toBe(400)
    const body = await res.json()
    // Generic message — no zod issue stack, no field paths leaked.
    expect(body).toEqual({ error: 'Solicitud inválida' })
  })

  it('returns 200 (and persists user message) for a well-formed body', async () => {
    const res = await postBody({
      sessionId: SESSION_ID,
      messages: [
        { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hola' }] },
      ],
    })
    expect(res.status).toBe(200)
    expect(saveUserMessageMock).toHaveBeenCalledTimes(1)
    expect(capturedSystemPrompts).toHaveLength(1)
  })

  it('does NOT persist the user message when validation fails', async () => {
    // Reproduces the contract: parse failure must not save the user turn,
    // matching the comment in route.ts ("saveUserMessage está post-validation").
    const res = await postBody({
      sessionId: SESSION_ID,
      messages: 'not-an-array',
    })
    expect(res.status).toBe(400)
    expect(saveUserMessageMock).not.toHaveBeenCalled()
  })
})
