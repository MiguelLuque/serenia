import 'server-only'

export type ChatSystemPromptPieces = {
  basePrompt: string
  riskOpeningNotice: string
  crisisNotice: string
  questionnaireNotice: string
  timeNotice: string
  /**
   * Plan 8 T3.4 — bloque [INTAKE INICIAL DEL PACIENTE]. Va inmediatamente
   * antes del `patientContextBlock` porque el intake da el marco identitario
   * (nombre, pronombres, motivo) sobre el que el contexto luego enriquece.
   * Solo se inyecta en la primera sesión (el caller pasa '' a partir de la 2ª).
   */
  intakeBlock: string
  patientContextBlock: string
  /**
   * Plan 8 T5.2-bis — bloque [PROTOCOLO Y FASE ACTUAL]. Va después del
   * `patientContextBlock` porque es contenido de protocolo (no de paciente)
   * y debe leerse como la guía clínica para esta sesión específica.
   */
  protocolPhaseBlock: string
}

/**
 * Plan 6 T10 / Plan 8 T3.4 + T5.2-bis — concatenate the system-prompt pieces
 * in the plan-mandated order:
 *
 *     basePrompt
 *   → riskOpeningNotice
 *   → crisisNotice
 *   → questionnaireNotice
 *   → timeNotice
 *   → intakeBlock          (Plan 8: only in first session)
 *   → patientContextBlock
 *   → protocolPhaseBlock   (Plan 8: TCC/ACT phase 1-8 or maintenance)
 *
 * Empty pieces are legitimate (e.g., no crisis this turn) and contribute
 * nothing to the joined string. Keeping this in a tiny pure helper makes the
 * ordering testable without spinning up the full chat handler.
 */
export function buildChatSystemPrompt(pieces: ChatSystemPromptPieces): string {
  return [
    pieces.basePrompt,
    pieces.riskOpeningNotice,
    pieces.crisisNotice,
    pieces.questionnaireNotice,
    pieces.timeNotice,
    pieces.intakeBlock,
    pieces.patientContextBlock,
    pieces.protocolPhaseBlock,
  ].join('')
}
