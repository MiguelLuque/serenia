import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { MessagePart } from '@/lib/types/messages'

type Supabase = SupabaseClient<Database>

export type MessageRow = Database['public']['Tables']['messages']['Row']

export async function saveMessage(
  supabase: Supabase,
  params: {
    conversationId: string
    sessionId: string
    role: 'user' | 'assistant' | 'tool' | 'system'
    parts: MessagePart[]
    visibleToUser?: boolean
  },
): Promise<MessageRow> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: params.conversationId,
      session_id: params.sessionId,
      role: params.role,
      // The Supabase generated `Json` type does not represent the full AI SDK
      // `UIMessagePart` discriminated union (it's a structural recursive type
      // built from primitives, arrays, and records). At runtime the parts are
      // plain JSON-serialisable objects, so the cast is safe; we keep the
      // narrow `MessagePart[]` type at the function boundary for callers.
      parts: params.parts as Database['public']['Tables']['messages']['Insert']['parts'],
      visible_to_user: params.visibleToUser ?? true,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to save message: ${error.message}`)
  }

  return data
}

/**
 * Persist a user-authored message. Accepts either a plain `text` string (the
 * common case) or a pre-built `parts` array for callers that already have the
 * UIMessage shape on hand.
 */
export function saveUserMessage(
  supabase: Supabase,
  params: { conversationId: string; sessionId: string; text: string },
): Promise<MessageRow>
export function saveUserMessage(
  supabase: Supabase,
  params: { conversationId: string; sessionId: string; parts: MessagePart[] },
): Promise<MessageRow>
export function saveUserMessage(
  supabase: Supabase,
  params:
    | { conversationId: string; sessionId: string; text: string }
    | { conversationId: string; sessionId: string; parts: MessagePart[] },
): Promise<MessageRow> {
  const parts: MessagePart[] =
    'parts' in params ? params.parts : [{ type: 'text', text: params.text }]
  return saveMessage(supabase, {
    conversationId: params.conversationId,
    sessionId: params.sessionId,
    role: 'user',
    parts,
    visibleToUser: true,
  })
}

/**
 * Persist an assistant-authored message. Always takes the full `parts` array
 * (text + tool-call + tool-result + reasoning, …) so tool activity survives
 * across reloads and rehydration.
 */
export function saveAssistantMessage(
  supabase: Supabase,
  params: {
    conversationId: string
    sessionId: string
    parts: MessagePart[]
  },
): Promise<MessageRow> {
  return saveMessage(supabase, {
    conversationId: params.conversationId,
    sessionId: params.sessionId,
    role: 'assistant',
    parts: params.parts,
    visibleToUser: true,
  })
}
