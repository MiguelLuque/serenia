import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export type ClinicianPatientRow = {
  userId: string
  displayName: string | null
  closedSessionCount: number
  lastClosedAt: string | null
}

/**
 * List patients that have at least one closed clinical session, with
 * aggregate counts and the most recent closure timestamp.
 *
 * Implementation note: supabase-js doesn't expose a clean DISTINCT, so
 * we fetch up to 500 recent closed sessions and aggregate in JS. At
 * 2026 scale this is fine; a DB view can replace it later if needed.
 * Relies on RLS (clinician role can see all closed sessions).
 */
export async function getClinicianPatients(
  supabase: SupabaseClient<Database>
): Promise<ClinicianPatientRow[]> {
  const { data: sessions, error: sessionsError } = await supabase
    .from('clinical_sessions')
    .select('user_id, closed_at')
    .eq('status', 'closed')
    .order('closed_at', { ascending: false })
    .limit(500)

  if (sessionsError) throw sessionsError
  if (!sessions || sessions.length === 0) return []

  // Aggregate: count + max(closed_at) per user.
  const agg = new Map<
    string,
    { closedSessionCount: number; lastClosedAt: string | null }
  >()
  for (const s of sessions) {
    const current = agg.get(s.user_id)
    if (!current) {
      agg.set(s.user_id, {
        closedSessionCount: 1,
        lastClosedAt: s.closed_at,
      })
    } else {
      current.closedSessionCount += 1
      if (
        s.closed_at &&
        (!current.lastClosedAt ||
          new Date(s.closed_at).getTime() >
            new Date(current.lastClosedAt).getTime())
      ) {
        current.lastClosedAt = s.closed_at
      }
    }
  }

  const userIds = Array.from(agg.keys())
  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('user_id, display_name')
    .in('user_id', userIds)

  if (profilesError) throw profilesError

  const nameByUser = new Map<string, string | null>()
  for (const p of profiles ?? []) {
    nameByUser.set(p.user_id, p.display_name ?? null)
  }

  const rows: ClinicianPatientRow[] = userIds.map((userId) => {
    const a = agg.get(userId)!
    return {
      userId,
      displayName: nameByUser.get(userId) ?? null,
      closedSessionCount: a.closedSessionCount,
      lastClosedAt: a.lastClosedAt,
    }
  })

  // Sort by most recent closed session desc; nulls last.
  rows.sort((a, b) => {
    const at = a.lastClosedAt ? new Date(a.lastClosedAt).getTime() : -Infinity
    const bt = b.lastClosedAt ? new Date(b.lastClosedAt).getTime() : -Infinity
    return bt - at
  })

  return rows
}
