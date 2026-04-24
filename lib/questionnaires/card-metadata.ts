/**
 * UI metadata for clinical questionnaire cards.
 *
 * Provides the clinical title and estimated duration shown on top of the
 * in-chat questionnaire card. Kept as a pure function in `lib/` so it can be
 * unit-tested under the project's `node`-environment vitest config.
 *
 * When a `code` is unknown, falls back to the definition `name` and a
 * generic duration string, so the header degrades gracefully.
 */

export interface QuestionnaireCardHeader {
  title: string
  duration: string
}

const MAP: Record<string, QuestionnaireCardHeader> = {
  PHQ9: {
    title: 'PHQ-9 — Cómo te has sentido estas 2 últimas semanas',
    duration: '9 preguntas · unos 2 minutos',
  },
  GAD7: {
    title: 'GAD-7 — Cómo has estado de ánimo y preocupación estas 2 semanas',
    duration: '7 preguntas · unos 2 minutos',
  },
  ASQ: {
    title: 'ASQ — Unas preguntas breves sobre seguridad',
    duration: '4 ó 5 preguntas · menos de 1 minuto',
  },
}

export function getQuestionnaireCardHeader(
  code: string,
  fallbackName: string,
): QuestionnaireCardHeader {
  const hit = MAP[code]
  if (hit) return hit
  return {
    title: fallbackName,
    duration: 'Unas pocas preguntas · unos minutos',
  }
}
