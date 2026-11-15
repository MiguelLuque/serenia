import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/shared/supabase/types'
import { enqueueAssessmentGeneration } from '@/lib/server/workflows'
import { createServiceRoleClient } from '@/lib/server/supabase/server'
import { z } from 'zod'
import type { ProtocolPhase } from '@/lib/shared/protocol/render-phase'
import { SESSION_MAX_DURATION_MS, isSessionInactive } from '@/lib/shared/chat/session-time'
export { SESSION_MAX_DURATION_MS, SESSION_INACTIVITY_MS } from '@/lib/shared/chat/session-time'

type Supabase = SupabaseClient<Database>

export type SessionRow = Database['public']['Tables']['clinical_sessions']['Row']

// Constants

export type CloseReason = 'user_request' | 'time_limit' | 'crisis_detected' | 'inactivity'

const ViewCloseResultSchema = z.union([
  z.object({ closed: z.literal(true), newlyClosed: z.boolean().optional() }),
  z.object({
    closed: z.literal(false),
    reason: z.enum(['not_expired', 'turn_pending']),
    timing: z.object({ serverNow: z.number(), expiresAt: z.number() }),
  }),
  z.object({
    closed: z.literal(false),
    reason: z.literal('turn_unresolved'),
    requestId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
    attempt: z.number().int().min(1).max(3),
    timing: z.object({ serverNow: z.number(), expiresAt: z.number() }),
  }),
])

export type ViewCloseResult = z.infer<typeof ViewCloseResultSchema>
export type UnresolvedTurnConfirmation = { requestId: string; attempt: number }
const UnresolvedTurnConfirmationSchema = z.object({
  requestId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
  attempt: z.number().int().min(1).max(3),
}).strict()

