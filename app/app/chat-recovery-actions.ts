'use server'
import { safeValidateUIMessages, type UIMessage } from 'ai'
import { createAuthenticatedClient } from '@/lib/server/supabase/server'
import { ChatRecoverySchema } from '@/lib/shared/chat/recovery'

/** Rehydrate only an authenticated patient's owned conversation and narrow turn projection. */
export async function getOwnedChatState(sessionId: string) {
  const client = await createAuthenticatedClient()
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')
  const { data: session, error } = await client.from('clinical_sessions').select('id,user_id,conversation_id,status').eq('id', sessionId).eq('user_id', user.id).single()
  if (error || !session || session.user_id !== user.id) throw new Error('Owned session required')
  if (session.status !== 'open') return { closed: true, recovery: null, messages: [] as UIMessage[] }
  const { data, error: recoveryError } = await client.rpc('get_chat_turn_recovery', { p_session_id: sessionId })
  if (recoveryError) throw recoveryError
  const recovery = data === null ? null : ChatRecoverySchema.parse(data)
  const { data: rows, error: messagesError } = await client.from('messages').select('id,role,parts').eq('conversation_id', session.conversation_id).eq('visible_to_user', true).order('created_at', { ascending: true })
  if (messagesError) throw messagesError
  const messages = (rows ?? []).map(row => ({ id: row.id, role: row.role, parts: row.parts }))
  const validated = await safeValidateUIMessages({ messages })
  if (!validated.success) throw new Error('No se pudo recuperar la conversación')
  return { closed: false, recovery, messages: validated.data }
}
