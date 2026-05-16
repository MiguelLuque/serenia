import type { ScoringResult, QuestionnaireFlag } from './types'

/**
 * Common shape for all questionnaire scoring functions.
 *
 * Plan 8 T0.3 (ADR-017): every scorer registered in `registry.ts` must
 * conform to this signature so the registry can call them uniformly. The
 * caller is responsible for sorting answers by `order_index` and projecting
 * them to a numeric array before invoking the scorer.
 *
 * If a future scorer needs contextual data (e.g. a definition id), it must
 * be supplied via closure at registration time, not as an extra parameter.
 */
export type ScoringStrategy = (answers: number[]) => ScoringResult

/**
 * Score a PHQ-9 questionnaire.
 * Expects exactly 9 answers, each in range 0–3.
 * Item 9 (index 8) >= 1 triggers a suicidality flag.
 */
export const scorePHQ9: ScoringStrategy = (answers) => {
  if (answers.length !== 9) {
    throw new Error(`PHQ-9 requires exactly 9 answers, got ${answers.length}`)
  }
  for (let i = 0; i < answers.length; i++) {
    const v = answers[i]
    if (!Number.isInteger(v) || v < 0 || v > 3) {
      throw new Error(`PHQ-9 item ${i + 1} value must be 0–3, got ${v}`)
    }
  }

  const totalScore = answers.reduce((sum, v) => sum + v, 0)

  let severityBand: ScoringResult['severityBand']
  if (totalScore <= 4) severityBand = 'minimal'
  else if (totalScore <= 9) severityBand = 'mild'
  else if (totalScore <= 14) severityBand = 'moderate'
  else if (totalScore <= 19) severityBand = 'moderately_severe'
  else severityBand = 'severe'

  const flags: QuestionnaireFlag[] = []
  if (answers[8] >= 1) {
    flags.push({ itemOrder: 9, reason: 'suicidality' })
  }

  return {
    totalScore,
    severityBand,
    subscores: {},
    flags,
    requiresReview: flags.length > 0,
  }
}

/**
 * Score a GAD-7 questionnaire.
 * Expects exactly 7 answers, each in range 0–3.
 * No flags defined for this scale.
 */
export const scoreGAD7: ScoringStrategy = (answers) => {
  if (answers.length !== 7) {
    throw new Error(`GAD-7 requires exactly 7 answers, got ${answers.length}`)
  }
  for (let i = 0; i < answers.length; i++) {
    const v = answers[i]
    if (!Number.isInteger(v) || v < 0 || v > 3) {
      throw new Error(`GAD-7 item ${i + 1} value must be 0–3, got ${v}`)
    }
  }

  const totalScore = answers.reduce((sum, v) => sum + v, 0)

  let severityBand: ScoringResult['severityBand']
  if (totalScore <= 4) severityBand = 'minimal'
  else if (totalScore <= 9) severityBand = 'mild'
  else if (totalScore <= 14) severityBand = 'moderate'
  else severityBand = 'severe'

  return {
    totalScore,
    severityBand,
    subscores: {},
    flags: [],
    requiresReview: false,
  }
}

/**
 * Score a BAI (Beck Anxiety Inventory) questionnaire.
 * Expects exactly 21 answers, each in range 0–3.
 *
 * Sin flags de riesgo (BAI no tiene ítem de suicidalidad/autolesión).
 *
 * Bandas firmadas por Pablo el 2026-05-03 — DESVIACIÓN DEL PLAN: el plan
 * original listaba 4 bandas (0-7/8-15/16-25/26-63), Pablo firmó 3:
 *   0-21 minimal / 22-35 moderate / 36-63 severe.
 * Documentado en ADR-024 punto 2.
 */
