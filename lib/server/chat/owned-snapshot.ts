import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/shared/supabase/types'
import { ChatRecoverySchema } from '@/lib/shared/chat/recovery'

type OwnedSession = Pick<Database['public']['Tables']['clinical_sessions']['Row'], 'id' | 'user_id' | 'conversation_id' | 'status' | 'opened_at'>

/** Bound a pending turn's completion across separate SSR/action reads. */
export async function readOwnedChatSnapshot(client: SupabaseClient<Database>, session: OwnedSession) {
  async function readRecovery() {
    if (session.status !== 'open') return null
    const { data, error } = await client.rpc('get_chat_turn_recovery', { p_session_id: session.id })
    if (error) throw error
    return data === null ? null : ChatRecoverySchema.parse(data)
  }
  async function readMessages() {
    const { data, error } = await client.from('messages').select('id,role,parts')
      .eq('conversation_id', session.conversation_id).eq('visible_to_user', true).order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  }

  const before = await readRecovery()
  let rows = await readMessages()
  const after = await readRecovery()
  const { data: latest, error } = await client.from('clinical_sessions')
    .select('id,user_id,conversation_id,status,opened_at').eq('id', session.id).eq('user_id', session.user_id).single()
  if (error || !latest || latest.id !== session.id || latest.user_id !== session.user_id || latest.conversation_id !== session.conversation_id) {
    throw new Error('Owned session required')
  }
  // finish_chat_turn commits answer + completed/closure atomically. If that
  // happened around the transcript read, get the committed answer again.
  // A still-generating snapshot retains its normal lease recovery timer.
  if (JSON.stringify(before) !== JSON.stringify(after) || latest.status !== session.status) rows = await readMessages()
  return { session: latest, rows, recovery: latest.status === 'open' ? after : null }
}
