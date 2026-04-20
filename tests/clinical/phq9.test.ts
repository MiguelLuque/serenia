import { describe, it, expect } from 'vitest'
import { scorePHQ9 } from '@/lib/clinical/scoring/phq9'

describe('scorePHQ9', () => {
  it('scores all zeros correctly', () => {
    const result = scorePHQ9([0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(result.totalScore).toBe(0)
    expect(result.severityBand).toBe('minimal')
    expect(result.flags).toEqual([])
    expect(result.requiresReview).toBe(false)
  })

  it('scores moderate severity', () => {
    const result = scorePHQ9([2, 2, 2, 2, 1, 1, 0, 0, 0])
    expect(result.totalScore).toBe(10)
    expect(result.severityBand).toBe('moderate')
    expect(result.requiresReview).toBe(true)
  })

  it('flags item 9 when answered >= 1', () => {
    const result = scorePHQ9([0, 0, 0, 0, 0, 0, 0, 0, 1])
    expect(result.flags).toContain('suicidal_ideation')
    expect(result.requiresReview).toBe(true)
  })

  it('does not flag item 9 when answered 0', () => {
    const result = scorePHQ9([0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(result.flags).not.toContain('suicidal_ideation')
  })

  it('throws if answers array is not length 9', () => {
    expect(() => scorePHQ9([1, 2, 3])).toThrow('PHQ-9 requires exactly 9 answers')
  })

  it('throws if any answer is out of range 0-3', () => {
    expect(() => scorePHQ9([0, 0, 0, 0, 0, 0, 0, 0, 4])).toThrow('PHQ-9 answers must be 0-3')
  })
})
