import { describe, it, expect } from 'vitest'
import {
  phq9SeverityBand,
  gad7SeverityBand,
  asqRiskLevel,
} from '@/lib/clinical/severity'

describe('phq9SeverityBand', () => {
  it('returns minimal for 0-4', () => {
    expect(phq9SeverityBand(0)).toBe('minimal')
    expect(phq9SeverityBand(4)).toBe('minimal')
  })
  it('returns mild for 5-9', () => {
    expect(phq9SeverityBand(5)).toBe('mild')
    expect(phq9SeverityBand(9)).toBe('mild')
  })
  it('returns moderate for 10-14', () => {
    expect(phq9SeverityBand(10)).toBe('moderate')
    expect(phq9SeverityBand(14)).toBe('moderate')
  })
  it('returns moderately_severe for 15-19', () => {
    expect(phq9SeverityBand(15)).toBe('moderately_severe')
    expect(phq9SeverityBand(19)).toBe('moderately_severe')
  })
  it('returns severe for 20-27', () => {
    expect(phq9SeverityBand(20)).toBe('severe')
    expect(phq9SeverityBand(27)).toBe('severe')
  })
})

describe('gad7SeverityBand', () => {
  it('returns minimal for 0-4', () => expect(gad7SeverityBand(0)).toBe('minimal'))
  it('returns mild for 5-9', () => expect(gad7SeverityBand(5)).toBe('mild'))
  it('returns moderate for 10-14', () => expect(gad7SeverityBand(10)).toBe('moderate'))
  it('returns severe for 15-21', () => expect(gad7SeverityBand(15)).toBe('severe'))
})

describe('asqRiskLevel', () => {
  it('returns negative for all zeros', () => expect(asqRiskLevel([0, 0, 0, 0, 0])).toBe('negative'))
  it('returns positive_non_acute for item 1-4 positive but item 5 negative', () => {
    expect(asqRiskLevel([1, 0, 0, 0, 0])).toBe('positive_non_acute')
  })
  it('returns positive_acute for item 5 positive', () => {
    expect(asqRiskLevel([1, 1, 0, 0, 1])).toBe('positive_acute')
  })
})
