import { describe, expect, it } from 'vitest'
import { validateAnswers } from '@/lib/server/questionnaires/validation'
const items = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `item-${i+1}`, order_index: i+1, options_json: [0,1,2,3].map(value => ({ value, label: String(value) })) }))
const answers = (values: number[]) => values.map((valueNumeric, i) => ({ itemOrder: i+1, valueNumeric, valueRaw: String(valueNumeric) }))
describe('questionnaire validation before writes', () => {
  it('rejects partial, duplicate, foreign item and inconsistent raw/numeric answers', () => {
    for (const input of [answers([1]), [...answers([0,0]), { itemOrder: 2, valueNumeric: 0, valueRaw: '0' }], answers([0,9,0]), answers([0,0,0]).map((a,i) => i === 1 ? { ...a, valueRaw: '3' } : a)]) {
      expect(() => validateAnswers('PHQ9', items(3), input)).toThrow()
    }
  })
  it('normalizes documented CSSRS branches and requires 6b only after 6 Yes', () => {
    const cssrsItems = items(7).map(i => ({ ...i, options_json: [{ value: 0, label: 'No' }, { value: 1, label: 'Sí' }] }))
    const base = [{ itemOrder: 1, valueNumeric: 0, valueRaw: 'No' }, { itemOrder: 2, valueNumeric: 0, valueRaw: 'No' }, { itemOrder: 6, valueNumeric: 0, valueRaw: 'No' }]
    expect(validateAnswers('CSSRS', cssrsItems, base).map(a => a.valueNumeric)).toEqual([0,0,0,0,0,0,0])
    expect(() => validateAnswers('CSSRS', cssrsItems, base.map(a => a.itemOrder === 6 ? { ...a, valueNumeric: 1, valueRaw: 'Sí' } : a))).toThrow()
    expect(() => validateAnswers('CSSRS', cssrsItems, [...base, { itemOrder: 4, valueNumeric: 1, valueRaw: 'Sí' }])).toThrow()
  })
})
