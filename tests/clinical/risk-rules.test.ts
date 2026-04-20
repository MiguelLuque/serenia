import { describe, it, expect } from 'vitest'
import {
  shouldAdministerPHQ9,
  shouldAdministerGAD7,
  shouldAdministerASQ,
  QUESTIONNAIRE_COOLDOWN_DAYS,
} from '@/lib/clinical/risk-rules'

const DAYS = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

describe('shouldAdministerPHQ9', () => {
  it('returns true when no recent result', () => {
    expect(shouldAdministerPHQ9(null)).toBe(true)
  })
  it('returns false when result is within cooldown period', () => {
    expect(shouldAdministerPHQ9(DAYS(5))).toBe(false)
  })
  it('returns true when result is outside cooldown period', () => {
    expect(shouldAdministerPHQ9(DAYS(15))).toBe(true)
  })
})

describe('shouldAdministerGAD7', () => {
  it('returns true when no recent result', () => {
    expect(shouldAdministerGAD7(null)).toBe(true)
  })
  it('returns false within cooldown', () => {
    expect(shouldAdministerGAD7(DAYS(5))).toBe(false)
  })
  it('returns true outside cooldown', () => {
    expect(shouldAdministerGAD7(DAYS(15))).toBe(true)
  })
})

describe('shouldAdministerASQ', () => {
  it('returns true when triggered by risk signal regardless of recency', () => {
    expect(shouldAdministerASQ({ triggeredByRiskSignal: true, lastAdministeredAt: DAYS(1) })).toBe(true)
  })
  it('returns false when no risk signal and administered today', () => {
    expect(shouldAdministerASQ({ triggeredByRiskSignal: false, lastAdministeredAt: DAYS(0) })).toBe(false)
  })
  it('returns false when no risk signal and never administered', () => {
    expect(shouldAdministerASQ({ triggeredByRiskSignal: false, lastAdministeredAt: null })).toBe(false)
  })
})

describe('QUESTIONNAIRE_COOLDOWN_DAYS', () => {
  it('is 14 days', () => {
    expect(QUESTIONNAIRE_COOLDOWN_DAYS).toBe(14)
  })
})
