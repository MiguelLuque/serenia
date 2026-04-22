export type QuestionnaireCode = 'PHQ9' | 'GAD7' | 'ASQ'

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
