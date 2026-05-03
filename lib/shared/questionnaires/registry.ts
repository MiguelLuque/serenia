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
 * table still owns clinical metadata que needs to live in BD (instructions,
 * item prompts, options) pero the code-level branching always goes through
 * `getDefinition()` so we can't end up with a code path that knows about a
 * code the BD doesn't seed (or vice versa).
 */

import {
  type ScoringStrategy,
  scorePHQ9,
  scoreGAD7,
  scoreASQ,
  scoreBDI2,
} from './scoring'

/**
 * Códigos de cuestionarios soportados. Esta es la fuente única — `types.ts`
 * NO declara este tipo desde Plan 8 Bloque 4. Añadir uno aquí + entrada en
 * `QUESTIONNAIRE_REGISTRY` + seed row en `questionnaire_definitions`.
 */
export type QuestionnaireCode = 'PHQ9' | 'GAD7' | 'ASQ' | 'BDI2'

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
  BDI2: {
    code: 'BDI2',
    label: 'BDI-II — Cómo te has sentido estas 2 últimas semanas (en detalle)',
    durationCopy: '21 grupos de afirmaciones · unos 5 minutos',
    isClinicianRated: false,
    scorer: scoreBDI2,
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

/**
 * Codes que se siguen longitudinalmente (trends del inbox y patient view).
 * Tras Plan 8 Fase 1 T1.1: PHQ-9 + BDI-II (depresión, primario y secundario)
 * + GAD-7 (ansiedad). ASQ y C-SSRS son cribados binarios/categóricos, no
 * trends. BAI/STAI se añadirán cuando se implementen (T1.2/T1.3).
 *
 * Tipados como tupla `as const satisfies` para que un rename de código en
 * el registry rompa al compilar.
 */
export const LONGITUDINAL_CODES = ['PHQ9', 'GAD7', 'BDI2'] as const satisfies readonly QuestionnaireCode[]
export type LongitudinalCode = (typeof LONGITUDINAL_CODES)[number]
