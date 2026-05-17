import { describe, it, expect } from 'vitest'
import { scorePHQ9, scoreGAD7, scoreBDI2, scoreBAI, scoreCSSRS } from '@/lib/shared/questionnaires/scoring'

// ---------------------------------------------------------------------------
// PHQ-9
// ---------------------------------------------------------------------------

describe('scorePHQ9', () => {
  it('1. all zeros → minimal, score 0, no flags', () => {
    const result = scorePHQ9([0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(result.totalScore).toBe(0)
    expect(result.severityBand).toBe('minimal')
    expect(result.flags).toHaveLength(0)
    expect(result.requiresReview).toBe(false)
  })

  it('2. all 3s → severe, score 27, suicidality flag', () => {
    const result = scorePHQ9([3, 3, 3, 3, 3, 3, 3, 3, 3])
    expect(result.totalScore).toBe(27)
    expect(result.severityBand).toBe('severe')
    expect(result.flags).toHaveLength(1)
    expect(result.flags[0]).toEqual({ itemOrder: 9, reason: 'suicidality' })
    expect(result.requiresReview).toBe(true)
  })

  it('3. score 12 with item 9 = 0 → moderate, no flags', () => {
    // items: 2+2+2+2+2+2+0+0+0 = 12
    const result = scorePHQ9([2, 2, 2, 2, 2, 2, 0, 0, 0])
    expect(result.totalScore).toBe(12)
    expect(result.severityBand).toBe('moderate')
    expect(result.flags).toHaveLength(0)
    expect(result.requiresReview).toBe(false)
  })

  it('4. score 17 with item 9 = 2 → moderately_severe, suicidality flag', () => {
    // items: 2+2+2+2+2+2+2+1+2 = 17
    const result = scorePHQ9([2, 2, 2, 2, 2, 2, 2, 1, 2])
    expect(result.totalScore).toBe(17)
    expect(result.severityBand).toBe('moderately_severe')
    expect(result.flags).toHaveLength(1)
    expect(result.flags[0]).toEqual({ itemOrder: 9, reason: 'suicidality' })
    expect(result.requiresReview).toBe(true)
  })

  it('5. wrong length (8 items) → throws', () => {
    expect(() => scorePHQ9([0, 0, 0, 0, 0, 0, 0, 0])).toThrow()
  })

  it('6. out-of-range value (4) → throws', () => {
    expect(() => scorePHQ9([0, 0, 0, 0, 4, 0, 0, 0, 0])).toThrow()
  })
})

// ---------------------------------------------------------------------------
// GAD-7
// ---------------------------------------------------------------------------

describe('scoreGAD7', () => {
  it('7. all zeros → minimal', () => {
    const result = scoreGAD7([0, 0, 0, 0, 0, 0, 0])
    expect(result.totalScore).toBe(0)
    expect(result.severityBand).toBe('minimal')
    expect(result.flags).toHaveLength(0)
    expect(result.requiresReview).toBe(false)
  })

  it('8. score 10 → moderate', () => {
    // 2+2+2+2+2+0+0 = 10
    const result = scoreGAD7([2, 2, 2, 2, 2, 0, 0])
    expect(result.totalScore).toBe(10)
    expect(result.severityBand).toBe('moderate')
  })

  it('9. score 21 → severe', () => {
    const result = scoreGAD7([3, 3, 3, 3, 3, 3, 3])
    expect(result.totalScore).toBe(21)
    expect(result.severityBand).toBe('severe')
  })

  it('10. wrong length → throws', () => {
    expect(() => scoreGAD7([0, 0, 0, 0, 0, 0])).toThrow()
  })
})

// ---------------------------------------------------------------------------
// ASQ — Borrado en Plan 8 T1.7 (2026-05-17). Sustituido por C-SSRS al final
// de este archivo. Tests de scoreASQ eliminados con el scorer.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// BDI-II
// ---------------------------------------------------------------------------

describe('scoreBDI2', () => {
  // Helper: build 21 zeros, optionally override one position.
  const baseline = (override?: { idx: number; val: number }) => {
    const arr = Array.from({ length: 21 }, () => 0)
    if (override) arr[override.idx] = override.val
    return arr
  }

  it('16. all zeros → minimal, score 0, no flags', () => {
    const result = scoreBDI2(baseline())
    expect(result.totalScore).toBe(0)
    expect(result.severityBand).toBe('minimal')
    expect(result.flags).toHaveLength(0)
    expect(result.requiresReview).toBe(false)
  })

  it('17. all 3s → severe, score 63, suicidality flag', () => {
    const result = scoreBDI2(Array.from({ length: 21 }, () => 3))
    expect(result.totalScore).toBe(63)
    expect(result.severityBand).toBe('severe')
    expect(result.flags).toEqual([{ itemOrder: 9, reason: 'suicidality' }])
    expect(result.requiresReview).toBe(true)
  })

  it('18. score 13 with item 9 = 0 → minimal upper bound, no flags', () => {
    // 13 ones across non-item-9 positions: indexes 0-12 except 8 = 12 ones, plus one more at index 13 = 13
    const arr = baseline()
    for (let i = 0; i < 14; i++) {
      if (i !== 8) arr[i] = 1
    }
    expect(arr.reduce((a, b) => a + b, 0)).toBe(13)
    const result = scoreBDI2(arr)
    expect(result.totalScore).toBe(13)
    expect(result.severityBand).toBe('minimal')
    expect(result.flags).toHaveLength(0)
  })

  it('19. score 14 → mild (lower bound)', () => {
    const arr = baseline()
    for (let i = 0; i < 14; i++) arr[i] = 1
    arr[8] = 0 // ensure item 9 is 0 → no flag
    arr[14] = 1 // 14 ones total
    expect(arr.reduce((a, b) => a + b, 0)).toBe(14)
    const result = scoreBDI2(arr)
    expect(result.severityBand).toBe('mild')
    expect(result.flags).toHaveLength(0)
  })

  it('20. score 20 → moderate (lower bound)', () => {
    const arr = baseline()
    for (let i = 0; i < 20; i++) arr[i] = 1
    arr[8] = 0
    arr[20] = 1
    expect(arr.reduce((a, b) => a + b, 0)).toBe(20)
    const result = scoreBDI2(arr)
    expect(result.severityBand).toBe('moderate')
  })

  it('21. score 28 → moderate upper bound', () => {
    // 14 twos = 28, distribuidos en 14 posiciones evitando idx 8 (item 9)
    const arr = baseline()
    const positions = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14]
    positions.forEach((i) => {
      arr[i] = 2
    })
    expect(arr.reduce((a, b) => a + b, 0)).toBe(28)
    const result = scoreBDI2(arr)
    expect(result.severityBand).toBe('moderate')
  })

  it('22. score 29 → severe (lower bound)', () => {
    // 28 igual que test 21 + un 1 extra en idx 15 = 29
    const arr = baseline()
    const positions = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14]
    positions.forEach((i) => {
      arr[i] = 2
    })
    arr[15] = 1
    expect(arr.reduce((a, b) => a + b, 0)).toBe(29)
    const result = scoreBDI2(arr)
    expect(result.severityBand).toBe('severe')
  })

  it('23. item 9 = 1 only → minimal (score 1) but suicidality flag still raised', () => {
    const result = scoreBDI2(baseline({ idx: 8, val: 1 }))
    expect(result.totalScore).toBe(1)
    expect(result.severityBand).toBe('minimal')
    expect(result.flags).toEqual([{ itemOrder: 9, reason: 'suicidality' }])
    expect(result.requiresReview).toBe(true)
  })

  it('24. item 9 = 2 with otherwise low score → flag + requiresReview', () => {
    const arr = baseline({ idx: 8, val: 2 })
    arr[0] = 1
    const result = scoreBDI2(arr)
    expect(result.totalScore).toBe(3)
    expect(result.flags).toEqual([{ itemOrder: 9, reason: 'suicidality' }])
    expect(result.requiresReview).toBe(true)
  })

  it('25. wrong length (20) → throws', () => {
    expect(() => scoreBDI2(Array.from({ length: 20 }, () => 0))).toThrow()
  })

  it('26. out-of-range value (4) → throws', () => {
    const arr = baseline()
    arr[5] = 4
    expect(() => scoreBDI2(arr)).toThrow()
  })

  it('27. negative value → throws', () => {
    const arr = baseline()
    arr[0] = -1
    expect(() => scoreBDI2(arr)).toThrow()
  })

  it('28. non-integer value → throws', () => {
    const arr = baseline()
    arr[0] = 1.5
    expect(() => scoreBDI2(arr)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// BAI
// ---------------------------------------------------------------------------

describe('scoreBAI', () => {
  const baseline = () => Array.from({ length: 21 }, () => 0)

  it('29. all zeros → minimal, score 0, no flags', () => {
    const result = scoreBAI(baseline())
    expect(result.totalScore).toBe(0)
    expect(result.severityBand).toBe('minimal')
    expect(result.flags).toHaveLength(0)
    expect(result.requiresReview).toBe(false)
  })

  it('30. all 3s → severe, score 63', () => {
    const result = scoreBAI(Array.from({ length: 21 }, () => 3))
    expect(result.totalScore).toBe(63)
    expect(result.severityBand).toBe('severe')
    expect(result.flags).toHaveLength(0)
    expect(result.requiresReview).toBe(false)
  })

  it('31. score 21 → minimal upper bound', () => {
    // 21 ones → 21
    const result = scoreBAI(Array.from({ length: 21 }, () => 1))
    expect(result.totalScore).toBe(21)
    expect(result.severityBand).toBe('minimal')
  })

  it('32. score 22 → moderate (lower bound)', () => {
    const arr = Array.from({ length: 21 }, () => 1)
    arr[0] = 2 // 20 ones + 1 two = 22
    expect(arr.reduce((a, b) => a + b, 0)).toBe(22)
    const result = scoreBAI(arr)
    expect(result.severityBand).toBe('moderate')
  })

  it('33. score 35 → moderate upper bound', () => {
    // 14 twos + 7 ones = 35
    const arr = baseline()
    for (let i = 0; i < 14; i++) arr[i] = 2
    for (let i = 14; i < 21; i++) arr[i] = 1
    expect(arr.reduce((a, b) => a + b, 0)).toBe(35)
    const result = scoreBAI(arr)
    expect(result.severityBand).toBe('moderate')
  })

  it('34. score 36 → severe (lower bound)', () => {
    // 14 twos + 7 ones + uno extra a 2 = 36
    const arr = baseline()
    for (let i = 0; i < 15; i++) arr[i] = 2
    for (let i = 15; i < 21; i++) arr[i] = 1
    expect(arr.reduce((a, b) => a + b, 0)).toBe(36)
    const result = scoreBAI(arr)
    expect(result.severityBand).toBe('severe')
  })

  it('35. wrong length (20) → throws', () => {
    expect(() => scoreBAI(Array.from({ length: 20 }, () => 0))).toThrow()
  })

  it('36. out-of-range value (4) → throws', () => {
    const arr = baseline()
    arr[5] = 4
    expect(() => scoreBAI(arr)).toThrow()
  })

  it('37. negative value → throws', () => {
    const arr = baseline()
    arr[0] = -1
    expect(() => scoreBAI(arr)).toThrow()
  })

  it('38. non-integer value → throws', () => {
    const arr = baseline()
    arr[0] = 1.5
    expect(() => scoreBAI(arr)).toThrow()
  })

  it('39. BAI never has flags — high score does NOT set requiresReview', () => {
    const result = scoreBAI(Array.from({ length: 21 }, () => 3))
    expect(result.flags).toEqual([])
    expect(result.requiresReview).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// C-SSRS — 7 items (1-6 + 6b), valores 0/1. Bandas firmadas por Pablo
// (2026-05-03): negative / low_risk / moderate_risk / high_risk / acute_risk.
// Override behavior_recent (item 6b = Sí) fuerza acute_risk + flag.
// Banda asignada = la más severa que cualquier ítem dispare.
// ---------------------------------------------------------------------------

describe('scoreCSSRS', () => {
  it('40. todos No → negative, sin flags, requiresReview=false', () => {
    const result = scoreCSSRS([0, 0, 0, 0, 0, 0, 0])
    expect(result.totalScore).toBe(0)
    expect(result.severityBand).toBe('negative')
    expect(result.flags).toEqual([])
    expect(result.requiresReview).toBe(false)
  })

  it('41. solo item 1 = Sí → low_risk, sin flags, requiresReview=false', () => {
    const result = scoreCSSRS([1, 0, 0, 0, 0, 0, 0])
    expect(result.severityBand).toBe('low_risk')
    expect(result.flags).toEqual([])
    expect(result.requiresReview).toBe(false)
  })

  it('42. solo item 2 = Sí → low_risk', () => {
    const result = scoreCSSRS([0, 1, 0, 0, 0, 0, 0])
    expect(result.severityBand).toBe('low_risk')
    expect(result.requiresReview).toBe(false)
  })

  it('43. item 3 = Sí → moderate_risk, requiresReview=true', () => {
    const result = scoreCSSRS([0, 1, 1, 0, 0, 0, 0])
    expect(result.severityBand).toBe('moderate_risk')
    expect(result.requiresReview).toBe(true)
    expect(result.flags).toEqual([])
  })

  it('44. item 4 = Sí → high_risk', () => {
    const result = scoreCSSRS([0, 1, 0, 1, 0, 0, 0])
    expect(result.severityBand).toBe('high_risk')
    expect(result.requiresReview).toBe(true)
  })

  it('45. item 5 = Sí → acute_risk + flag suicidality itemOrder=5', () => {
    const result = scoreCSSRS([0, 1, 0, 0, 1, 0, 0])
    expect(result.severityBand).toBe('acute_risk')
    expect(result.requiresReview).toBe(true)
    expect(result.flags).toEqual([{ itemOrder: 5, reason: 'suicidality' }])
  })

  it('46. item 6 = Sí (lifetime, sin 6b) → acute_risk + flag suicidality itemOrder=6', () => {
    const result = scoreCSSRS([0, 0, 0, 0, 0, 1, 0])
    expect(result.severityBand).toBe('acute_risk')
    expect(result.requiresReview).toBe(true)
    expect(result.flags).toEqual([{ itemOrder: 6, reason: 'suicidality' }])
  })

  it('47. item 6b = Sí (override behavior_recent) → acute_risk + flag acute_risk itemOrder=7', () => {
    const result = scoreCSSRS([0, 0, 0, 0, 0, 1, 1])
    expect(result.severityBand).toBe('acute_risk')
    expect(result.requiresReview).toBe(true)
    expect(result.flags).toEqual([{ itemOrder: 7, reason: 'acute_risk' }])
  })

  it('48. banda = la MÁS SEVERA (item 1 + item 4 → high_risk, no low_risk)', () => {
    const result = scoreCSSRS([1, 0, 0, 1, 0, 0, 0])
    expect(result.severityBand).toBe('high_risk')
  })

  it('49. banda = la MÁS SEVERA (item 1 + item 5 → acute_risk)', () => {
    const result = scoreCSSRS([1, 0, 0, 0, 1, 0, 0])
    expect(result.severityBand).toBe('acute_risk')
  })

  it('50. override 6b fuerza acute_risk aunque ítems 1-5 sean No', () => {
    // Edge case clínicamente improbable pero defensivo: 6b=Sí debe ganar.
    const result = scoreCSSRS([0, 0, 0, 0, 0, 0, 1])
    expect(result.severityBand).toBe('acute_risk')
    expect(result.flags).toEqual([{ itemOrder: 7, reason: 'acute_risk' }])
  })

  it('51. wrong length (6) → throws', () => {
    expect(() => scoreCSSRS([0, 0, 0, 0, 0, 0])).toThrow()
  })

  it('52. wrong length (8) → throws', () => {
    expect(() => scoreCSSRS([0, 0, 0, 0, 0, 0, 0, 0])).toThrow()
  })

  it('53. valor fuera de rango (2) → throws', () => {
    expect(() => scoreCSSRS([0, 0, 2, 0, 0, 0, 0])).toThrow()
  })

  it('54. valor negativo → throws', () => {
    expect(() => scoreCSSRS([-1, 0, 0, 0, 0, 0, 0])).toThrow()
  })
})
