import { describe, it, expect } from 'vitest'
import {
  QUESTIONNAIRE_REGISTRY,
  getDefinition,
  listCodes,
  listPatientCodes,
} from '@/lib/shared/questionnaires/registry'

describe('questionnaire registry', () => {
  it('returns a definition for a known code', () => {
    const def = getDefinition('PHQ9')
    expect(def).not.toBeNull()
    expect(def?.code).toBe('PHQ9')
    expect(def?.label).toMatch(/PHQ-9/)
    expect(def?.durationCopy).toMatch(/preguntas/)
    expect(def?.isClinicianRated).toBe(false)
    expect(typeof def?.scorer).toBe('function')
  })

  it('returns a definition for GAD7, ASQ, BDI2, BAI and CSSRS as well', () => {
    const gad = getDefinition('GAD7')
    const asq = getDefinition('ASQ')
    const bdi = getDefinition('BDI2')
    const bai = getDefinition('BAI')
    const cssrs = getDefinition('CSSRS')
    expect(gad).not.toBeNull()
    expect(asq).not.toBeNull()
    expect(bdi).not.toBeNull()
    expect(bai).not.toBeNull()
    expect(cssrs).not.toBeNull()
    expect(gad?.code).toBe('GAD7')
    expect(asq?.code).toBe('ASQ')
    expect(bdi?.code).toBe('BDI2')
    expect(bai?.code).toBe('BAI')
    expect(cssrs?.code).toBe('CSSRS')
  })

  it('returns null for an unknown code', () => {
    expect(getDefinition('UNKNOWN')).toBeNull()
    expect(getDefinition('')).toBeNull()
  })

  it('lists all six codes (PHQ9, GAD7, ASQ, BDI2, BAI, CSSRS)', () => {
    const codes = listCodes()
    expect(codes).toHaveLength(6)
    expect(codes).toEqual(
      expect.arrayContaining(['PHQ9', 'GAD7', 'ASQ', 'BDI2', 'BAI', 'CSSRS']),
    )
  })

  it('lists all six codes as patient-rated (none is clinician-rated yet)', () => {
    const patient = listPatientCodes()
    expect(patient).toHaveLength(6)
    expect(patient).toEqual(
      expect.arrayContaining(['PHQ9', 'GAD7', 'ASQ', 'BDI2', 'BAI', 'CSSRS']),
    )
  })

  it('every registered definition exposes a callable scorer', () => {
    for (const code of listCodes()) {
      const def = QUESTIONNAIRE_REGISTRY[code]
      expect(typeof def.scorer).toBe('function')
    }
  })

  it('PHQ9 scorer via registry produces minimal severity for all-zero answers', () => {
    const def = getDefinition('PHQ9')!
    const result = def.scorer([0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(result.totalScore).toBe(0)
    expect(result.severityBand).toBe('minimal')
    expect(result.requiresReview).toBe(false)
  })

  it('GAD7 scorer via registry produces severe for max answers', () => {
    const def = getDefinition('GAD7')!
    const result = def.scorer([3, 3, 3, 3, 3, 3, 3])
    expect(result.totalScore).toBe(21)
    expect(result.severityBand).toBe('severe')
  })

  it('ASQ scorer via registry produces negative for all-zero screening', () => {
    const def = getDefinition('ASQ')!
    const result = def.scorer([0, 0, 0, 0])
    expect(result.severityBand).toBe('negative')
    expect(result.requiresReview).toBe(false)
  })

  it('BDI2 scorer via registry produces severe for all-3 answers + suicidality flag', () => {
    const def = getDefinition('BDI2')!
    const result = def.scorer(Array.from({ length: 21 }, () => 3))
    expect(result.totalScore).toBe(63)
    expect(result.severityBand).toBe('severe')
    expect(result.flags).toEqual([{ itemOrder: 9, reason: 'suicidality' }])
    expect(result.requiresReview).toBe(true)
  })

  it('BAI scorer via registry produces severe for all-3 answers without flags', () => {
    const def = getDefinition('BAI')!
    const result = def.scorer(Array.from({ length: 21 }, () => 3))
    expect(result.totalScore).toBe(63)
    expect(result.severityBand).toBe('severe')
    expect(result.flags).toEqual([])
    expect(result.requiresReview).toBe(false)
  })

  it('CSSRS scorer via registry produces negative for all-zero answers', () => {
    const def = getDefinition('CSSRS')!
    const result = def.scorer([0, 0, 0, 0, 0, 0, 0])
    expect(result.severityBand).toBe('negative')
    expect(result.requiresReview).toBe(false)
    expect(result.flags).toEqual([])
  })

  it('CSSRS scorer via registry produces acute_risk + behavior_recent flag when item 6b = Sí', () => {
    const def = getDefinition('CSSRS')!
    const result = def.scorer([0, 0, 0, 0, 0, 1, 1])
    expect(result.severityBand).toBe('acute_risk')
    expect(result.requiresReview).toBe(true)
    expect(result.flags).toEqual([{ itemOrder: 7, reason: 'acute_risk' }])
  })

  it('scorer rejects malformed input by throwing (PHQ9 wrong length)', () => {
    const def = getDefinition('PHQ9')!
    expect(() => def.scorer([0, 0, 0])).toThrow()
  })
})
