import 'server-only'
import type { PatientContext } from '@/lib/patient-context/builder'
import {
  renderPatientContextBlockWithMeta,
  computeRiskOpeningNotice,
  renderIntakeBlock,
  renderProtocolPhaseSection,
} from '@/lib/patient-context/render'
import { computeQuestionnaireRetakeHint } from '@/lib/patient-context/questionnaire-rules'
import type { ContextTelemetryPayload } from '@/lib/patient-context/telemetry'

/**
 * Plan 6 T10 / Plan 8 T3.4 + T5.2-bis — pure helper. Given a PatientContext,
 * return the prompt pieces the chat route injects into the system prompt,
 * plus the telemetry payload (minus the per-request userId/sessionId fields)
 * to be written via the service role.
 *
 * Returned pieces:
 *  - `patientContextBlock` — heredado de Plan 6 (tier-aware).
 *  - `riskOpeningNotice`   — heredado de Plan 6 (riskState-aware).
 *  - `intakeBlock`         — Plan 8 T3.4: solo se llena en primera sesión.
 *  - `protocolPhaseBlock`  — Plan 8 T5.2-bis: fase TCC/ACT 1-8 o mantenimiento.
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
  intakeBlock: string
  protocolPhaseBlock: string
  telemetry: Omit<ContextTelemetryPayload, 'userId' | 'sessionId'>
} {
  const retakeHint = computeQuestionnaireRetakeHint(ctx, now)
  const { block, truncatedSections } = renderPatientContextBlockWithMeta(ctx, { retakeHint })
  const riskOpeningNotice = computeRiskOpeningNotice(ctx) ?? ''

  // Plan 8 T3.4 — el intake block solo se inyecta en la primera sesión.
  // En sesiones siguientes el `[CONTEXTO DEL PACIENTE]` ya incluye el
  // resumen heredado, y repetir el intake sería ruido.
  const intakeBlock = ctx.isFirstSession ? renderIntakeBlock(ctx.intake, now) : ''

  // Plan 8 T5.2-bis — la fase del protocolo siempre se inyecta. Si el
  // paciente completó las 8 sesiones, el renderer devuelve el bloque
  // de mantenimiento.
  const protocolPhaseBlock = renderProtocolPhaseSection(ctx.protocolPhase, ctx.protocolCompleted)

  return {
    patientContextBlock: block,
    riskOpeningNotice,
    intakeBlock,
    protocolPhaseBlock,
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
