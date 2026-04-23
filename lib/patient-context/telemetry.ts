import 'server-only'
import type { PatientContextTier } from '@/lib/patient-context/builder'
import type { PatientRiskState } from '@/lib/clinical/risk-rules'
import { createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Names of the patient-context sections that the 2500-char truncation cascade
 * in `renderPatientContextBlockWithMeta` can drop. Consumers of the telemetry
 * table (dashboards, BI queries on `patient_context_injections.truncated_sections`)
 * can expect exactly these string values, in this order when multiple fire.
 *
 * Source of truth: the `truncatedSections.push(...)` call sites in
 * [`lib/patient-context/render.ts`](./render.ts) (L206, L240, L269).
 *
 * - `'areas_for_exploration'` — the "Áreas a explorar pendientes" section was
 *   removed (cascade step 1, fires first when the block > 2500 chars).
 * - `'presenting_issues'` — the "Síntomas presentes" section was also removed
 *   (cascade step 2, fires when step 1 alone wasn't enough).
 * - `'chief_complaint_capped'` — the `chief_complaint` text was capped from
 *   300 → 150 chars (cascade step 3, fires when steps 1 and 2 combined still
 *   left the block > 2500 chars). If after step 3 the block is still too big,
 *   the block is hard-sliced to 2500 chars, but no new section name is added.
 *
 * tierB and tier=none blocks never truncate, so this union is only ever
 * populated for `tier='tierA'` and `tier='historic'` rows.
 */
export type TruncatedSection =
  | 'areas_for_exploration'
  | 'presenting_issues'
  | 'chief_complaint_capped'

export type ContextTelemetryPayload = {
  userId: string
  sessionId: string
  tier: PatientContextTier
  riskState: PatientRiskState
  blockCharCount: number
  pendingTasksCount: number
  riskTriggered: boolean
  lastValidatedAssessmentId: string | null
  /**
   * Sections dropped or capped by the 2500-char truncation cascade. The only
   * valid values are those of {@link TruncatedSection}; the field is typed as
   * `string[]` (not `TruncatedSection[]`) because `renderPatientContextBlockWithMeta`
   * builds it by pushing literals and the DB column is `text[]`. Keep the
   * documented union in sync with the push call sites in `render.ts`.
   */
  truncatedSections: string[]
}

/**
 * Plan 6 T10: append one row to `patient_context_injections` via the service
 * role. The table has no INSERT RLS policy — writes are service-role only —
 * and callers should invoke this fire-and-forget (never block the chat).
 */
export async function logContextInjection(payload: ContextTelemetryPayload): Promise<void> {
  const serviceRole = createServiceRoleClient()
  const { error } = await serviceRole.from('patient_context_injections').insert({
    user_id: payload.userId,
    session_id: payload.sessionId,
    tier: payload.tier,
    risk_state: payload.riskState,
    block_char_count: payload.blockCharCount,
    pending_tasks_count: payload.pendingTasksCount,
    risk_triggered: payload.riskTriggered,
    last_validated_assessment_id: payload.lastValidatedAssessmentId,
    truncated_sections: payload.truncatedSections,
  })
  if (error) throw error
}
