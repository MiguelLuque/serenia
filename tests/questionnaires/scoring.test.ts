import { describe, it, expect } from 'vitest'
import { scorePHQ9, scoreGAD7, scoreASQ } from '@/lib/questionnaires/scoring'

// ---------------------------------------------------------------------------
// PHQ-9
// ---------------------------------------------------------------------------

describe('scorePHQ9', () => {
  it('1. all zeros → minimal, score 0, no flags', () => {
    const result = scorePHQ9([0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(result.totalScore).toBe(0)
    expect(result.severityBand).toBe('minimal')
    expect(result.flags).toHaveLength(0)
    expect(result.requiresReview).toBe(false)
  })

  it('2. all 3s → severe, score 27, suicidality flag', () => {
    const result = scorePHQ9([3, 3, 3, 3, 3, 3, 3, 3, 3])
    expect(result.totalScore).toBe(27)
    expect(result.severityBand).toBe('severe')
    expect(result.flags).toHaveLength(1)
    expect(result.flags[0]).toEqual({ itemOrder: 9, reason: 'suicidality' })
    expect(result.requiresReview).toBe(true)
  })

  it('3. score 12 with item 9 = 0 → moderate, no flags', () => {
    // items: 2+2+2+2+2+2+0+0+0 = 12
    const result = scorePHQ9([2, 2, 2, 2, 2, 2, 0, 0, 0])
    expect(result.totalScore).toBe(12)
    expect(result.severityBand).toBe('moderate')
    expect(result.flags).toHaveLength(0)
    expect(result.requiresReview).toBe(false)
  })

  it('4. score 17 with item 9 = 2 → moderately_severe, suicidality flag', () => {
    // items: 2+2+2+2+2+2+2+1+2 = 17
    const result = scorePHQ9([2, 2, 2, 2, 2, 2, 2, 1, 2])
    expect(result.totalScore).toBe(17)
    expect(result.severityBand).toBe('moderately_severe')
    expect(result.flags).toHaveLength(1)
    expect(result.flags[0]).toEqual({ itemOrder: 9, reason: 'suicidality' })
    expect(result.requiresReview).toBe(true)
  })

  it('5. wrong length (8 items) → throws', () => {
    expect(() => scorePHQ9([0, 0, 0, 0, 0, 0, 0, 0])).toThrow()
  })

  it('6. out-of-range value (4) → throws', () => {
    expect(() => scorePHQ9([0, 0, 0, 0, 4, 0, 0, 0, 0])).toThrow()
  })
})

// ---------------------------------------------------------------------------
// GAD-7
// ---------------------------------------------------------------------------

describe('scoreGAD7', () => {
  it('7. all zeros → minimal', () => {
    const result = scoreGAD7([0, 0, 0, 0, 0, 0, 0])
    expect(result.totalScore).toBe(0)
    expect(result.severityBand).toBe('minimal')
    expect(result.flags).toHaveLength(0)
    expect(result.requiresReview).toBe(false)
  })

  it('8. score 10 → moderate', () => {
    // 2+2+2+2+2+0+0 = 10
    const result = scoreGAD7([2, 2, 2, 2, 2, 0, 0])
    expect(result.totalScore).toBe(10)
    expect(result.severityBand).toBe('moderate')
  })

  it('9. score 21 → severe', () => {
    const result = scoreGAD7([3, 3, 3, 3, 3, 3, 3])
    expect(result.totalScore).toBe(21)
    expect(result.severityBand).toBe('severe')
  })

  it('10. wrong length → throws', () => {
    expect(() => scoreGAD7([0, 0, 0, 0, 0, 0])).toThrow()
  })
})

// ---------------------------------------------------------------------------
// ASQ
// ---------------------------------------------------------------------------

describe('scoreASQ', () => {
  it('11. all zeros (4 items) → negative, score 0, no flags, requiresReview false', () => {
    const result = scoreASQ([0, 0, 0, 0])
    expect(result.totalScore).toBe(0)
    expect(result.severityBand).toBe('negative')
    expect(result.flags).toHaveLength(0)
    expect(result.requiresReview).toBe(false)
  })

  it('12. [1,0,0,0] → positive, requiresReview true, no acute flag', () => {
    const result = scoreASQ([1, 0, 0, 0])
    expect(result.severityBand).toBe('positive')
    expect(result.requiresReview).toBe(true)
    expect(result.flags).toHaveLength(0)
  })

  it('13. [1,0,0,0,1] → positive, requiresReview true, acute_risk flag', () => {
    const result = scoreASQ([1, 0, 0, 0, 1])
    expect(result.severityBand).toBe('positive')
    expect(result.requiresReview).toBe(true)
    expect(result.flags).toHaveLength(1)
    expect(result.flags[0]).toEqual({ itemOrder: 5, reason: 'acute_risk' })
  })

  it('14. [0,0,0,0,1] → negative (item 5 ignored if screen negative), no flags', () => {
    const result = scoreASQ([0, 0, 0, 0, 1])
    expect(result.severityBand).toBe('negative')
    expect(result.flags).toHaveLength(0)
    expect(result.requiresReview).toBe(false)
  })

  it('15. wrong length (3) → throws', () => {
    expect(() => scoreASQ([0, 0, 0])).toThrow()
  })
})
