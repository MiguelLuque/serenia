// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const submissions = vi.hoisted(() => [] as FormData[])
vi.mock('@/app/onboarding/actions', () => ({
  submitProfile: async (_state: unknown, formData: FormData) => {
    submissions.push(formData)
    return { error: 'Debes tener al menos 18 años e indicar una fecha válida' }
  },
}))
import { ProfileForm } from '@/components/onboarding/profile-form'

afterEach(cleanup)

it('preserves editable intake and acknowledgement after a returned server rejection', async () => {
  render(<ProfileForm />)
  const name = screen.getByLabelText(/Nombre por el que prefieres/) as HTMLInputElement
  const pronouns = screen.getByLabelText('Pronombres') as HTMLSelectElement
  const birthDate = screen.getByLabelText('Fecha de nacimiento') as HTMLInputElement
  const reason = screen.getByLabelText('¿Qué te trae a Serenia?') as HTMLTextAreaElement
  const acceptance = screen.getByRole('checkbox') as HTMLInputElement
  fireEvent.change(name, { target: { value: 'Persona ficticia' } })
  fireEvent.change(pronouns, { target: { value: 'elle' } })
  fireEvent.change(birthDate, { target: { value: '2010-10-12' } })
  fireEvent.change(reason, { target: { value: 'Consulta ficticia para comprobar la corrección del formulario.' } })
  fireEvent.click(acceptance)
  fireEvent.submit(screen.getByRole('button', { name: 'Completar perfil' }).closest('form')!)
  expect((await screen.findByRole('alert')).textContent).toContain('al menos 18 años')
  await waitFor(() => expect((screen.getByRole('button', { name: 'Completar perfil' }) as HTMLButtonElement).disabled).toBe(false))
  expect(name.value).toBe('Persona ficticia')
  expect(pronouns.value).toBe('elle')
  expect(birthDate.value).toBe('2010-10-12')
  expect(reason.value).toBe('Consulta ficticia para comprobar la corrección del formulario.')
  expect(acceptance.checked).toBe(true)
  fireEvent.change(birthDate, { target: { value: '1990-10-12' } })
  expect(birthDate.value).toBe('1990-10-12')
  fireEvent.submit(screen.getByRole('button', { name: 'Completar perfil' }).closest('form')!)
  await waitFor(() => expect(submissions).toHaveLength(2))
  expect(Object.fromEntries(submissions[1])).toMatchObject({
    informalName: 'Persona ficticia', pronouns: 'elle', birthDate: '1990-10-12',
    reasonForConsulting: 'Consulta ficticia para comprobar la corrección del formulario.',
    acceptance: 'on',
  })
})
