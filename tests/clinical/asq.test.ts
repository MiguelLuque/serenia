import { describe, it, expect } from 'vitest'
import { scoreASQ } from '@/lib/clinical/scoring/asq'

describe('scoreASQ', () => {
  it('returns negative for all zeros', () => {
    const result = scoreASQ([0, 0, 0, 0, 0])
    expect(result.riskLevel).toBe('negative')
    expect(result.requiresReview).toBe(false)
    expect(result.flags).toEqual([])
  })

  it('returns positive_non_acute when item 1 is 1 but item 5 is 0', () => {
    const result = scoreASQ([1, 0, 0, 0, 0])
    expect(result.riskLevel).toBe('positive_non_acute')
    expect(result.requiresReview).toBe(true)
    expect(result.flags).toContain('suicidal_ideation')
  })

  it('returns positive_acute when item 5 is 1', () => {
    const result = scoreASQ([1, 1, 0, 0, 1])
    expect(result.riskLevel).toBe('positive_acute')
    expect(result.requiresReview).toBe(true)
    expect(result.flags).toContain('imminent_risk')
  })

  it('throws if answers array is not length 5', () => {
    expect(() => scoreASQ([1, 0])).toThrow('ASQ requires exactly 5 answers')
  })

  it('throws if answers are not 0 or 1', () => {
    expect(() => scoreASQ([0, 0, 0, 0, 2])).toThrow('ASQ answers must be 0 or 1')
  })
})
