import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import {
  generateAssessment,
  AssessmentSkippedError,
} from '@/lib/assessments/generator'

type Supabase = SupabaseClient<Database>

export type SessionRow = Database['public']['Tables']['clinical_sessions']['Row']

// Constants
export const SESSION_MAX_DURATION_MS = 60 * 60 * 1000 // 60 min
export const SESSION_INACTIVITY_MS = 30 * 60 * 1000   // 30 min

export type CloseReason = 'user_request' | 'time_limit' | 'crisis_detected' | 'inactivity'

/**
 * Return the user's currently active session if still valid.
 * If the active session has been inactive >= 30 min, mark it 'closed' with
 * closure_reason='inactivity' and return null.
 * If no open session exists, return null.
 */
export async function getOrResolveActiveSession(
  supabase: Supabase,
  userId: string,
): Promise<SessionRow | null> {
  const { data: session, error } = await supabase
    .from('clinical_sessions')
    .select()
    .eq('user_id', userId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!session) return null

  const lastActivity = new Date(session.last_activity_at).getTime()
  const inactiveDuration = Date.now() - lastActivity

  if (inactiveDuration >= SESSION_INACTIVITY_MS) {
    const { error: updateError } = await supabase
      .from('clinical_sessions')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closure_reason: 'inactivity',
      })
      .eq('id', session.id)
      .eq('status', 'open')

    if (updateError) throw updateError
    return null
  }

  return session
}

/**
 * Create a conversation + clinical_session pair. Returns the created session row.
 * If the session insert fails, deletes the orphan conversation.
 */
export async function createSession(
  supabase: Supabase,
  userId: string,
): Promise<SessionRow> {
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .insert({ user_id: userId, status: 'active', started_at: new Date().toISOString() })
    .select()
    .single()

  if (convError) throw convError

  const { data: session, error: sessionError } = await supabase
    .from('clinical_sessions')
    .insert({ user_id: userId, conversation_id: conversation.id })
    .select()
    .single()

  if (sessionError) {
    // Clean up orphan conversation
    await supabase.from('conversations').delete().eq('id', conversation.id)
    throw sessionError
  }

  return session
}

/**
 * Update last_activity_at = now() for an active session. No-op if not active.
 */
export async function touchSession(
  supabase: Supabase,
  sessionId: string,
): Promise<void> {
  const { error } = await supabase
    .from('clinical_sessions')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('status', 'open')

  if (error) throw error
}

/**
 * Mark session as closed with the given reason. Sets status='closed',
 * closed_at=now(), closure_reason=reason. Also sets conversations.ended_at
 * and status='closed' on the parent conversation.
 */
export async function closeSession(
  supabase: Supabase,
  sessionId: string,
  reason: CloseReason,
): Promise<void> {
  const { data: session, error: fetchError } = await supabase
    .from('clinical_sessions')
    .select('conversation_id, user_id')
    .eq('id', sessionId)
    .single()

  if (fetchError) throw fetchError

  const now = new Date().toISOString()

  const { error: sessionError } = await supabase
    .from('clinical_sessions')
    .update({
      status: 'closed',
      closed_at: now,
      closure_reason: reason,
    })
    .eq('id', sessionId)

  if (sessionError) throw sessionError

  const { error: convError } = await supabase
    .from('conversations')
    .update({ status: 'closed', ended_at: now })
    .eq('id', session.conversation_id)
    .eq('user_id', session.user_id)

  if (convError) throw convError

  try {
    await generateAssessment(supabase, sessionId)
  } catch (err) {
    if (err instanceof AssessmentSkippedError) {
      console.info('[closeSession] assessment skipped', {
        sessionId,
        reason: err.reason,
      })
    } else {
      console.error('[closeSession] assessment failed', {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}

/**
 * Pure function — true if (now - opened_at) >= SESSION_MAX_DURATION_MS.
 */
export function isSessionExpired(
  session: Pick<SessionRow, 'opened_at'>,
  now = Date.now(),
): boolean {
  return now - new Date(session.opened_at).getTime() >= SESSION_MAX_DURATION_MS
}
