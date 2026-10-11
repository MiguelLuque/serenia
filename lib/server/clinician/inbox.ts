import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/shared/supabase/types'
import type { PatientRiskState } from '@/lib/server/risk-rules'
import { z } from 'zod'
import { type LongitudinalCode } from '@/lib/shared/questionnaires/registry'

type AssessmentStatus = Database['public']['Enums']['assessment_status']
type RiskSeverity = Database['public']['Enums']['risk_severity']

export type InboxRow = {
  sessionId: string
  userId: string
  displayName: string | null
  closedAt: string | null
  closureReason: string | null
  assessmentStatus: AssessmentStatus | null
  hasCrisis: boolean
  topRisk: RiskSeverity | null
  // T11 longitudinal fields
  sessionNumber: number
  daysSincePrevious: number | null
  /**
   * Plan 8 Fase 1 (ADR-021 punto #1): trends por code, en lugar de campos
   * fijos `phq9Trend` / `gad7Trend`. Indexado por `LongitudinalCode`. Solo
   * los códigos con resultados aparecen como keys (Partial). Cada array es
   * `oldest → newest`, máximo 3 valores.
   */
  trendsByCode: Partial<Record<LongitudinalCode, number[]>>
  openTasksCount: number
  riskState: PatientRiskState
}

const InboxRowSchema = z.object({
  sessionId: z.string(), userId: z.string(), displayName: z.string().nullable(),
  closedAt: z.string().nullable(), closureReason: z.string().nullable(),
  assessmentStatus: z.enum(['draft_ai','reviewed_confirmed','reviewed_modified','rejected','superseded','requires_manual_review']).nullable(),
  hasCrisis: z.boolean(), topRisk: z.enum(['low','moderate','high','critical']).nullable(),
  sessionNumber: z.number(), daysSincePrevious: z.number().nullable(),
  trendsByCode: z.object({ PHQ9: z.array(z.number()).optional(), GAD7: z.array(z.number()).optional(), BDI2: z.array(z.number()).optional(), BAI: z.array(z.number()).optional() }),
  openTasksCount: z.number(), riskState: z.enum(['none','watch','active','acute']),
})
const InboxPageSchema = z.object({ rows: z.array(InboxRowSchema).max(100), hasMore: z.boolean() })

/**
 * Sort by the approved patient risk priority, then pending review,
 * then closed_at descending. SQL applies this order before pagination.
 *
 * Exported for unit testing.
 */
export function sortInboxRows(rows: InboxRow[]): InboxRow[] {
  const isUnreviewed = (row: InboxRow): boolean =>
    row.assessmentStatus === null || row.assessmentStatus === 'draft_ai' || row.assessmentStatus === 'requires_manual_review'

  return [...rows].sort((a, b) => {
    const rank = { none: 0, watch: 1, active: 2, acute: 3 }
    const priority = (row: InboxRow) => rank[row.riskState]
    const urgency = priority(b) - priority(a)
    if (urgency) return urgency
    const aUnreviewed = isUnreviewed(a) ? 1 : 0
    const bUnreviewed = isUnreviewed(b) ? 1 : 0
    if (aUnreviewed !== bUnreviewed) {
      return bUnreviewed - aUnreviewed
    }
    // closed_at desc — nulls last
    const aTime = a.closedAt ? new Date(a.closedAt).getTime() : -Infinity
    const bTime = b.closedAt ? new Date(b.closedAt).getTime() : -Infinity
    return bTime - aTime || b.sessionId.localeCompare(a.sessionId)
  })
}

/** The database filters and globally prioritizes before pagination. */
export async function getClinicianInboxPage(supabase: SupabaseClient<Database>, options: { page?: number; pendingOnly?: boolean } = {}) {
  const page = Math.max(1, Math.floor(options.page ?? 1))
  const { data, error } = await supabase.rpc('get_clinician_inbox_page', { p_offset: (page - 1) * 100, p_limit: 100, p_pending_only: options.pendingOnly ?? false })
  if (error) throw error
  return InboxPageSchema.parse(data)
}

export async function getClinicianInbox(supabase: SupabaseClient<Database>, options: { page?: number; pendingOnly?: boolean } = {}): Promise<InboxRow[]> {
  return (await getClinicianInboxPage(supabase, options)).rows
}
