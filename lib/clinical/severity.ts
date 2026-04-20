export type PHQ9SeverityBand = 'minimal' | 'mild' | 'moderate' | 'moderately_severe' | 'severe'
export type GAD7SeverityBand = 'minimal' | 'mild' | 'moderate' | 'severe'
export type ASQRiskLevel = 'negative' | 'positive_non_acute' | 'positive_acute'

export function phq9SeverityBand(score: number): PHQ9SeverityBand {
  if (score <= 4) return 'minimal'
  if (score <= 9) return 'mild'
  if (score <= 14) return 'moderate'
  if (score <= 19) return 'moderately_severe'
  return 'severe'
}

export function gad7SeverityBand(score: number): GAD7SeverityBand {
  if (score <= 4) return 'minimal'
  if (score <= 9) return 'mild'
  if (score <= 14) return 'moderate'
  return 'severe'
}

// answers: array of numeric values for items 1-5 (0 or 1)
export function asqRiskLevel(answers: number[]): ASQRiskLevel {
  const [a1, a2, a3, a4, a5] = answers
  if (a5 === 1) return 'positive_acute'
  if (a1 || a2 || a3 || a4) return 'positive_non_acute'
  return 'negative'
}
