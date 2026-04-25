import { describe, it, expect, vi } from 'vitest'
import { safeValidateUIMessages, type UIMessage } from 'ai'
import {
  saveUserMessage,
  saveAssistantMessage,
  saveMessage,
} from '@/lib/sessions/messages'
import type { MessagePart } from '@/lib/types/messages'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMessageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    session_id: 'session-1',
    role: 'user',
    parts: [],
    visible_to_user: true,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Build a minimal chainable Supabase mock.
 * The final `.single()` (or any terminal call) resolves with { data, error }.
 */
type ChainedMock = Record<string, ReturnType<typeof vi.fn>> & {
  then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>
}

function makeSupabaseMock(result: { data: unknown; error: unknown }): ChainedMock {
  const chain: ChainedMock = {} as ChainedMock
  const methods = ['from', 'insert', 'select', 'single', 'eq', 'update', 'upsert']
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  chain.then = (
    resolve: (v: unknown) => unknown,
    _reject?: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, _reject)
  return chain
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('saveUserMessage', () => {
  it('inserts role=user, single text part, visible_to_user=true (text overload)', async () => {
    const row = makeMessageRow({ role: 'user', parts: [{ type: 'text', text: 'Hello' }] })
    const supabase = makeSupabaseMock({ data: row, error: null })

    const result = await saveUserMessage(supabase as never, {
      conversationId: 'conv-1',
      sessionId: 'session-1',
      text: 'Hello',
    })

    expect(supabase.from).toHaveBeenCalledWith('messages')
    // Verify insert payload
    const insertCall = (supabase.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertCall.role).toBe('user')
    expect(insertCall.parts).toEqual([{ type: 'text', text: 'Hello' }])
    expect(insertCall.visible_to_user).toBe(true)
    expect(insertCall.conversation_id).toBe('conv-1')
    expect(insertCall.session_id).toBe('session-1')
    expect(result).toEqual(row)
  })

  it('accepts a pre-built parts array via the parts overload', async () => {
    const parts: MessagePart[] = [{ type: 'text', text: 'Hi' }]
    const row = makeMessageRow({ role: 'user', parts })
    const supabase = makeSupabaseMock({ data: row, error: null })

    await saveUserMessage(supabase as never, {
      conversationId: 'conv-1',
      sessionId: 'session-1',
      parts,
    })

    const insertCall = (supabase.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertCall.role).toBe('user')
    expect(insertCall.parts).toEqual(parts)
  })
})

describe('saveAssistantMessage', () => {
  it('persists the full parts array (text + tool call + tool result)', async () => {
    const parts: MessagePart[] = [
      { type: 'text', text: '¿Quieres que cerremos la sesión?', state: 'done' },
      {
        type: 'tool-propose_close_session',
        toolCallId: 'call_1',
        state: 'output-available',
        input: { reason: 'user_request' },
        output: { proposed: true, reason: 'user_request' },
      },
    ]
    const row = makeMessageRow({ role: 'assistant', parts })
    const supabase = makeSupabaseMock({ data: row, error: null })

    const result = await saveAssistantMessage(supabase as never, {
      conversationId: 'conv-1',
      sessionId: 'session-1',
      parts,
    })

    const insertCall = (supabase.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertCall.role).toBe('assistant')
    expect(insertCall.parts).toEqual(parts)
    expect(insertCall.visible_to_user).toBe(true)
    expect(result).toEqual(row)
  })

  it('round-trips mixed parts through safeValidateUIMessages', async () => {
    // Simulate the journey: persist mixed parts → read them back from the
    // JSONB column → validate with AI SDK → reconstruct the UIMessage.
    const original: MessagePart[] = [
      { type: 'text', text: 'Vamos a cerrar.', state: 'done' },
      {
        type: 'tool-confirm_close_session',
        toolCallId: 'call_42',
        state: 'output-available',
        input: { reason: 'user_request' },
        output: { closed: true, reason: 'user_request' },
      },
    ]

    const row = makeMessageRow({ role: 'assistant', parts: original })
    const supabase = makeSupabaseMock({ data: row, error: null })

    await saveAssistantMessage(supabase as never, {
      conversationId: 'conv-1',
      sessionId: 'session-1',
      parts: original,
    })

    const insertCall = (supabase.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    // Round-trip through JSON to mirror what JSONB does to the payload.
    const persisted = JSON.parse(JSON.stringify(insertCall.parts))

    const candidate: UIMessage = {
      id: 'msg-1',
      role: 'assistant',
      parts: persisted,
    }
    const validated = await safeValidateUIMessages({ messages: [candidate] })
    expect(validated.success).toBe(true)
    if (validated.success) {
      expect(validated.data[0].parts).toEqual(original)
    }
  })
})

describe('saveMessage', () => {
  it('inserts multi-part payload with visibleToUser=false', async () => {
    const parts: MessagePart[] = [
      { type: 'text', text: 'Evaluating...' },
      { type: 'text', text: 'Risk: moderate' },
    ]
    const row = makeMessageRow({ role: 'tool', parts, visible_to_user: false })
    const supabase = makeSupabaseMock({ data: row, error: null })

    const result = await saveMessage(supabase as never, {
      conversationId: 'conv-2',
      sessionId: 'session-2',
      role: 'tool',
      parts,
      visibleToUser: false,
    })

    const insertCall = (supabase.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertCall.role).toBe('tool')
    expect(insertCall.parts).toEqual(parts)
    expect(insertCall.visible_to_user).toBe(false)
    expect(insertCall.conversation_id).toBe('conv-2')
    expect(insertCall.session_id).toBe('session-2')
    expect(result).toEqual(row)
  })

  it('throws with a descriptive message when insert errors', async () => {
    const supabase = makeSupabaseMock({ data: null, error: { message: 'foreign key violation' } })

    await expect(
      saveMessage(supabase as never, {
        conversationId: 'conv-1',
        sessionId: 'session-1',
        role: 'user',
        parts: [{ type: 'text', text: 'test' }],
      }),
    ).rejects.toThrow('Failed to save message: foreign key violation')
  })
})
