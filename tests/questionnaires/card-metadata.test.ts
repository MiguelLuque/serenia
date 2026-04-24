import { describe, it, expect } from 'vitest'
import { getQuestionnaireCardHeader } from '@/lib/questionnaires/card-metadata'

describe('getQuestionnaireCardHeader', () => {
  it('returns PHQ9 clinical title and duration', () => {
    const h = getQuestionnaireCardHeader('PHQ9', 'PHQ-9')
    expect(h.title).toMatch(/PHQ-9/)
    expect(h.title).toMatch(/estas 2 últimas semanas/i)
    expect(h.duration).toMatch(/9 preguntas/)
  })

  it('returns GAD7 clinical title and duration', () => {
    const h = getQuestionnaireCardHeader('GAD7', 'GAD-7')
    expect(h.title).toMatch(/GAD-7/)
    expect(h.duration).toMatch(/7 preguntas/)
  })

  it('returns ASQ clinical title focused on safety and short duration', () => {
    const h = getQuestionnaireCardHeader('ASQ', 'ASQ')
    expect(h.title).toMatch(/ASQ/)
    expect(h.title.toLowerCase()).toContain('seguridad')
    expect(h.duration).toMatch(/menos de 1 minuto/)
  })

  it('falls back to definition.name and a generic duration for unknown codes', () => {
    const h = getQuestionnaireCardHeader('UNKNOWN_CODE', 'Mi cuestionario')
    expect(h.title).toBe('Mi cuestionario')
    expect(h.duration).toMatch(/preguntas/)
  })
})
