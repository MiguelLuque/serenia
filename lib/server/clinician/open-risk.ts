import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/shared/supabase/types'
import { patientDisplayName } from '@/lib/shared/clinician/display-name'

type RiskType = Database['public']['Enums']['risk_type']
type RiskSeverity = Database['public']['Enums']['risk_severity']

export type OpenSessionRiskSignal = {
  eventId: string
  userId: string
  sessionId: string
  displayName: string | null
  riskType: RiskType
  severity: Extract<RiskSeverity, 'high' | 'critical'>
  createdAt: string
  lastActivityAt: string
}

export const OPEN_RISK_SIGNAL_LIMIT = 50

/**
 * High/critical open risk events whose session has NOT closed yet. The inbox
 * lists closed sessions only, so without this a signal from an abandoned
 * session stays invisible until the daily stale-session sweep. Read-only and
 * RLS-scoped: only a clinician can see other users' rows.
 */
export async function getOpenSessionRiskSignals(supabase: SupabaseClient<Database>): Promise<OpenSessionRiskSignal[]> {
  const { data: events, error } = await supabase
    .from('risk_events')
    .select('id, user_id, session_id, risk_type, severity, created_at')
    .eq('status', 'open')
    .in('severity', ['high', 'critical'])
    .not('session_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(OPEN_RISK_SIGNAL_LIMIT)
  if (error) throw error
  const sessionIds = [...new Set((events ?? []).flatMap(event => event.session_id ? [event.session_id] : []))]
  if (!sessionIds.length) return []

  const { data: sessions, error: sessionsError } = await supabase
    .from('clinical_sessions')
    .select('id, user_id, last_activity_at')
    .in('id', sessionIds)
    .eq('status', 'open')
  if (sessionsError) throw sessionsError
  const openSessions = new Map((sessions ?? []).map(session => [session.id, session]))
  if (!openSessions.size) return []

  const userIds = [...new Set([...openSessions.values()].map(session => session.user_id))]
  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('user_id, display_name, informal_name')
    .in('user_id', userIds)
  if (profilesError) throw profilesError
  const names = new Map((profiles ?? []).map(profile => [profile.user_id, patientDisplayName(profile)]))

  return (events ?? []).flatMap(event => {
    const session = event.session_id ? openSessions.get(event.session_id) : undefined
    // The session must be open and belong to the same patient as the event.
    if (!session || session.user_id !== event.user_id) return []
    if (event.severity !== 'high' && event.severity !== 'critical') return []
    return [{
      eventId: event.id,
      userId: event.user_id,
      sessionId: session.id,
      displayName: names.get(event.user_id) ?? null,
      riskType: event.risk_type,
      severity: event.severity,
      createdAt: event.created_at,
      lastActivityAt: session.last_activity_at,
    }]
  })
}
