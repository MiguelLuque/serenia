/**
 * UI metadata for clinical questionnaire cards.
 *
 * Provides the clinical title and estimated duration shown on top of the
 * in-chat questionnaire card. Kept as a pure function in `lib/` so it can be
 * unit-tested under the project's `node`-environment vitest config.
 *
 * Plan 8 T0.3 (ADR-017): the map is derived from `QUESTIONNAIRE_REGISTRY`
 * so adding a new questionnaire only requires updating the registry.
 *
 * When a `code` is unknown, falls back to the definition `name` and a
 * generic duration string, so the header degrades gracefully.
 */

import { getDefinition } from './registry'

export interface QuestionnaireCardHeader {
  title: string
  duration: string
}

export function getQuestionnaireCardHeader(
  code: string,
  fallbackName: string,
): QuestionnaireCardHeader {
  const def = getDefinition(code)
  if (def) {
    return { title: def.label, duration: def.durationCopy }
  }
  return {
    title: fallbackName,
    duration: 'Unas pocas preguntas · unos minutos',
  }
}
