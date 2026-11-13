// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SAFETY_RESOURCES } from '@/lib/shared/safety-resources'

// Discover the file by convention without supplying a fake implementation.
// This also keeps the missing-boundary failure an assertion rather than a
// module-resolution error while the recovery UI has not been implemented.
const boundaries = import.meta.glob('../../app/app/sesion/**/error.tsx', { eager: true })

afterEach(() => cleanup())

it('offers a safe retry and crisis resources when session rendering fails', () => {
  const entry = Object.entries(boundaries).find(([path]) => path.endsWith('/[id]/error.tsx'))
  expect(entry, 'Expected a route-specific session error boundary').toBeDefined()
  const component = entry![1] as { default: React.ComponentType<{ error: Error; retry: () => void; reset: () => void }> }
  const retry = vi.fn()
  const reset = vi.fn()
  const sensitiveMessage = 'PRIVATE-SESSION-ERROR-FIXTURE'
  render(<component.default error={new Error(sensitiveMessage)} retry={retry} reset={reset} />)

  expect(screen.queryByText(sensitiveMessage)).toBeNull()
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.getByRole('link', { name: SAFETY_RESOURCES.suicide.name }).getAttribute('href')).toBe(SAFETY_RESOURCES.suicide.href)
  expect(screen.getByRole('link', { name: /emergencias/i }).getAttribute('href')).toBe(SAFETY_RESOURCES.emergency.href)
  fireEvent.click(screen.getByRole('button', { name: /reintentar|intentar de nuevo/i }))
  expect(retry).toHaveBeenCalledTimes(1)
  expect(reset).not.toHaveBeenCalled()
})
