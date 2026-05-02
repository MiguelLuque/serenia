import { describe, it, expect } from 'vitest'
import {
  QUESTIONNAIRE_REGISTRY,
  getDefinition,
  listCodes,
  listPatientCodes,
} from '@/lib/questionnaires/registry'

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

  it('returns a definition for GAD7 and ASQ as well', () => {
    const gad = getDefinition('GAD7')
    const asq = getDefinition('ASQ')
    expect(gad).not.toBeNull()
    expect(asq).not.toBeNull()
    expect(gad?.code).toBe('GAD7')
    expect(asq?.code).toBe('ASQ')
  })

  it('returns null for an unknown code', () => {
    expect(getDefinition('UNKNOWN')).toBeNull()
    expect(getDefinition('')).toBeNull()
  })

  it('lists all three codes (PHQ9, GAD7, ASQ)', () => {
    const codes = listCodes()
    expect(codes).toHaveLength(3)
    expect(codes).toEqual(expect.arrayContaining(['PHQ9', 'GAD7', 'ASQ']))
  })

  it('lists all three codes as patient-rated (none is clinician-rated yet)', () => {
    const patient = listPatientCodes()
    expect(patient).toHaveLength(3)
    expect(patient).toEqual(expect.arrayContaining(['PHQ9', 'GAD7', 'ASQ']))
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

  it('scorer rejects malformed input by throwing (PHQ9 wrong length)', () => {
    const def = getDefinition('PHQ9')!
    expect(() => def.scorer([0, 0, 0])).toThrow()
  })
})
