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
 * Keeping this logic in a pure function makes it testable without an HTTP
 * harness: the route is left as a thin caller.
 *
 * The retake hint (when present) is appended to the context block on its own
 * line. The block already ends in '---'; wrapping the hint before that
 * separator would require render-level awareness. This placement keeps the
 * rendered block self-contained and the hint visible to the model as an
 * addendum to the Instructions section.
 */
export function assemblePlan6ContextPieces(
  ctx: PatientContext,
  now: Date = new Date(),
): {
  patientContextBlock: string
  riskOpeningNotice: string
  telemetry: Omit<ContextTelemetryPayload, 'userId' | 'sessionId'>
} {
  const { block, truncatedSections } = renderPatientContextBlockWithMeta(ctx)
  const hint = computeQuestionnaireRetakeHint(ctx, now)
  const patientContextBlock = hint ? `${block}\n${hint}` : block
  const riskOpeningNotice = computeRiskOpeningNotice(ctx) ?? ''

  return {
    patientContextBlock,
    riskOpeningNotice,
    telemetry: {
      tier: ctx.tier,
      riskState: ctx.riskState,
      blockCharCount: patientContextBlock.length,
      pendingTasksCount: ctx.pendingTasks.length,
      riskTriggered: riskOpeningNotice.length > 0,
      lastValidatedAssessmentId: ctx.validated?.id ?? null,
      truncatedSections,
    },
  }
}
