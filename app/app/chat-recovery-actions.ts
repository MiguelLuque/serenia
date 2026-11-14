'use server'
import { safeValidateUIMessages } from 'ai'
import { createAuthenticatedClient, createServiceRoleClient } from '@/lib/server/supabase/server'
import { z } from 'zod'
import { ChatRecoverySchema } from '@/lib/shared/chat/recovery'
import { readOwnedChatSnapshot } from '@/lib/server/chat/owned-snapshot'
import { sessionTiming } from '@/lib/shared/chat/session-time'
import { closeSession } from '@/lib/server/sessions/service'

async function ownedSession(sessionId: string) {
  const client = await createAuthenticatedClient()
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')
  const { data: session, error } = await client.from('clinical_sessions').select('id,user_id,conversation_id,status,opened_at').eq('id', sessionId).eq('user_id', user.id).single()
  if (error || !session || session.id !== sessionId || session.user_id !== user.id) throw new Error('Owned session required')
  return { client, session, user }
}

/** Explicitly fence an expired owned turn. Busy and unknown remain uncertain. */
export async function resolveOwnedChatTurn(sessionId: string, requestId: string, attempt: number) {
  if (!z.string().uuid().safeParse(sessionId).success || !z.string().regex(/^[A-Za-z0-9_-]{1,100}$/).safeParse(requestId).success || !z.number().int().min(1).max(3).safeParse(attempt).success) throw new Error('Invalid request')
  const { client } = await ownedSession(sessionId)
  const { data, error } = await client.rpc('resolve_expired_chat_turn', { p_session_id: sessionId, p_request_id: requestId, p_expected_attempt: attempt })
  if (error) throw new Error('Resolution unavailable')
  return z.enum(['busy', 'active', 'failed', 'completed', 'interrupted', 'closed', 'unknown', 'stale']).parse(data)
}

/** Rehydrate only an authenticated patient's owned conversation and narrow turn projection. */
export async function getOwnedChatState(sessionId: string, requestId?: string) {
  if (requestId !== undefined && (!z.string().uuid().safeParse(sessionId).success || !z.string().regex(/^[A-Za-z0-9_-]{1,100}$/).safeParse(requestId).success)) throw new Error('Invalid request')
  const { client, session, user } = await ownedSession(sessionId)
  let receipt: 'generating' | 'failed' | 'completed' | 'interrupted' | 'missing' | undefined
  let receiptUserMessageId: string | undefined
  let receiptUnavailable = false
  if (requestId !== undefined) {
    const { data: conversation, error } = await client.from('conversations').select('id,user_id').eq('id', session.conversation_id).eq('user_id', user.id).single()
    if (error || !conversation || conversation.id !== session.conversation_id || conversation.user_id !== user.id) throw new Error('Owned conversation required')
    try {
      const service = createServiceRoleClient()
      const result = await service.from('chat_turns').select('status,user_message_id').eq('session_id', sessionId).eq('user_id', user.id).eq('request_id', requestId).maybeSingle()
      if (result.error) throw new Error('Receipt unavailable')
      if (result.data === null) receipt = 'missing'
      else {
        const parsed = z.object({
          status: z.enum(['generating', 'failed', 'completed', 'interrupted']),
          user_message_id: z.string().uuid(),
        }).safeParse(result.data)
        if (!parsed.success) throw new Error('Receipt unavailable')
        receipt = parsed.data.status
        receiptUserMessageId = parsed.data.user_message_id
      }
    } catch { receiptUnavailable = true }
  }
  const snapshot = await readOwnedChatSnapshot(client, session)
  const closed = snapshot.session.status !== 'open'
  if (!closed && receiptUnavailable) throw new Error('Receipt unavailable')
  const messages = snapshot.rows.map(row => ({ id: row.id, role: row.role, parts: row.parts }))
  // An owned conversation can be empty when a request failed before admission.
  // The SDK validator rejects an empty list, so validate only nonempty history.
  const validated = messages.length ? await safeValidateUIMessages({ messages }) : null
  if (validated && !validated.success) throw new Error('No se pudo recuperar la conversación')
  const recoveredMessages = validated?.data ?? []
  // A closed session may be the successful result of a lost HTTP response.
  // Its final persisted answer must remain recoverable on the same owned view.
  if (closed) return { closed: true as const, recovery: null, messages: recoveredMessages, receipt, receiptUserMessageId }
  return { closed: false as const, recovery: snapshot.recovery, messages: recoveredMessages, timing: sessionTiming(snapshot.session.opened_at), receipt, receiptUserMessageId }
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
