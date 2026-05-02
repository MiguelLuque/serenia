/**
 * Questionnaire registry — single source of truth for code-side metadata.
 *
 * Plan 8 ADR-017: every clinical questionnaire supported by Serenia is
 * declared exactly once in `QUESTIONNAIRE_REGISTRY`. Consumers (chat tool,
 * scoring service, patient context, clinician inbox, UI cards) MUST derive
 * label/duration/scorer from this registry instead of duplicating literal
 * code branches. Adding a new questionnaire = one entry here + the BD seed
 * row in `questionnaire_definitions`.
 *
 * Decision: the registry is STATIC (in code). The `questionnaire_definitions`
 * table still owns clinical metadata that needs to live in BD (instructions,
 * item prompts, options) but the code-level branching always goes through
 * `getDefinition()` so we can't end up with a code path that knows about a
 * code the BD doesn't seed (or vice versa).
 *
 * The canonical `QuestionnaireCode` type lives in `./types` (it predates
 * this registry). Adding a code = update both places — TS will fail-fast
 * at compile time because `QUESTIONNAIRE_REGISTRY` is `Record<QuestionnaireCode, …>`.
 */

import type { QuestionnaireCode } from './types'
import {
  type ScoringStrategy,
  scorePHQ9,
  scoreGAD7,
  scoreASQ,
} from './scoring'

export type { QuestionnaireCode } from './types'

export interface QuestionnaireDefinition {
  code: QuestionnaireCode
  /** Nombre clínico legible. Ej: "PHQ-9 — Depresión". */
  label: string
  /** Copy de duración mostrado en QuestionnaireCard. Ej: "5 minutos · 9 preguntas". */
  durationCopy: string
  /**
   * Si es true, el cuestionario lo administra el clínico (no el paciente)
   * y el paciente nunca lo ve en el chat. Plan 8 Fase 7 introducirá HAM-D
   * como primer cuestionario clinician-rated; los 3 de hoy son paciente-rated.
   */
  isClinicianRated: boolean
  /** Función pura que puntúa las respuestas (ya proyectadas a number[]). */
  scorer: ScoringStrategy
}

export const QUESTIONNAIRE_REGISTRY: Record<
  QuestionnaireCode,
  QuestionnaireDefinition
> = {
  PHQ9: {
    code: 'PHQ9',
    label: 'PHQ-9 — Cómo te has sentido estas 2 últimas semanas',
    durationCopy: '9 preguntas · unos 2 minutos',
    isClinicianRated: false,
    scorer: scorePHQ9,
  },
  GAD7: {
    code: 'GAD7',
    label: 'GAD-7 — Cómo has estado de ánimo y preocupación estas 2 semanas',
    durationCopy: '7 preguntas · unos 2 minutos',
    isClinicianRated: false,
    scorer: scoreGAD7,
  },
  ASQ: {
    code: 'ASQ',
    label: 'ASQ — Unas preguntas breves sobre seguridad',
    durationCopy: '4 ó 5 preguntas · menos de 1 minuto',
    isClinicianRated: false,
    scorer: scoreASQ,
  },
}

/**
 * Look up a questionnaire definition by code. Returns null for unknown
 * codes — callers should treat this as "questionnaire not supported in
 * code yet" and either skip or surface a generic fallback (the chat tool
 * already constrains the code via z.enum, so callers rarely hit null).
 */
export function getDefinition(
  code: string,
): QuestionnaireDefinition | null {
  return code in QUESTIONNAIRE_REGISTRY
    ? QUESTIONNAIRE_REGISTRY[code as QuestionnaireCode]
    : null
}

/** All registered questionnaire codes. Order is the registry insertion order. */
export function listCodes(): QuestionnaireCode[] {
  return Object.keys(QUESTIONNAIRE_REGISTRY) as QuestionnaireCode[]
}

/**
 * Codes that the patient fills in directly (i.e. not clinician-rated).
 * Used by the chat tool's `propose_questionnaire` schema so the IA can
 * never propose a clinician-administered scale to the patient.
 */
export function listPatientCodes(): QuestionnaireCode[] {
  return listCodes().filter(
    (c) => !QUESTIONNAIRE_REGISTRY[c].isClinicianRated,
  )
}
