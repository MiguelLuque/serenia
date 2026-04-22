import { describe, it, expect } from 'vitest'
import { derivePatientRiskState } from '@/lib/clinical/risk-rules'

const now = new Date('2026-04-22T12:00:00Z')
const nowMs = now.getTime()
const DAY_MS = 24 * 60 * 60 * 1000
const ago = (days: number) => new Date(nowMs - days * DAY_MS).toISOString()
const future = (days: number) => new Date(nowMs + days * DAY_MS).toISOString()

describe('derivePatientRiskState', () => {
  it('rule 1: critical event → acute even if assessment says none', () => {
    expect(
      derivePatientRiskState({
        lastValidatedAssessment: { reviewedAt: ago(1), suicidality: 'none' },
        openRiskEvents: [{ severity: 'critical', createdAt: ago(2) }],
        previousSession: null,
        now,
      })
    ).toBe('acute')
  })

  it('rule 2: assessment suicidality=acute → acute', () => {
    expect(
      derivePatientRiskState({
        lastValidatedAssessment: { reviewedAt: ago(1), suicidality: 'acute' },
        openRiskEvents: [],
        previousSession: null,
        now,
      })
    ).toBe('acute')
  })

  it('rule 3: assessment suicidality=active → active', () => {
    expect(
      derivePatientRiskState({
        lastValidatedAssessment: { reviewedAt: ago(1), suicidality: 'active' },
        openRiskEvents: [],
        previousSession: null,
        now,
      })
    ).toBe('active')
  })

  it('rule 4: recovery — suicidality=none, reviewedAt after all events AND after crisis-closure → none', () => {
    expect(
      derivePatientRiskState({
        lastValidatedAssessment: { reviewedAt: ago(1), suicidality: 'none' },
        openRiskEvents: [{ severity: 'high', createdAt: ago(5) }],
        previousSession: { closedAt: ago(3), closureReason: 'crisis_detected' },
        now,
      })
    ).toBe('none')
  })

  it('rule 4 NOT triggered: event more recent than assessment → falls through to watch (rule 6)', () => {
    expect(
      derivePatientRiskState({
        lastValidatedAssessment: { reviewedAt: ago(5), suicidality: 'none' },
        openRiskEvents: [{ severity: 'high', createdAt: ago(2) }],
        previousSession: null,
        now,
      })
    ).toBe('watch')
  })

  it('rule 5: suicidality=passive within 21 days → watch', () => {
    expect(
      derivePatientRiskState({
        lastValidatedAssessment: { reviewedAt: ago(10), suicidality: 'passive' },
        openRiskEvents: [],
        previousSession: null,
        now,
      })
    ).toBe('watch')
  })

  it('rule 5 decayed: suicidality=passive older than 21 days → none', () => {
    expect(
      derivePatientRiskState({
        lastValidatedAssessment: { reviewedAt: ago(22), suicidality: 'passive' },
        openRiskEvents: [],
        previousSession: null,
        now,
      })
    ).toBe('none')
  })

  it('rule 6: high-severity event within 21 days → watch', () => {
    expect(
      derivePatientRiskState({
        lastValidatedAssessment: null,
        openRiskEvents: [{ severity: 'high', createdAt: ago(10) }],
        previousSession: null,
        now,
      })
    ).toBe('watch')
  })

  it('rule 6 decayed: high-severity event older than 21 days → none', () => {
    expect(
      derivePatientRiskState({
        lastValidatedAssessment: null,
        openRiskEvents: [{ severity: 'high', createdAt: ago(22) }],
        previousSession: null,
        now,
      })
    ).toBe('none')
  })

  it('rule 7: crisis-closure within 21 days (no recovery) → watch', () => {
    expect(
      derivePatientRiskState({
        lastValidatedAssessment: null,
        openRiskEvents: [],
        previousSession: { closedAt: ago(5), closureReason: 'crisis_detected' },
        now,
      })
    ).toBe('watch')
  })

  it('rule 4 caps rule 7: crisis-closure within 21 days WITH recovery → none', () => {
    expect(
      derivePatientRiskState({
        lastValidatedAssessment: { reviewedAt: ago(1), suicidality: 'none' },
        openRiskEvents: [],
        previousSession: { closedAt: ago(5), closureReason: 'crisis_detected' },
        now,
      })
    ).toBe('none')
  })

  it('rule 8: empty input → none', () => {
    expect(
      derivePatientRiskState({
        lastValidatedAssessment: null,
        openRiskEvents: [],
        previousSession: null,
        now,
      })
    ).toBe('none')
  })

  it('bonus: multiple high events, one recent + one old → watch', () => {
    expect(
      derivePatientRiskState({
        lastValidatedAssessment: null,
        openRiskEvents: [
          { severity: 'high', createdAt: ago(22) },
          { severity: 'high', createdAt: ago(10) },
        ],
        previousSession: null,
        now,
      })
    ).toBe('watch')
  })

  it('bonus: critical event trumps assessment=none recovery → acute', () => {
    expect(
      derivePatientRiskState({
        lastValidatedAssessment: { reviewedAt: ago(1), suicidality: 'none' },
        openRiskEvents: [{ severity: 'critical', createdAt: ago(5) }],
        previousSession: null,
        now,
      })
    ).toBe('acute')
  })
})
