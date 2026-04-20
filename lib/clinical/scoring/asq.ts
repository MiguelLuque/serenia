import { asqRiskLevel, type ASQRiskLevel } from '@/lib/clinical/severity'

export interface ASQResult {
  riskLevel: ASQRiskLevel
  flags: string[]
  requiresReview: boolean
}

export function scoreASQ(answers: number[]): ASQResult {
  if (answers.length !== 5) throw new Error('ASQ requires exactly 5 answers')
  if (answers.some((a) => a !== 0 && a !== 1)) throw new Error('ASQ answers must be 0 or 1')

  const riskLevel = asqRiskLevel(answers)
  const flags: string[] = []

  if (riskLevel !== 'negative') flags.push('suicidal_ideation')
  if (riskLevel === 'positive_acute') flags.push('imminent_risk')

  const requiresReview = riskLevel !== 'negative'

  return { riskLevel, flags, requiresReview }
}
