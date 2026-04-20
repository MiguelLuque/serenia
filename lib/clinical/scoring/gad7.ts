import { gad7SeverityBand, type GAD7SeverityBand } from '@/lib/clinical/severity'

export interface GAD7Result {
  totalScore: number
  severityBand: GAD7SeverityBand
  flags: string[]
  requiresReview: boolean
}

export function scoreGAD7(answers: number[]): GAD7Result {
  if (answers.length !== 7) throw new Error('GAD-7 requires exactly 7 answers')
  if (answers.some((a) => a < 0 || a > 3)) throw new Error('GAD-7 answers must be 0-3')

  const totalScore = answers.reduce((sum, a) => sum + a, 0)
  const severityBand = gad7SeverityBand(totalScore)
  const flags: string[] = []

  const requiresReview = totalScore >= 10

  return { totalScore, severityBand, flags, requiresReview }
}
