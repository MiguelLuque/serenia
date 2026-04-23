import 'server-only'

export type ChatSystemPromptPieces = {
  basePrompt: string
  riskOpeningNotice: string
  crisisNotice: string
  questionnaireNotice: string
  timeNotice: string
  patientContextBlock: string
}

/**
 * Plan 6 T10 — concatenate the system-prompt pieces in the plan-mandated order
 * (basePrompt → risk → crisis → questionnaire → time → patientContextBlock).
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
    pieces.patientContextBlock,
  ].join('')
}
