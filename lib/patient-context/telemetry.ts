import 'server-only'
import type { PatientContextTier } from '@/lib/patient-context/builder'
import type { PatientRiskState } from '@/lib/clinical/risk-rules'
import { createServiceRoleClient } from '@/lib/supabase/server'

export type ContextTelemetryPayload = {
  userId: string
  sessionId: string
  tier: PatientContextTier
  riskState: PatientRiskState
  blockCharCount: number
  pendingTasksCount: number
  riskTriggered: boolean
  lastValidatedAssessmentId: string | null
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
