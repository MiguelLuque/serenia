import { describe, it, expect, vi } from 'vitest'
import { saveUserMessage, saveAssistantMessage, saveMessage } from '@/lib/sessions/messages'

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
  it('inserts role=user, single text part, visible_to_user=true', async () => {
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
})

describe('saveAssistantMessage', () => {
  it('inserts role=assistant, single text part, visible_to_user=true', async () => {
    const row = makeMessageRow({ role: 'assistant', parts: [{ type: 'text', text: 'Hi there' }] })
    const supabase = makeSupabaseMock({ data: row, error: null })

    const result = await saveAssistantMessage(supabase as never, {
      conversationId: 'conv-1',
      sessionId: 'session-1',
      text: 'Hi there',
    })

    const insertCall = (supabase.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertCall.role).toBe('assistant')
    expect(insertCall.parts).toEqual([{ type: 'text', text: 'Hi there' }])
    expect(insertCall.visible_to_user).toBe(true)
    expect(result).toEqual(row)
  })
})

describe('saveMessage', () => {
  it('inserts multi-part payload with visibleToUser=false', async () => {
    const parts = [
      { type: 'text' as const, text: 'Evaluating...' },
      { type: 'text' as const, text: 'Risk: moderate' },
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
