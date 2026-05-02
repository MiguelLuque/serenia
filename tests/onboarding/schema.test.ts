import { describe, it, expect } from 'vitest'
import { ClinicalIntakeSchema } from '@/lib/onboarding/schema'

const validInput = {
  informalName: 'Ana',
  pronouns: 'ella',
  birthDate: '1990-01-15',
  reasonForConsulting: 'Llevo semanas con ansiedad y no puedo dormir.',
} as const

describe('ClinicalIntakeSchema', () => {
  it('acepta input válido', () => {
    const r = ClinicalIntakeSchema.safeParse(validInput)
    expect(r.success).toBe(true)
  })

  it('acepta los 4 valores de pronouns', () => {
    for (const p of ['el', 'ella', 'elle', 'prefer_not_say'] as const) {
      const r = ClinicalIntakeSchema.safeParse({ ...validInput, pronouns: p })
      expect(r.success).toBe(true)
    }
  })

  it('rechaza pronouns inválido', () => {
    const r = ClinicalIntakeSchema.safeParse({ ...validInput, pronouns: 'otro' })
    expect(r.success).toBe(false)
  })

  it('rechaza informalName vacío', () => {
    const r = ClinicalIntakeSchema.safeParse({ ...validInput, informalName: '' })
    expect(r.success).toBe(false)
  })

  it('rechaza informalName solo espacios', () => {
    const r = ClinicalIntakeSchema.safeParse({ ...validInput, informalName: '   ' })
    expect(r.success).toBe(false)
  })

  it('rechaza birthDate malformada', () => {
    const r = ClinicalIntakeSchema.safeParse({ ...validInput, birthDate: '15/01/1990' })
    expect(r.success).toBe(false)
  })

  it('rechaza reasonForConsulting < 10 chars', () => {
    const r = ClinicalIntakeSchema.safeParse({ ...validInput, reasonForConsulting: 'corto' })
    expect(r.success).toBe(false)
  })
})
