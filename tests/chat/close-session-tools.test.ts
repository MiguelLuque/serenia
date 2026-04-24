import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// -----------------------------------------------------------------------------
// Unit/integration tests for the three session-close tools wired into
// app/api/chat/route.ts:
//   - propose_close_session — NO side-effects (does NOT call closeSession)
//   - confirm_close_session — closes with the provided reason
//   - close_session_crisis  — closes with reason='crisis_detected'
//
// Strategy: mock `ai.streamText` to capture the `tools` map the route
// assembles, then invoke each tool's `execute` directly. closeSession is
// replaced with a vi.fn so we can assert call args (and absence of calls).
// -----------------------------------------------------------------------------

const closeSessionMock = vi.fn(async () => undefined)

type CapturedTools = Record<
  string,
  { execute: (input: unknown, opts?: unknown) => Promise<unknown> }
>

const capturedTools: CapturedTools[] = []

function resetCaptures() {
  capturedTools.length = 0
  closeSessionMock.mockClear()
}

const OLD_LLM_MODEL = process.env.LLM_CONVERSATIONAL_MODEL

beforeEach(() => {
  vi.resetModules()
  resetCaptures()
  // llm.conversational() requires LLM_CONVERSATIONAL_MODEL; any value works
  // because `ai` is mocked so the model string is never resolved by a real
  // provider.
  process.env.LLM_CONVERSATIONAL_MODEL = 'test-model'
})

afterEach(() => {
  vi.doUnmock('@/lib/supabase/server')
  vi.doUnmock('@/lib/sessions/service')
  vi.doUnmock('@/lib/sessions/messages')
  vi.doUnmock('@/lib/chat/crisis-detector')
  vi.doUnmock('@/lib/questionnaires/service')
  vi.doUnmock('@/lib/patient-context/telemetry')
  vi.doUnmock('ai')
  if (OLD_LLM_MODEL === undefined) delete process.env.LLM_CONVERSATIONAL_MODEL
  else process.env.LLM_CONVERSATIONAL_MODEL = OLD_LLM_MODEL
})

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(builder as any).then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve({ data: resolvedData, error: null, count: 0 }).then(onFulfilled)
  return builder
}

async function runHandlerAndCaptureTools(): Promise<CapturedTools> {
  const nowIso = new Date().toISOString()
  const fakeSession = {
    id: 'session-close-tools',
    user_id: 'user-1',
    conversation_id: 'conv-1',
    status: 'open',
    opened_at: nowIso,
    last_activity_at: nowIso,
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
    closeSession: closeSessionMock,
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
      streamText: (opts: { tools: CapturedTools }) => {
        capturedTools.push(opts.tools)
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
      sessionId: '11111111-1111-4111-8111-111111111111',
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'hola' }] }],
    }),
  })

  const res = await POST(req)
  expect(res.status).toBe(200)
  expect(capturedTools).toHaveLength(1)
  return capturedTools[0]!
}

describe('propose_close_session tool', () => {
  it('exists and does NOT invoke closeSession when executed', async () => {
    const tools = await runHandlerAndCaptureTools()

    expect(tools.propose_close_session).toBeDefined()
    const result = await tools.propose_close_session.execute(
      { reason: 'user_request' },
      { toolCallId: 'tc-1', messages: [] },
    )
    expect(closeSessionMock).not.toHaveBeenCalled()
    expect(result).toEqual({ proposed: true, reason: 'user_request' })
  })

  it('echoes reason=time_limit without side-effects', async () => {
    const tools = await runHandlerAndCaptureTools()

    const result = await tools.propose_close_session.execute(
      { reason: 'time_limit' },
      { toolCallId: 'tc-2', messages: [] },
    )
    expect(closeSessionMock).not.toHaveBeenCalled()
    expect(result).toEqual({ proposed: true, reason: 'time_limit' })
  })
})

describe('confirm_close_session tool', () => {
  it('invokes closeSession with reason=user_request', async () => {
    const tools = await runHandlerAndCaptureTools()

    const result = await tools.confirm_close_session.execute(
      { reason: 'user_request' },
      { toolCallId: 'tc-3', messages: [] },
    )
    expect(closeSessionMock).toHaveBeenCalledTimes(1)
    expect(closeSessionMock).toHaveBeenCalledWith(
      expect.anything(),
      '11111111-1111-4111-8111-111111111111',
      'user_request',
    )
    expect(result).toEqual({ closed: true, reason: 'user_request' })
  })

  it('invokes closeSession with reason=time_limit', async () => {
    const tools = await runHandlerAndCaptureTools()

    await tools.confirm_close_session.execute(
      { reason: 'time_limit' },
      { toolCallId: 'tc-4', messages: [] },
    )
    expect(closeSessionMock).toHaveBeenCalledTimes(1)
    expect(closeSessionMock).toHaveBeenCalledWith(
      expect.anything(),
      '11111111-1111-4111-8111-111111111111',
      'time_limit',
    )
  })
})

describe('close_session_crisis tool', () => {
  it('invokes closeSession with reason=crisis_detected', async () => {
    const tools = await runHandlerAndCaptureTools()

    const result = await tools.close_session_crisis.execute(
      {},
      { toolCallId: 'tc-5', messages: [] },
    )
    expect(closeSessionMock).toHaveBeenCalledTimes(1)
    expect(closeSessionMock).toHaveBeenCalledWith(
      expect.anything(),
      '11111111-1111-4111-8111-111111111111',
      'crisis_detected',
    )
    expect(result).toEqual({ closed: true, reason: 'crisis_detected' })
  })
})
