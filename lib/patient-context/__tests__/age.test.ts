import { describe, it, expect } from 'vitest'
import { computeAge } from '@/lib/patient-context/age'

describe('computeAge', () => {
  const now = new Date('2026-05-02T12:00:00Z')

  it('devuelve null cuando birthDate es null', () => {
    expect(computeAge(null, now)).toBe(null)
  })

  it('devuelve null cuando birthDate es string vacía', () => {
    expect(computeAge('', now)).toBe(null)
  })

  it('devuelve null cuando birthDate es malformada', () => {
    expect(computeAge('no-es-fecha', now)).toBe(null)
    expect(computeAge('2099-13-99', now)).toBe(null)
  })

  it('calcula edad si ya cumplió este año', () => {
    expect(computeAge('1990-01-15', now)).toBe(36)
  })

  it('calcula edad si todavía no cumplió este año', () => {
    expect(computeAge('1990-12-31', now)).toBe(35)
  })

  it('cumpleaños hoy mismo cuenta', () => {
    expect(computeAge('1990-05-02', now)).toBe(36)
  })

  it('cumpleaños mañana NO cuenta todavía', () => {
    expect(computeAge('1990-05-03', now)).toBe(35)
  })

  it('acepta ISO datetime, no solo YYYY-MM-DD', () => {
    expect(computeAge('1990-01-15T00:00:00.000Z', now)).toBe(36)
  })
})
