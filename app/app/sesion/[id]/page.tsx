import { redirect } from 'next/navigation'
import { safeValidateUIMessages, type UIMessage } from 'ai'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import {
  closeSession,
  isSessionExpired,
  SESSION_MAX_DURATION_MS,
} from '@/lib/sessions/service'
import { getActiveInstanceForSession } from '@/lib/questionnaires/service'
import { ChatView } from '@/components/chat/chat-view'

type MessageRow = { id: string; role: string; parts: unknown }

function rowToCandidate(row: MessageRow): UIMessage {
  // Build a candidate UIMessage that we will validate before handing to the
  // client. If `parts` is missing or malformed we fall back to an empty array
  // so `safeValidateUIMessages` produces a clear error instead of crashing.
  return {
    id: row.id,
    role: row.role as UIMessage['role'],
    parts: Array.isArray(row.parts) ? (row.parts as UIMessage['parts']) : [],
  }
}

const FALLBACK_TEXT = '<mensaje no recuperable>'

function fallbackMessage(row: MessageRow): UIMessage {
  return {
    id: row.id,
    role: row.role as UIMessage['role'],
    parts: [{ type: 'text', text: FALLBACK_TEXT }],
  }
}

/**
 * Validate persisted `messages.parts` against the AI SDK v6 `UIMessage`
 * schema. Each row is validated independently so a single malformed message
 * never crashes the page — instead we log a warning and substitute a
 * placeholder text part. This protects rehydration of `initialMessages`
 * after T1 widened persistence to include tool parts (see plan-7 T1).
 */
async function rehydrateMessages(rows: MessageRow[]): Promise<UIMessage[]> {
  const candidates = rows.map(rowToCandidate)
  const validated = await safeValidateUIMessages({ messages: candidates })
  if (validated.success) return validated.data

  // Fall back to per-row validation so we can isolate the bad row(s).
  console.warn(
    '[session-page] safeValidateUIMessages failed for batch; falling back per-row',
    validated.error,
  )

  const out: UIMessage[] = []
  for (const row of rows) {
    const candidate = rowToCandidate(row)
    const single = await safeValidateUIMessages({ messages: [candidate] })
    if (single.success) {
      out.push(single.data[0])
    } else {
      console.warn(
        `[session-page] dropping invalid message ${row.id}: ${single.error.message}`,
      )
      out.push(fallbackMessage(row))
    }
  }
  return out
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

  const initialMessages: UIMessage[] = await rehydrateMessages(rows ?? [])
  const expiresAt = new Date(
    new Date(session.opened_at).getTime() + SESSION_MAX_DURATION_MS,
  )

  const active = await getActiveInstanceForSession(supabase, session.id)
  const activeQuestionnaire =
    active && active.instance.status !== 'scored'
      ? {
          instanceId: active.instance.id,
          status: active.instance.status as 'proposed' | 'in_progress',
          definition: {
            code: active.definition.code,
            name: active.definition.name,
          },
          items: active.items.map((i) => ({
            id: i.id,
            order_index: i.order_index,
            prompt: i.prompt,
            options_json: i.options_json,
          })),
        }
      : null

  return (
    <ChatView
      sessionId={session.id}
      initialMessages={initialMessages}
      expiresAt={expiresAt}
      activeQuestionnaire={activeQuestionnaire}
    />
  )
}
