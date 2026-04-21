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

export async function saveUserMessage(
  supabase: Supabase,
  params: { conversationId: string; sessionId: string; text: string },
): Promise<MessageRow> {
  return saveMessage(supabase, {
    conversationId: params.conversationId,
    sessionId: params.sessionId,
    role: 'user',
    parts: [{ type: 'text', text: params.text }],
    visibleToUser: true,
  })
}

export async function saveAssistantMessage(
  supabase: Supabase,
  params: { conversationId: string; sessionId: string; text: string },
): Promise<MessageRow> {
  return saveMessage(supabase, {
    conversationId: params.conversationId,
    sessionId: params.sessionId,
    role: 'assistant',
    parts: [{ type: 'text', text: params.text }],
    visibleToUser: true,
  })
}