/** Start the assessment workflow after a close RPC has committed. */
export async function enqueueAssessmentForClosedSession(sessionId: string): Promise<void> {
  // The database outbox remains the durable fallback if Vercel Workflow is
  // unavailable. This best-effort kick only reduces the time to processing.
  try {
    await enqueueAssessmentGeneration({ sessionId })
  } catch (err) {
    console.error('[closeSession] workflow enqueue failed', {
      sessionId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

/** Close a patient-owned view session with server-side time/turn rechecks. */
export async function requestOwnedSessionClosure(
  supabase: Supabase,
  sessionId: string,
  reason: 'user_request' | 'time_limit',
  confirmUnresolved: UnresolvedTurnConfirmation | null = null,
): Promise<ViewCloseResult> {
  if (reason !== 'user_request' && reason !== 'time_limit') throw new Error('Invalid closure reason')
  if (confirmUnresolved !== null && !UnresolvedTurnConfirmationSchema.safeParse(confirmUnresolved).success) throw new Error('Invalid closure confirmation')
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('No authenticated user')
  const { data: session, error: readError } = await supabase
    .from('clinical_sessions')
    .select('id,user_id,status')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()
  if (readError || !session || session.id !== sessionId || session.user_id !== user.id) throw new Error('Owned session required')
  if (session.status !== 'open') return { closed: true }

  const { data, error } = await supabase.rpc('close_session_from_chat_view', {
    p_session_id: sessionId,
    p_reason: reason,
    ...(confirmUnresolved === null ? {} : {
      p_confirm_request_id: confirmUnresolved.requestId,
      p_confirm_attempt: confirmUnresolved.attempt,
    }),
  })
  if (error) throw new Error('Session close unavailable')
  const result = ViewCloseResultSchema.parse(data)
  if (result.closed && result.newlyClosed) await enqueueAssessmentForClosedSession(sessionId)
  return result
}

/**
 * Return the user's currently active session if still valid.
 * If the active session has been inactive >= 30 min, mark it 'closed' with
 * closure_reason='inactivity', enqueue the assessment workflow, and return null.
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

  if (isSessionInactive(session)) {
    try { await closeSession(supabase, session.id, 'inactivity') }
    catch (error) {
      if (typeof error !== 'object' || !error || !('code' in error) || error.code !== '23514' || !('message' in error) || !['Session activity resumed', 'Unresolved chat turn'].includes(String(error.message))) throw error
      // Activity may have resumed or a turn may still need recovery. SQL
      // rejected the stale close under lock; return the authorized open row.
      const { data: current, error: readError } = await supabase.from('clinical_sessions').select().eq('id', session.id).eq('user_id', userId).eq('status', 'open').maybeSingle()
      if (readError) throw readError
      return current
    }
    return null
  }

  return session
}

/**
 * Plan 8 ADR-015: número máximo de fases del protocolo TCC/ACT.
 * Tras la sesión 8, las sesiones siguientes se quedan en 8 (mantenimiento).
 */
export const PROTOCOL_MAX_PHASE = 8

/**
 * Calcula `protocol_phase` para una nueva sesión a partir del número de
 * sesiones ya cerradas. Plan 8 T5.2 / ADR-015.
 *
 * - 0 cerradas → 1
 * - 1 cerrada → 2
 * - 7 cerradas → 8
 * - ≥ 8 cerradas → 8 (cap; mantenimiento)
 *
 * Retorna `ProtocolPhase` (literal `1|...|8`): el cap superior está garantizado
 * por `Math.min(..., PROTOCOL_MAX_PHASE=8)` y el inferior por `closedCount + 1`
 * con `closedCount ≥ 0`. El narrow-cast es seguro y sella el contrato con el
 * renderer de `lib/protocol/render-phase.ts`.
 */
export function computeProtocolPhase(closedCount: number): ProtocolPhase {
  return Math.min(closedCount + 1, PROTOCOL_MAX_PHASE) as ProtocolPhase
}

/**
 * Create a conversation + clinical_session pair. Returns the created session row.
 * If the session insert fails, deletes the orphan conversation.
 *
 * Plan 8 T5.2: calcula `protocol_phase = min(closed_count + 1, 8)` antes
 * del INSERT. La columna NUNCA se actualiza después; queda fija para la
 * vida de la sesión.
 */
export async function createSession(
  supabase: Supabase,
  userId: string,
): Promise<SessionRow> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user || user.id !== userId) throw new Error('Unauthorized')
  const { data, error } = await supabase.rpc('create_session_atomic', { p_user_id: user.id })
  if (error || !data) throw error ?? new Error('Session not created')
  return data
}

/**
 * Update last_activity_at = now() for an active session. No-op if not active.
 */
export async function touchSession(
  supabase: Supabase,
  sessionId: string,
): Promise<void> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')
  const { error } = await supabase.rpc('touch_session_atomic', { p_session_id: sessionId })

  if (error) throw error
}

/**
 * Close a patient-requested session through its safe owner RPC. Operational
 * closures use the service-only atomic RPC after authenticating the caller.
 *
 * User-request and time-limit closures require the same serialized check used
 * by ChatView. Inactivity/crisis closures are server operations; the service
 * RPC is not executable by ordinary authenticated clients.
 */
export async function closeSession(
  supabase: Supabase,
  sessionId: string,
  reason: CloseReason,
): Promise<void> {
  if (reason === 'user_request' || reason === 'time_limit') {
    const result = await requestOwnedSessionClosure(supabase, sessionId, reason)
    if (!result.closed) throw new Error(`Session close not completed: ${result.reason}`)
    return
  }
  // Necesitamos el user_id para pasarlo a la RPC. La RPC también valida
  // ownership server-side (`raise exception` si no encuentra match), pero
  // hacemos el SELECT primero para que un sessionId desconocido devuelva
  // un mensaje específico de la auth-getUser → user.id, en línea con el
  // contrato anterior.
  const {
    data: { user }, error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('No authenticated user')

  const service = createServiceRoleClient()
  const { error: rpcError } = await service.rpc('close_session_atomic', {
    p_session_id: sessionId,
    p_user_id: user.id,
    p_reason: reason,
  })

  if (rpcError) throw rpcError

  // Plan 7 T6 — errors MUST NOT bubble up: closure is already durable and the
  // database outbox/cron remains the fallback if Vercel Workflow is offline.
  await enqueueAssessmentForClosedSession(sessionId)
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
