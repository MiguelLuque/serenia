import { describe, it, expect } from 'vitest'
import { scoreGAD7 } from '@/lib/clinical/scoring/gad7'

describe('scoreGAD7', () => {
  it('scores all zeros', () => {
    const result = scoreGAD7([0, 0, 0, 0, 0, 0, 0])
    expect(result.totalScore).toBe(0)
    expect(result.severityBand).toBe('minimal')
    expect(result.requiresReview).toBe(false)
  })

  it('scores moderate severity', () => {
    const result = scoreGAD7([2, 2, 2, 2, 1, 1, 0])
    expect(result.totalScore).toBe(10)
    expect(result.severityBand).toBe('moderate')
    expect(result.requiresReview).toBe(true)
  })

  it('requires review for severe', () => {
    const result = scoreGAD7([3, 3, 3, 3, 2, 1, 0])
    expect(result.severityBand).toBe('severe')
    expect(result.requiresReview).toBe(true)
  })

  it('throws if answers array is not length 7', () => {
    expect(() => scoreGAD7([1, 2, 3])).toThrow('GAD-7 requires exactly 7 answers')
  })

  it('throws if any answer is out of range 0-3', () => {
    expect(() => scoreGAD7([0, 0, 0, 0, 0, 0, 4])).toThrow('GAD-7 answers must be 0-3')
  })
})
