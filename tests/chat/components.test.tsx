// @vitest-environment jsdom
import React from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ChatInput } from '@/components/chat/chat-input'
import { QuestionnaireCard } from '@/components/chat/questionnaire-card'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const items = Array.from({ length: 7 }, (_, i) => ({ id: String(i), order_index: i + 1, prompt: `Pregunta clínica ${i+1}`, options_json: [{ value: 1, label: 'Sí' }, { value: 0, label: 'No' }] }))
it('allows composing after transport failure and preserves text when sending fails', async () => {
  render(<ChatInput status="error" onSend={async () => { throw Error('offline') }} />)
  const input = screen.getByRole('textbox') as HTMLTextAreaElement
  expect(input.disabled).toBe(false)
  fireEvent.change(input, { target: { value: 'Necesito ayuda' } })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
  await waitFor(() => expect(input.value).toBe('Necesito ayuda'))
})
it('C-SSRS skips 3-5 and 7 for negative gates, submits only asked answers', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{}')); vi.stubGlobal('fetch', fetch)
  render(<QuestionnaireCard instanceId="a" definition={{ code: 'CSSRS', name: 'Cribado' }} items={items} />)
  fireEvent.click(screen.getByRole('radio', { name: 'No' })); fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  fireEvent.click(screen.getByRole('radio', { name: 'No' })); fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  expect(screen.getByText('Pregunta clínica 6')).toBeTruthy()
  fireEvent.click(screen.getByRole('radio', { name: 'No' })); fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Enviado'))
  expect(JSON.parse(fetch.mock.calls[0][1].body).answers).toEqual([{ itemOrder: 1, valueNumeric: 0, valueRaw: 'No' }, { itemOrder: 2, valueNumeric: 0, valueRaw: 'No' }, { itemOrder: 6, valueNumeric: 0, valueRaw: 'No' }])
})
it('a different questionnaire instance resets answers, index and submitted state', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))
  const props = { definition: { code: 'PHQ9', name: 'Estado' }, items: items.slice(0, 1) }
  const { rerender } = render(<QuestionnaireCard {...props} instanceId="first" />)
  fireEvent.click(screen.getByRole('radio', { name: 'Sí' })); fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
  await screen.findByText(/Enviado/)
  rerender(<QuestionnaireCard {...props} instanceId="second" />)
  expect(screen.getByText('Pregunta clínica 1')).toBeTruthy()
  expect(screen.queryByText(/Enviado/)).toBeNull()
})

it('C-SSRS positive gates expose all seven items without changing clinical prompts', async () => {
 const fetch=vi.fn().mockResolvedValue(new Response('{}')); vi.stubGlobal('fetch',fetch)
 render(<QuestionnaireCard instanceId="positive" definition={{ code:'CSSRS',name:'Cribado' }} items={items} />)
 for(let order=1;order<=7;order++) {
  expect(screen.getByText(`Pregunta clínica ${order}`)).toBeTruthy()
  fireEvent.click(screen.getByRole('radio',{ name:'Sí' })); fireEvent.click(screen.getByRole('button',{ name:order===7?'Enviar':'Siguiente' }))
 }
 await screen.findByRole('status')
 expect(JSON.parse(fetch.mock.calls[0][1].body).answers.map((a: {itemOrder: number})=>a.itemOrder)).toEqual([1,2,3,4,5,6,7])
})
it('questionnaire server errors preserve selections for the identical submission retry', async () => {
 const fetch=vi.fn().mockResolvedValueOnce(new Response('down',{ status:503 })).mockResolvedValueOnce(new Response('{}')); vi.stubGlobal('fetch',fetch)
 render(<QuestionnaireCard instanceId="error" definition={{ code:'PHQ9',name:'Estado' }} items={items.slice(0,1)} />)
 fireEvent.click(screen.getByRole('radio',{name:'No'})); fireEvent.click(screen.getByRole('button',{name:'Enviar'}))
 await screen.findByRole('alert'); expect((screen.getByRole('radio',{name:'No'}) as HTMLInputElement).checked).toBe(true)
 fireEvent.click(screen.getByRole('button',{name:'Enviar'})); await screen.findByRole('status')
 expect(fetch.mock.calls[1][1].body).toBe(fetch.mock.calls[0][1].body)
})
