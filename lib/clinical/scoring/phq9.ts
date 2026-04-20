import { phq9SeverityBand, type PHQ9SeverityBand } from '@/lib/clinical/severity'

export interface PHQ9Result {
  totalScore: number
  severityBand: PHQ9SeverityBand
  flags: string[]
  requiresReview: boolean
}

export function scorePHQ9(answers: number[]): PHQ9Result {
  if (answers.length !== 9) throw new Error('PHQ-9 requires exactly 9 answers')
  if (answers.some((a) => a < 0 || a > 3)) throw new Error('PHQ-9 answers must be 0-3')

  const totalScore = answers.reduce((sum, a) => sum + a, 0)
  const severityBand = phq9SeverityBand(totalScore)
  const flags: string[] = []

  if (answers[8] >= 1) flags.push('suicidal_ideation')

  const requiresReview = totalScore >= 10 || flags.length > 0

  return { totalScore, severityBand, flags, requiresReview }
}
