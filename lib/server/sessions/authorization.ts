import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/shared/supabase/types'
import { createServiceRoleClient } from '@/lib/server/supabase/server'

export async function requireOwnedSession(client: SupabaseClient<Database>, sessionId: string, expectedConversationId?: string) {
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')
  const { data: session, error } = await client.from('clinical_sessions').select().eq('id', sessionId).eq('user_id', user.id).single()
  if (error || !session || session.user_id !== user.id || (expectedConversationId && session.conversation_id !== expectedConversationId)) throw new Error('Session not found')
  const { data: conversation, error: parentError } = await client.from('conversations').select('id, user_id').eq('id', session.conversation_id).eq('user_id', user.id).single()
  if (parentError || !conversation || conversation.user_id !== user.id) throw new Error('Conversation ownership mismatch')
  return { user, session, service: createServiceRoleClient() }
}
