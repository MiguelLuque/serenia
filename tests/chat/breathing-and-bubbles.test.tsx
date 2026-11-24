// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { BreathingExercise } from '@/components/chat/breathing-exercise'
import { MessageBubble, TypingBubble } from '@/components/chat/message-bubble'
import { CrisisBanner } from '@/components/chat/crisis-banner'

afterEach(cleanup)

it('breathing exercise only starts when asked and can be stopped', () => {
  const { container } = render(<BreathingExercise />)
  expect(container.querySelector('.breath-ring')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Respirar un minuto' }))
  expect(container.querySelector('.breath-ring')).not.toBeNull()
  expect(screen.getByRole('status').textContent).toMatch(/inhala/i)
  fireEvent.click(screen.getByRole('button', { name: 'Parar' }))
  expect(container.querySelector('.breath-ring')).toBeNull()
})

it('typing indicator is decorative (the chat status line carries the accessible state)', () => {
  const { container } = render(<TypingBubble />)
  expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
})

it('message bubble keeps the transcript text and hides the avatar from assistive tech', () => {
  const { container } = render(<MessageBubble message={{ id: '1', role: 'assistant', parts: [{ type: 'text', text: 'Hola' }] }} />)
  expect(container.querySelector('span.whitespace-pre-wrap')?.textContent).toBe('Hola')
  expect(container.querySelector('[aria-hidden]')).not.toBeNull()
})

it('crisis banner keeps both phone links', () => {
  render(<CrisisBanner />)
  expect(screen.getByRole('link', { name: /Línea 024/ }).getAttribute('href')).toBe('tel:024')
  expect(screen.getByRole('link', { name: /112 emergencias/ }).getAttribute('href')).toBe('tel:112')
})
