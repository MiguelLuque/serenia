import 'server-only'
import type { PatientContext } from '@/lib/patient-context/builder'
import {
  renderPatientContextBlockWithMeta,
  computeRiskOpeningNotice,
} from '@/lib/patient-context/render'
import { computeQuestionnaireRetakeHint } from '@/lib/patient-context/questionnaire-rules'
import type { ContextTelemetryPayload } from '@/lib/patient-context/telemetry'

/**
 * Plan 6 T10 — pure helper. Given a PatientContext, return the two prompt
 * pieces (`patientContextBlock` and `riskOpeningNotice`) that the chat route
 * injects into the system prompt, plus the telemetry payload (minus the
 * per-request userId/sessionId fields) to be written via the service role.
 *
 * The retake hint (when present) is injected INSIDE the block's "Instrucciones
 * para esta sesión" section as an additional bullet, so the model reads it as
 * part of the instructions rather than as stray text below the `---` separator.
 */
export function assemblePlan6ContextPieces(
  ctx: PatientContext,
  now: Date = new Date(),
): {
  patientContextBlock: string
  riskOpeningNotice: string
  telemetry: Omit<ContextTelemetryPayload, 'userId' | 'sessionId'>
} {
  const retakeHint = computeQuestionnaireRetakeHint(ctx, now)
  const { block, truncatedSections } = renderPatientContextBlockWithMeta(ctx, { retakeHint })
  const riskOpeningNotice = computeRiskOpeningNotice(ctx) ?? ''

  return {
    patientContextBlock: block,
    riskOpeningNotice,
    telemetry: {
      tier: ctx.tier,
      riskState: ctx.riskState,
      blockCharCount: block.length,
      pendingTasksCount: ctx.pendingTasks.length,
      riskTriggered: riskOpeningNotice.length > 0,
      lastValidatedAssessmentId: ctx.validated?.id ?? null,
      truncatedSections,
    },
  }
}
