import type { AnswerInput } from '@/lib/shared/questionnaires/types'
import type { Json } from '@/lib/shared/supabase/types'

type Item = { id: string; order_index: number; options_json: Json }
export function validateAnswers(code: string, items: Item[], answers: AnswerInput[]): AnswerInput[] {
  if (!items.length || answers.length > items.length) throw new Error('Invalid answer count')
  const byOrder = new Map<number, AnswerInput>()
  const allowedOrders = new Set(items.map(i => i.order_index))
  for (const answer of answers) {
    if (byOrder.has(answer.itemOrder) || !allowedOrders.has(answer.itemOrder)) throw new Error('Duplicate or unknown item')
    if (!matchesOption(items.find(item => item.order_index === answer.itemOrder)!, answer)) throw new Error('Invalid option or inconsistent raw value')
    byOrder.set(answer.itemOrder, answer)
  }
  const skipped = new Set<number>()
  if (code === 'CSSRS') {
    if (byOrder.get(2)?.valueNumeric === 0) [3,4,5].forEach(n => skipped.add(n))
    if (byOrder.get(6)?.valueNumeric === 0) skipped.add(7)
  }
  return [...items].sort((a,b) => a.order_index-b.order_index).map(item => {
    let answer = byOrder.get(item.order_index)
    if (skipped.has(item.order_index)) {
      if (answer && answer.valueNumeric !== 0) throw new Error('Contradictory skipped answer')
      answer = { itemOrder: item.order_index, valueNumeric: 0, valueRaw: 'No' }
    }
    if (!answer || !Number.isInteger(answer.valueNumeric)) throw new Error('Missing answer')
    if (!matchesOption(item, answer)) throw new Error('Invalid option or inconsistent raw value')
    return answer
  })
}

function matchesOption(item: Item, answer: AnswerInput): boolean {
  if (!Number.isInteger(answer.valueNumeric)) return false
  const options = Array.isArray(item.options_json) ? item.options_json : []
  return options.some(option => {
    if (!option || typeof option !== 'object' || Array.isArray(option)) return false
    return Number(option.value) === answer.valueNumeric && (answer.valueRaw === String(option.value) || answer.valueRaw === option.label)
  })
}
