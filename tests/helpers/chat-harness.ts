/* eslint-disable @typescript-eslint/no-explicit-any -- transport/database test doubles */
import { vi } from 'vitest'
import type { SafetyState } from '@/lib/shared/chat/safety-state'
export const SESSION_ID = '11111111-1111-4111-8111-111111111111'
export async function chatHarness() {
  vi.resetModules()
  const state = {
    session: { id: SESSION_ID, user_id: 'user-1', conversation_id: 'conv-1', status: 'open', opened_at: new Date().toISOString(), protocol_phase: 1 },
    user: { id: 'user-1' } as { id: string } | null,
    conversationOwner: 'user-1',
    rows: [] as any[], turns: new Map<string, any>(), proposal: null as { requestId: string; reason: string } | null,
    previousRequest: null as string | null,
    safety: { kind: 'never_assessed' } as SafetyState,
    captured: [] as any[], writes: [] as any[],
    persistFailures: 0, generationFailure: false, urgentReply: false,
    hook: async (_options: any) => { void _options },
  }
  const chain = (table: string) => {
    const q: any = {}
    for (const method of ['select','eq','gt','gte','in','order','limit','single','maybeSingle']) q[method] = vi.fn(() => q)
    q.then = (resolve: any, reject: any) => Promise.resolve({ data: table === 'clinical_sessions' ? state.session : table === 'conversations' ? { id: 'conv-1', user_id: state.conversationOwner } : table === 'messages' ? state.rows : null, error: null, count: 0 }).then(resolve, reject)
    return q
  }
  const service = { from: vi.fn(chain), rpc: vi.fn(async (name: string, args: any) => {
    state.writes.push({ name, args })
    if (name === 'begin_chat_turn') {
      const prior = state.turns.get(args.p_request_id)
      if (prior?.text !== undefined && prior.text !== args.p_text) return { error: { code: '23514' }, data: null }
      if (prior?.status === 'completed') return { data: { replay: true, chunks: prior.chunks }, error: null }
      if (prior?.status === 'generating' || [...state.turns.values()].some(t => t.status !== 'completed' && t !== prior)) return { error: { code: '55P03' }, data: null }
      if (!prior) state.rows.push({ id: `user-${args.p_request_id}`, role: 'user', parts: [{ type: 'text', text: args.p_text }] })
      state.turns.set(args.p_request_id, { text: args.p_text, status: 'generating', previousRequest: state.previousRequest })
      return { data: { replay: false, token: '11111111-1111-4111-8111-111111111111', urgent: state.urgentReply }, error: null }
    }
    if (name === 'finish_chat_turn') {
      if (state.persistFailures-- > 0) return { error: { code: 'XX000' }, data: null }
      const turn = state.turns.get(args.p_request_id)
      turn.status = 'completed'; turn.chunks = args.p_chunks
      state.rows.push({ id: `assistant-${args.p_request_id}`, role: 'assistant', parts: args.p_parts })
      state.proposal = args.p_proposal ? { requestId: args.p_request_id, reason: args.p_proposal } : null
      state.previousRequest = args.p_request_id
      if (args.p_close_reason) state.session.status = 'closed'
    }
    if (name === 'fail_chat_turn') state.turns.get(args.p_request_id).status = 'failed'
    if (name === 'close_chat_turn') {
      const turn = state.turns.get(args.p_request_id)
      return { data: args.p_reason === 'crisis_detected' || (state.proposal?.requestId === turn.previousRequest && state.proposal?.reason === args.p_reason), error: null }
    }
    return { data: null, error: null }
  }) }
  const authClient = { auth: { getUser: vi.fn(async () => ({ data: { user: state.user }, error: null })) }, from: vi.fn(chain) }
  vi.doMock('@/lib/server/supabase/server', () => ({ createAuthenticatedClient: async () => authClient, createServiceRoleClient: () => service }))
  vi.doMock('@/lib/server/llm/prompts', () => ({ getSessionTherapistPrompt: () => 'Active prompt' }))
  vi.doMock('@/lib/shared/llm/models', () => ({ llm: { conversational: () => 'synthetic-model' } }))
  vi.doMock('@/lib/server/chat/safety-state', () => ({ getSessionSafetyState: async () => state.safety }))
  vi.doMock('@/lib/server/workflows', () => ({ enqueueAssessmentGeneration: vi.fn(async () => ({ runId: 'synthetic-run' })) }))
  vi.doMock('@/lib/server/questionnaires/service', () => ({ createInstance: vi.fn(async () => ({ id: 'quiz' })), getActiveInstanceForSession: async () => null }))
  vi.doMock('ai', async importOriginal => {
    const actual = await importOriginal<typeof import('ai')>()
    return { ...actual, streamText: (options: any) => {
      state.captured.push(options)
      return { toUIMessageStream: ({ onFinish }: any) => new ReadableStream({ async start(controller) {
        await state.hook(options)
        if (state.generationFailure) { controller.enqueue({ type: 'error', errorText: 'synthetic failure' }); controller.close(); return }
        const parts = [{ type: 'text', text: 'Respuesta sintética' }]
        const chunks = [{ type: 'start', messageId: 'assistant-synthetic' }, { type: 'text-start', id: 'text' }, { type: 'text-delta', id: 'text', delta: 'Respuesta sintética' }, { type: 'text-end', id: 'text' }, { type: 'finish', finishReason: 'stop' }]
        onFinish({ responseMessage: { id: 'assistant-synthetic', role: 'assistant', parts } })
        for (const chunk of chunks) controller.enqueue(chunk)
        controller.close()
      } }) }
    } }
  })
  const { POST } = await import('@/app/api/chat/route')
  const post = (text = 'Hola', id = 'turn-1', extra: Record<string, unknown> = {}) => POST(new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify({ sessionId: SESSION_ID, requestId: id, messages: [{ id, role: 'user', parts: [{ type: 'text', text }] }], ...extra }) }))
  return { state, service, authClient, post, POST }
}
