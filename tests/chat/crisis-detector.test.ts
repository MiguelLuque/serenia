import { describe, it, expect } from 'vitest'
import { detectCrisis } from '@/lib/chat/crisis-detector'

describe('detectCrisis — positive cases', () => {
  it('detects "suicidio" stem', () => {
    const result = detectCrisis('Tengo pensamientos de suicidio')
    expect(result.detected).toBe(true)
    expect(result.matchedTerms.some((t) => t.includes('suicid'))).toBe(true)
  })

  it('detects "suicidarme" variant', () => {
    const result = detectCrisis('Estoy pensando en suicidarme')
    expect(result.detected).toBe(true)
    expect(result.matchedTerms.some((t) => t.includes('suicid'))).toBe(true)
  })

  it('detects "hacerme daño"', () => {
    const result = detectCrisis('a veces quiero hacerme daño')
    expect(result.detected).toBe(true)
    expect(result.matchedTerms.some((t) => t.includes('dano'))).toBe(true)
  })

  it('detects "autolesion" without tilde (accent-insensitive)', () => {
    // Input lacks accent — normalization should still match
    const result = detectCrisis('Tengo tendencias a la autolesion')
    expect(result.detected).toBe(true)
    expect(result.matchedTerms.some((t) => t.includes('autolesi'))).toBe(true)
  })

  it('detects "autolesión" with tilde', () => {
    const result = detectCrisis('sufro autolesión frecuente')
    expect(result.detected).toBe(true)
  })

  it('detects "no quiero vivir"', () => {
    const result = detectCrisis('Ya no quiero vivir')
    expect(result.detected).toBe(true)
    expect(result.matchedTerms.some((t) => t.includes('vivir'))).toBe(true)
  })

  it('detects "quitarme la vida"', () => {
    const result = detectCrisis('Pienso en quitarme la vida')
    expect(result.detected).toBe(true)
  })

  it('detects "matarme"', () => {
    const result = detectCrisis('quiero matarme')
    expect(result.detected).toBe(true)
  })

  it('detects "acabar con todo"', () => {
    const result = detectCrisis('Solo quiero acabar con todo')
    expect(result.detected).toBe(true)
  })

  it('detects "desaparecer para siempre"', () => {
    const result = detectCrisis('Quisiera desaparecer para siempre')
    expect(result.detected).toBe(true)
  })

  it('detects "tirarme desde"', () => {
    const result = detectCrisis('He pensado en tirarme desde el puente')
    expect(result.detected).toBe(true)
  })

  it('detects "mejor no estar"', () => {
    const result = detectCrisis('A veces siento que sería mejor no estar')
    expect(result.detected).toBe(true)
  })

  it('detects "cortarme"', () => {
    const result = detectCrisis('Quiero cortarme las venas')
    expect(result.detected).toBe(true)
  })
})

describe('detectCrisis — negative cases', () => {
  it('returns not detected for everyday stress text', () => {
    const result = detectCrisis('Tengo mucho trabajo y estoy cansado')
    expect(result.detected).toBe(false)
    expect(result.matchedTerms).toHaveLength(0)
  })

  it('returns not detected for empty string', () => {
    const result = detectCrisis('')
    expect(result.detected).toBe(false)
    expect(result.matchedTerms).toHaveLength(0)
  })

  it('returns not detected for unrelated sentence', () => {
    const result = detectCrisis('Hoy fue un día agradable, salí a pasear y me sentí bien.')
    expect(result.detected).toBe(false)
  })
})

describe('detectCrisis — known trade-offs', () => {
  // KNOWN FALSE POSITIVE: the permissive stem-match on "suicid" will also
  // match movie/band titles like "Suicide Squad". This is intentional —
  // for a safety guardrail, false positives are safer than false negatives.
  // The ASQ screener in Plan 4 is the real clinical gate.
  it('EXPECTED false positive: "Suicide Squad" movie title matches suicid stem', () => {
    const result = detectCrisis("La película se llama 'Suicide Squad'")
    // This IS detected — document it as expected behavior, not a bug.
    expect(result.detected).toBe(true)
  })
})
