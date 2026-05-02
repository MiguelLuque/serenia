// `QuestionnaireCode` vive en `./registry.ts` desde Plan 8 Bloque 4 — el
// registry es la fuente única y declarar el tipo aquí también producía
// drift: el array del registry y este literal podían divergir y solo se
// detectaría al fallar `Record<QuestionnaireCode, …>`. Importa desde
// `@/lib/shared/questionnaires/registry`.

export type SeverityBand =
  | 'minimal'
  | 'mild'
  | 'moderate'
  | 'moderately_severe'
  | 'severe'
  | 'positive'
  | 'negative'

export interface QuestionnaireFlag {
  itemOrder: number
  reason: 'suicidality' | 'acute_risk'
}

export interface ScoringResult {
  totalScore: number
  severityBand: SeverityBand
  subscores: Record<string, number>
  flags: QuestionnaireFlag[]
  requiresReview: boolean
}

export interface AnswerInput {
  itemOrder: number
  valueNumeric: number
  valueRaw: string
}
