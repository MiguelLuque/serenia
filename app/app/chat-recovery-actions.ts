'use server'
import { safeValidateUIMessages } from 'ai'
import { createAuthenticatedClient } from '@/lib/server/supabase/server'
import { ChatRecoverySchema } from '@/lib/shared/chat/recovery'
import { sessionTiming } from '@/lib/shared/chat/session-time'
import { closeSession } from '@/lib/server/sessions/service'

async function ownedSession(sessionId: string) {
  const client = await createAuthenticatedClient()
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')
  const { data: session, error } = await client.from('clinical_sessions').select('id,user_id,conversation_id,status,opened_at').eq('id', sessionId).eq('user_id', user.id).single()
  if (error || !session || session.user_id !== user.id) throw new Error('Owned session required')
  return { client, session }
}

/** Rehydrate only an authenticated patient's owned conversation and narrow turn projection. */
export async function getOwnedChatState(sessionId: string) {
  const { client, session } = await ownedSession(sessionId)
  const closed = session.status !== 'open'
  let recovery = null
  if (!closed) {
    const { data, error: recoveryError } = await client.rpc('get_chat_turn_recovery', { p_session_id: sessionId })
    if (recoveryError) throw recoveryError
    recovery = data === null ? null : ChatRecoverySchema.parse(data)
  }
  const { data: rows, error: messagesError } = await client.from('messages').select('id,role,parts').eq('conversation_id', session.conversation_id).eq('visible_to_user', true).order('created_at', { ascending: true })
  if (messagesError) throw messagesError
  const messages = (rows ?? []).map(row => ({ id: row.id, role: row.role, parts: row.parts }))
  const validated = await safeValidateUIMessages({ messages })
  if (!validated.success) throw new Error('No se pudo recuperar la conversación')
  // A closed session may be the successful result of a lost HTTP response.
  // Its final persisted answer must remain recoverable on the same owned view.
  if (closed) return { closed: true as const, recovery: null, messages: validated.data }
  return { closed: false as const, recovery, messages: validated.data, timing: sessionTiming(session.opened_at) }
}

/** Explicit user action. Never make the browser timer a persistence trigger. */
export async function closeOwnedSessionFromView(sessionId: string, mode: 'user_request' | 'time_limit') {
  if (mode !== 'user_request' && mode !== 'time_limit') throw new Error('Invalid closure mode')
  const { client, session } = await ownedSession(sessionId)
  if (session.status !== 'open') return { closed: true as const }
  const { data, error } = await client.rpc('get_chat_turn_recovery', { p_session_id: sessionId })
  if (error) throw error
  const recovery = data === null ? null : ChatRecoverySchema.parse(data)
  const timing = sessionTiming(session.opened_at)
  if (recovery?.status === 'generating' && !recovery.canRetry && Date.parse(recovery.leaseUntil) > timing.serverNow) {
    return { closed: false as const, reason: 'turn_pending' as const, timing }
  }
  if (mode === 'time_limit' && timing.serverNow < timing.expiresAt) {
    return { closed: false as const, reason: 'not_expired' as const, timing }
  }
  // The database still owns authorization and durable close/outbox. This
  // read guard avoids interrupting an observed pending turn; it is not a new
  // cross-device lock. No automatic closure runs on mount, focus or a timer.
  await closeSession(client, sessionId, mode)
  return { closed: true as const }
}
