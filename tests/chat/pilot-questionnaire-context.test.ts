import { expect, it } from 'vitest'
import { renderPilotQuestionnaireFacts } from '@/lib/server/chat/pilot-questionnaire-context'

it('retains each canonical instance as available data without an implied delivery receipt', () => {
  const notice = renderPilotQuestionnaireFacts([
    { instanceId: 'first', name: 'PHQ-9', report: { code: 'PHQ9', score: 12, band: 'moderate', flags: [] } },
    { instanceId: 'second', name: 'GAD-7', report: { code: 'GAD7', score: 8, band: 'mild', flags: [] } },
    { instanceId: 'third', name: 'PHQ-9', report: { code: 'PHQ9', score: 9, band: 'mild', flags: [{ itemOrder: 9, reason: 'suicidality' }] } },
  ])
  for (const expected of ['first', 'second', 'third', 'PHQ9', 'GAD7', '12', '8', '9', 'suicidality']) expect(notice).toContain(expected)
  expect(notice).toContain('no acredita')
  expect(notice).toContain('ítems')
  expect(notice).not.toContain('ha recibido la devolución')
})

it('returns no result when the successful canonical read is empty', () => {
  expect(renderPilotQuestionnaireFacts([])).toBe('')
})
