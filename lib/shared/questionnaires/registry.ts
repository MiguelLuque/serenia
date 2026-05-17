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
  scoreBDI2,
  scoreBAI,
  scoreCSSRS,
} from './scoring'

/**
 * Códigos de cuestionarios soportados. Esta es la fuente única — `types.ts`
 * NO declara este tipo desde Plan 8 Bloque 4. Añadir uno aquí + entrada en
 * `QUESTIONNAIRE_REGISTRY` + seed row en `questionnaire_definitions`.
 */
export type QuestionnaireCode = 'PHQ9' | 'GAD7' | 'BDI2' | 'BAI' | 'CSSRS'

export interface QuestionnaireDefinition {
  code: QuestionnaireCode
  /** Nombre clínico legible. Ej: "PHQ-9 — Depresión". */
  label: string
  /** Etiqueta clínica corta (sin descripción). Ej: "PHQ-9", "BDI-II", "C-SSRS". */
  shortLabel: string
  /** Copy de duración mostrado en QuestionnaireCard. Ej: "5 minutos · 9 preguntas". */
  durationCopy: string
  /**
   * Si es true, el cuestionario lo administra el clínico (no el paciente)
   * y el paciente nunca lo ve en el chat. Tras Plan 8 desviación 1 (HAM-D
   * fuera, ADR-024), todos los cuestionarios actuales son paciente-rated.
   * Mantenemos el flag por si vuelve un clinician-rated más adelante.
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
    shortLabel: 'PHQ-9',
    durationCopy: '9 preguntas · unos 2 minutos',
    isClinicianRated: false,
    scorer: scorePHQ9,
  },
  GAD7: {
    code: 'GAD7',
    label: 'GAD-7 — Cómo has estado de ánimo y preocupación estas 2 semanas',
    shortLabel: 'GAD-7',
    durationCopy: '7 preguntas · unos 2 minutos',
    isClinicianRated: false,
    scorer: scoreGAD7,
  },
  BDI2: {
    code: 'BDI2',
    label: 'BDI-II — Cómo te has sentido estas 2 últimas semanas (en detalle)',
    shortLabel: 'BDI-II',
    durationCopy: '21 grupos de afirmaciones · unos 5 minutos',
    isClinicianRated: false,
    scorer: scoreBDI2,
  },
  BAI: {
    code: 'BAI',
    label: 'BAI — Cómo te ha afectado la ansiedad en la última semana',
    shortLabel: 'BAI',
    durationCopy: '21 preguntas · unos 3 minutos',
    isClinicianRated: false,
    scorer: scoreBAI,
  },
  CSSRS: {
    code: 'CSSRS',
    label: 'C-SSRS — Unas preguntas breves sobre seguridad',
    shortLabel: 'C-SSRS',
    durationCopy: '6 preguntas · menos de 1 minuto',
    isClinicianRated: false,
    scorer: scoreCSSRS,
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
 * Tras Plan 8 Fase 1 T1.1+T1.2:
 *   - Depresión: PHQ-9 (primario) + BDI-II (secundario)
 *   - Ansiedad: GAD-7 (primario) + BAI (secundario)
 * C-SSRS es cribado categórico, no trend. STAI tiene subscores
 * (state/trait) — al implementarse en T1.3 se decidirá si entra aquí o
 * se trata aparte por su shape distinto.
 *
 * Tipados como tupla `as const satisfies` para que un rename de código en
 * el registry rompa al compilar.
 */
export const LONGITUDINAL_CODES = ['PHQ9', 'GAD7', 'BDI2', 'BAI'] as const satisfies readonly QuestionnaireCode[]
export type LongitudinalCode = (typeof LONGITUDINAL_CODES)[number]
