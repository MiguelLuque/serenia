import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { enqueueAssessmentGeneration } from '@/lib/workflows'
import type { ProtocolPhase } from '@/lib/protocol/render-phase'

type Supabase = SupabaseClient<Database>

export type SessionRow = Database['public']['Tables']['clinical_sessions']['Row']

// Constants
export const SESSION_MAX_DURATION_MS = 60 * 60 * 1000 // 60 min
export const SESSION_INACTIVITY_MS = 30 * 60 * 1000   // 30 min

export type CloseReason = 'user_request' | 'time_limit' | 'crisis_detected' | 'inactivity'

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

    // Plan 7 T6: lazy-close path used to drop the assessment entirely. Now
    // we enqueue the same async generator so abandoned sessions still surface
    // in the clinician inbox. Failures here are non-fatal — getOrResolve must
    // not throw if the workflow enqueue fails (e.g. WDK misconfigured); the
    // primary contract is "return null after marking the session closed".
    try {
      await enqueueAssessmentGeneration({ sessionId: session.id })
    } catch (err) {
      console.error('[getOrResolveActiveSession] enqueue failed', {
        sessionId: session.id,
        error: err instanceof Error ? err.message : String(err),
      })
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
  // Plan 8 T5.2: contar sesiones cerradas del usuario para fijar la fase.
  // Si el count falla, dejamos el default de la columna (1) y avisamos.
  // Decisión: el cálculo vive aquí (no en trigger SQL) — más legible y
  // testeable; la columna BD tiene default 1 como red de seguridad.
  const { count, error: countError } = await supabase
    .from('clinical_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'closed')

  if (countError) throw countError

  const protocolPhase = computeProtocolPhase(count ?? 0)

  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .insert({ user_id: userId, status: 'active', started_at: new Date().toISOString() })
    .select()
    .single()

  if (convError) throw convError

  const { data: session, error: sessionError } = await supabase
    .from('clinical_sessions')
    .insert({
      user_id: userId,
      conversation_id: conversation.id,
      protocol_phase: protocolPhase,
    })
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
 *
 * Plan 8 Bloque 2 Fix 3 — atomicidad: antes hacíamos 2 UPDATEs separados
 * (clinical_sessions luego conversations). Si el segundo fallaba la BD
 * quedaba inconsistente. Ahora delegamos a la función Postgres
 * `close_session_atomic` que envuelve ownership-check + ambos UPDATEs en
 * la misma transacción plpgsql. Ver migration 20260502000006.
 *
 * Mantiene la firma pública: si la RPC falla (incluyendo
 * "session not found for user"), throw-ea como antes.
 *
 * After the close commits, enqueues the background `generateAssessmentWorkflow`
 * (Vercel WDK). The workflow is idempotent — duplicate fires from the cron or
 * lazy-close path become no-ops via the closure assessment unique check.
 */
export async function closeSession(
  supabase: Supabase,
  sessionId: string,
  reason: CloseReason,
): Promise<void> {
  // Necesitamos el user_id para pasarlo a la RPC. La RPC también valida
  // ownership server-side (`raise exception` si no encuentra match), pero
  // hacemos el SELECT primero para que un sessionId desconocido devuelva
  // un mensaje específico de la auth-getUser → user.id, en línea con el
  // contrato anterior.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('No authenticated user')

  const { error: rpcError } = await supabase.rpc('close_session_atomic', {
    p_session_id: sessionId,
    p_user_id: user.id,
    p_reason: reason,
  })

  if (rpcError) throw rpcError

  // Plan 7 T6 — fire-and-forget enqueue. Errors here MUST NOT bubble up:
  // the session is already closed in BD, and the user-facing response should
  // not 500 because Vercel Workflow is unreachable. The cron stale-session
  // sweep will eventually re-enqueue any session whose workflow never started.
  try {
    await enqueueAssessmentGeneration({ sessionId })
  } catch (err) {
    console.error('[closeSession] workflow enqueue failed', {
      sessionId,
      error: err instanceof Error ? err.message : String(err),
    })
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