export const scoreBAI: ScoringStrategy = (answers) => {
  if (answers.length !== 21) {
    throw new Error(`BAI requires exactly 21 answers, got ${answers.length}`)
  }
  for (let i = 0; i < answers.length; i++) {
    const v = answers[i]
    if (!Number.isInteger(v) || v < 0 || v > 3) {
      throw new Error(`BAI item ${i + 1} value must be 0–3, got ${v}`)
    }
  }

  const totalScore = answers.reduce((sum, v) => sum + v, 0)

  let severityBand: ScoringResult['severityBand']
  if (totalScore <= 21) severityBand = 'minimal'
  else if (totalScore <= 35) severityBand = 'moderate'
  else severityBand = 'severe'

  return {
    totalScore,
    severityBand,
    subscores: {},
    flags: [],
    requiresReview: false,
  }
}

/**
 * Score a BDI-II questionnaire.
 * Expects exactly 21 answers, each in range 0–3.
 *
 * Items 16 (sueño) and 18 (apetito) tienen variantes a/b en BD que mapean al
 * mismo valor numérico (1a=1, 1b=1, 2a=2, etc.) — el scorer recibe siempre un
 * entero 0-3 por item, no necesita lógica especial.
 *
 * Item 9 (index 8) ≥ 1 dispara flag `suicidality` (mismo patrón que PHQ-9).
 *
 * Bandas firmadas por Pablo el 2026-05-03 (sin desviación del plan):
 *   0-13 minimal / 14-19 mild / 20-28 moderate / 29-63 severe.
 */
export const scoreBDI2: ScoringStrategy = (answers) => {
  if (answers.length !== 21) {
    throw new Error(`BDI-II requires exactly 21 answers, got ${answers.length}`)
  }
  for (let i = 0; i < answers.length; i++) {
    const v = answers[i]
    if (!Number.isInteger(v) || v < 0 || v > 3) {
      throw new Error(`BDI-II item ${i + 1} value must be 0–3, got ${v}`)
    }
  }

  const totalScore = answers.reduce((sum, v) => sum + v, 0)

  let severityBand: ScoringResult['severityBand']
  if (totalScore <= 13) severityBand = 'minimal'
  else if (totalScore <= 19) severityBand = 'mild'
  else if (totalScore <= 28) severityBand = 'moderate'
  else severityBand = 'severe'

  const flags: QuestionnaireFlag[] = []
  if (answers[8] >= 1) {
    flags.push({ itemOrder: 9, reason: 'suicidality' })
  }

  return {
    totalScore,
    severityBand,
    subscores: {},
    flags,
    requiresReview: flags.length > 0,
  }
}

/**
 * Score an ASQ questionnaire.
 * Expects 4 or 5 answers, each 0 or 1.
 * If any of items 1–4 (indexes 0–3) is 1, band = 'positive', requiresReview = true.
 * If positive and item 5 (index 4) is 1, push acute_risk flag.
 * If negative (all items 1–4 are 0), item 5 is ignored even if present.
 */
export const scoreASQ: ScoringStrategy = (answers) => {
  if (answers.length < 4 || answers.length > 5) {
    throw new Error(`ASQ requires 4 or 5 answers, got ${answers.length}`)
  }
  for (let i = 0; i < answers.length; i++) {
    const v = answers[i]
    if (!Number.isInteger(v) || (v !== 0 && v !== 1)) {
      throw new Error(`ASQ item ${i + 1} value must be 0 or 1, got ${v}`)
    }
  }

  const screeningAnswers = answers.slice(0, 4)
  const totalScore = screeningAnswers.reduce((sum, v) => sum + v, 0)
  const isPositive = screeningAnswers.some((v) => v === 1)

  if (!isPositive) {
    return {
      totalScore,
      severityBand: 'negative',
      subscores: {},
      flags: [],
      requiresReview: false,
    }
  }

  // Positive screen
  const flags: QuestionnaireFlag[] = []
  if (answers.length === 5 && answers[4] === 1) {
    flags.push({ itemOrder: 5, reason: 'acute_risk' })
  }

  return {
    totalScore,
    severityBand: 'positive',
    subscores: {},
    flags,
    requiresReview: true,
  }
}
