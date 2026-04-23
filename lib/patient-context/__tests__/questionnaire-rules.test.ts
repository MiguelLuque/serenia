import { describe, it, expect } from 'vitest'
import { computeQuestionnaireRetakeHint } from '@/lib/patient-context/questionnaire-rules'
import type { PatientContext } from '@/lib/patient-context/builder'

// Fixed reference point for deterministic tests
const NOW = new Date('2026-04-22T12:00:00Z')

const MS_PER_DAY = 24 * 60 * 60 * 1000

function daysAgoMs(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString()
}

function daysAgo(n: number): string {
  return daysAgoMs(n * MS_PER_DAY)
}

// Minimal PatientContext with only the fields we need
function makeCtx(
  questionnaires: PatientContext['recentQuestionnaires'],
): PatientContext {
  return {
    tier: 'none',
    isFirstSession: false,
    patient: { displayName: null, age: null },
    validated: null,
    tierBDraft: null,
    recentQuestionnaires: questionnaires,
    openRiskEvents: [],
    previousSession: null,
    pendingTasks: [],
    sessionNumber: 1,
    riskState: 'none',
  }
}

describe('computeQuestionnaireRetakeHint', () => {
  // 1. No questionnaires → null
  it('returns null when there are no questionnaires', () => {
    const ctx = makeCtx([])
    expect(computeQuestionnaireRetakeHint(ctx, NOW)).toBeNull()
  })

  // 2. PHQ-9 score 16, scoredAt 10 days ago → severe hint
  it('returns severe PHQ-9 hint when score >= 15 and scoredAt > 7 days ago', () => {
    const ctx = makeCtx([{ code: 'PHQ9', score: 16, band: 'severe', scoredAt: daysAgo(10), deltaVsPrevious: null }])
    const result = computeQuestionnaireRetakeHint(ctx, NOW)
    expect(result).not.toBeNull()
    expect(result).toContain('PHQ-9')
    expect(result).toContain('severo')
    expect(result).toContain('semana')
  })

  // 3. PHQ-9 score 12, scoredAt 5 days ago → null (too recent for moderate rule)
  it('returns null when PHQ-9 moderate but scoredAt is only 5 days ago', () => {
    const ctx = makeCtx([{ code: 'PHQ9', score: 12, band: 'moderate', scoredAt: daysAgo(5), deltaVsPrevious: null }])
    expect(computeQuestionnaireRetakeHint(ctx, NOW)).toBeNull()
  })

  // 4. PHQ-9 score 12, scoredAt 16 days ago → moderate hint only
  it('returns moderate PHQ-9 hint when score >= 10 and scoredAt > 14 days ago', () => {
    const ctx = makeCtx([{ code: 'PHQ9', score: 12, band: 'moderate', scoredAt: daysAgo(16), deltaVsPrevious: null }])
    const result = computeQuestionnaireRetakeHint(ctx, NOW)
    expect(result).not.toBeNull()
    expect(result).toContain('PHQ-9')
    expect(result).toContain('moderado')
    expect(result).toContain('dos semanas')
  })

  // 5. PHQ-9 score 16, scoredAt 16 days ago → severe hint ONLY (not moderate)
  it('emits only severe hint when both severe and moderate rules match (priority dedup)', () => {
    const ctx = makeCtx([{ code: 'PHQ9', score: 16, band: 'severe', scoredAt: daysAgo(16), deltaVsPrevious: null }])
    const result = computeQuestionnaireRetakeHint(ctx, NOW)
    expect(result).not.toBeNull()
    expect(result).toContain('severo')
    expect(result).not.toContain('moderado')
    // Should be a single hint, not combined with itself
    const severeHint = 'el PHQ-9 del paciente era severo'
    const count = (result!.match(new RegExp(severeHint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length
    expect(count).toBe(1)
  })

  // 6. GAD-7 score 17, scoredAt 8 days ago → severe GAD-7 hint only
  it('returns severe GAD-7 hint when score >= 15 and scoredAt > 7 days ago', () => {
    const ctx = makeCtx([{ code: 'GAD7', score: 17, band: 'severe', scoredAt: daysAgo(8), deltaVsPrevious: null }])
    const result = computeQuestionnaireRetakeHint(ctx, NOW)
    expect(result).not.toBeNull()
    expect(result).toContain('GAD-7')
    expect(result).toContain('severo')
    expect(result).toContain('semana')
  })

  // 7. GAD-7 score 11, scoredAt 20 days ago → moderate GAD-7 hint only
  it('returns moderate GAD-7 hint when score >= 10 and scoredAt > 14 days ago', () => {
    const ctx = makeCtx([{ code: 'GAD7', score: 11, band: 'moderate', scoredAt: daysAgo(20), deltaVsPrevious: null }])
    const result = computeQuestionnaireRetakeHint(ctx, NOW)
    expect(result).not.toBeNull()
    expect(result).toContain('GAD-7')
    expect(result).toContain('moderado')
    expect(result).toContain('dos semanas')
  })

  // 8. PHQ-9 severe >7d + GAD-7 moderate >14d → combined hint with both
  it('combines PHQ-9 and GAD-7 hints into a single string when both match', () => {
    const ctx = makeCtx([
      { code: 'PHQ9', score: 16, band: 'severe', scoredAt: daysAgo(10), deltaVsPrevious: null },
      { code: 'GAD7', score: 11, band: 'moderate', scoredAt: daysAgo(20), deltaVsPrevious: null },
    ])
    const result = computeQuestionnaireRetakeHint(ctx, NOW)
    expect(result).not.toBeNull()
    expect(result).toContain('PHQ-9')
    expect(result).toContain('GAD-7')
    expect(result).toContain('severo')
    expect(result).toContain('moderado')
  })

  // 9. PHQ-9 score 8, scoredAt 30 days ago → null (score too low)
  it('returns null when PHQ-9 score is below moderate threshold', () => {
    const ctx = makeCtx([{ code: 'PHQ9', score: 8, band: 'mild', scoredAt: daysAgo(30), deltaVsPrevious: null }])
    expect(computeQuestionnaireRetakeHint(ctx, NOW)).toBeNull()
  })

  // 10. ASQ severe >7d → null (ASQ not covered)
  it('returns null for ASQ entries regardless of score or age', () => {
    const ctx = makeCtx([{ code: 'ASQ', score: 20, band: 'severe', scoredAt: daysAgo(30), deltaVsPrevious: null }])
    expect(computeQuestionnaireRetakeHint(ctx, NOW)).toBeNull()
  })

  // 11. Multiple PHQ-9 entries → uses first (most recent)
  it('uses the most recent entry (first in array) when multiple PHQ-9 entries exist', () => {
    // First entry is newer (low score), second is older (high score)
    // Should return null because the most recent is below threshold
    const ctx = makeCtx([
      { code: 'PHQ9', score: 5, band: 'mild', scoredAt: daysAgo(10), deltaVsPrevious: null },
      { code: 'PHQ9', score: 18, band: 'severe', scoredAt: daysAgo(30), deltaVsPrevious: null },
    ])
    expect(computeQuestionnaireRetakeHint(ctx, NOW)).toBeNull()
  })

  // 12. Exactly 7 days ago → should NOT trigger severe (strict < not ≤)
  it('does not trigger severe rule when scoredAt is exactly 7 days ago (boundary)', () => {
    const exactlySevenDaysMs = 7 * MS_PER_DAY
    const ctx = makeCtx([{ code: 'PHQ9', score: 16, band: 'severe', scoredAt: daysAgoMs(exactlySevenDaysMs), deltaVsPrevious: null }])
    expect(computeQuestionnaireRetakeHint(ctx, NOW)).toBeNull()
  })

  // 13. Just over 7 days (7 days + 1 ms) → triggers severe
  it('triggers severe rule when scoredAt is 7 days and 1 ms ago', () => {
    const justOverSevenDaysMs = 7 * MS_PER_DAY + 1
    const ctx = makeCtx([{ code: 'PHQ9', score: 16, band: 'severe', scoredAt: daysAgoMs(justOverSevenDaysMs), deltaVsPrevious: null }])
    const result = computeQuestionnaireRetakeHint(ctx, NOW)
    expect(result).not.toBeNull()
    expect(result).toContain('PHQ-9')
    expect(result).toContain('severo')
  })
})
