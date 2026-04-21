import { redirect } from 'next/navigation'
import type { UIMessage } from 'ai'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import {
  closeSession,
  isSessionExpired,
  SESSION_MAX_DURATION_MS,
} from '@/lib/sessions/service'
import { ChatView } from '@/components/chat/chat-view'

function rowToUIMessage(row: {
  id: string
  role: string
  parts: unknown
}): UIMessage {
  return {
    id: row.id,
    role: row.role as 'user' | 'assistant' | 'system',
    parts: Array.isArray(row.parts) ? (row.parts as UIMessage['parts']) : [],
  }
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createAuthenticatedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: session } = await supabase
    .from('clinical_sessions')
    .select('id, user_id, conversation_id, status, opened_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!session) redirect('/app')
  if (session.status !== 'open') redirect('/app')

  if (isSessionExpired({ opened_at: session.opened_at })) {
    await closeSession(supabase, session.id, 'time_limit')
    redirect('/app')
  }

  const { data: rows } = await supabase
    .from('messages')
    .select('id, role, parts')
    .eq('conversation_id', session.conversation_id)
    .eq('visible_to_user', true)
    .order('created_at', { ascending: true })

  const initialMessages: UIMessage[] = (rows ?? []).map(rowToUIMessage)
  const expiresAt = new Date(
    new Date(session.opened_at).getTime() + SESSION_MAX_DURATION_MS,
  )

  return (
    <ChatView
      sessionId={session.id}
      initialMessages={initialMessages}
      expiresAt={expiresAt}
    />
  )
}
