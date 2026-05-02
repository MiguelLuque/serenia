import { describe, it, expect, vi, beforeEach } from 'vitest'

const { createAuthenticatedClientMock, redirectMock } = vi.hoisted(() => ({
  createAuthenticatedClientMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    // El redirect real de Next throwa para abortar el render. Lo
    // emulamos para que el test pueda detectar la llamada por excepción
    // sin acoplarse al string interno de Next.
    const err = new Error(`NEXT_REDIRECT:${path}`)
    ;(err as Error & { digest?: string }).digest = `NEXT_REDIRECT;replace;${path};307;`
    throw err
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createAuthenticatedClient: createAuthenticatedClientMock,
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

import { submitProfile } from '@/app/onboarding/actions'

type UpsertCall = { payload: unknown; options: unknown }

function makeSupabase({
  userId = 'user-1' as string | null,
  upsertError = null as { message: string } | null,
  calls,
}: {
  userId?: string | null
  upsertError?: { message: string } | null
  calls: { upserts: UpsertCall[] }
}) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: userId ? { id: userId } : null },
        error: null,
      })),
    },
    from(table: string) {
      if (table !== 'user_profiles') {
        throw new Error(`unexpected table ${table}`)
      }
      return {
        upsert: (payload: unknown, options: unknown) => {
          calls.upserts.push({ payload, options })
          return Promise.resolve({ error: upsertError })
        },
      }
    },
  }
}

function makeFormData(values: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(values)) fd.set(k, v)
  return fd
}

const validValues = {
  informalName: 'Ana',
  pronouns: 'ella',
  birthDate: '1990-01-15',
  reasonForConsulting: 'Llevo semanas con ansiedad y no puedo dormir.',
}

beforeEach(() => {
  createAuthenticatedClientMock.mockReset()
  redirectMock.mockClear()
})

describe('submitProfile (Plan 8 T3.3)', () => {
  it('persiste los 4 campos y redirige a /app', async () => {
    const calls = { upserts: [] as UpsertCall[] }
    createAuthenticatedClientMock.mockResolvedValue(
      makeSupabase({ calls }) as unknown,
    )

    let caught: unknown
    try {
      await submitProfile(undefined, makeFormData(validValues))
    } catch (e) {
      caught = e
    }

    // El redirect en Next throwa para abortar; capturamos y verificamos.
    expect(redirectMock).toHaveBeenCalledWith('/app')
    expect((caught as Error).message).toContain('/app')

    expect(calls.upserts).toHaveLength(1)
    const { payload, options } = calls.upserts[0]!
    expect(payload).toEqual({
      user_id: 'user-1',
      informal_name: 'Ana',
      pronouns: 'ella',
      birth_date: '1990-01-15',
      reason_for_consulting: 'Llevo semanas con ansiedad y no puedo dormir.',
      onboarding_status: 'complete',
    })
    expect(options).toEqual({ onConflict: 'user_id' })

    // No toca columnas legacy
    const p = payload as Record<string, unknown>
    expect(p.sex).toBeUndefined()
    expect(p.country).toBeUndefined()
    expect(p.city).toBeUndefined()
    expect(p.employment).toBeUndefined()
    expect(p.relationship_status).toBeUndefined()
    expect(p.living_with).toBeUndefined()
    expect(p.prior_therapy).toBeUndefined()
    expect(p.current_medication).toBeUndefined()
    expect(p.display_name).toBeUndefined()
  })

  it('devuelve error si pronouns es inválido y NO redirige', async () => {
    const calls = { upserts: [] as UpsertCall[] }
    createAuthenticatedClientMock.mockResolvedValue(
      makeSupabase({ calls }) as unknown,
    )

    const result = await submitProfile(
      undefined,
      makeFormData({ ...validValues, pronouns: 'otro' }),
    )

    expect(result?.error).toBeTruthy()
    expect(redirectMock).not.toHaveBeenCalled()
    expect(calls.upserts).toHaveLength(0)
  })

  it('devuelve error si informalName está vacío', async () => {
    const calls = { upserts: [] as UpsertCall[] }
    createAuthenticatedClientMock.mockResolvedValue(
      makeSupabase({ calls }) as unknown,
    )

    const result = await submitProfile(
      undefined,
      makeFormData({ ...validValues, informalName: '' }),
    )

    expect(result?.error).toBe('Indica un nombre')
    expect(calls.upserts).toHaveLength(0)
  })

  it('devuelve error si birthDate está malformada', async () => {
    const calls = { upserts: [] as UpsertCall[] }
    createAuthenticatedClientMock.mockResolvedValue(
      makeSupabase({ calls }) as unknown,
    )

    const result = await submitProfile(
      undefined,
      makeFormData({ ...validValues, birthDate: '15/01/1990' }),
    )

    expect(result?.error).toBe('Fecha inválida')
    expect(calls.upserts).toHaveLength(0)
  })

  it('devuelve error si reasonForConsulting tiene menos de 10 chars', async () => {
    const calls = { upserts: [] as UpsertCall[] }
    createAuthenticatedClientMock.mockResolvedValue(
      makeSupabase({ calls }) as unknown,
    )

    const result = await submitProfile(
      undefined,
      makeFormData({ ...validValues, reasonForConsulting: 'corto' }),
    )

    expect(result?.error).toBe('Cuéntanos un poco más')
    expect(calls.upserts).toHaveLength(0)
  })

  it('devuelve error si no hay usuario autenticado', async () => {
    const calls = { upserts: [] as UpsertCall[] }
    createAuthenticatedClientMock.mockResolvedValue(
      makeSupabase({ userId: null, calls }) as unknown,
    )

    const result = await submitProfile(undefined, makeFormData(validValues))

    expect(result?.error).toBe('No autenticado')
    expect(calls.upserts).toHaveLength(0)
  })

  it('devuelve error genérico si el upsert falla', async () => {
    const calls = { upserts: [] as UpsertCall[] }
    createAuthenticatedClientMock.mockResolvedValue(
      makeSupabase({ upsertError: { message: 'boom' }, calls }) as unknown,
    )

    const result = await submitProfile(undefined, makeFormData(validValues))

    expect(result?.error).toBe('No se pudo guardar el perfil')
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('no rompe si la fila ya tiene valores legacy (el upsert solo escribe los 4 campos nuevos + onboarding_status)', async () => {
    // Las columnas legacy no aparecen en el payload del upsert; el test
    // anterior ya lo valida explícitamente. Aquí confirmamos que el flujo
    // completa éxito incluso si conceptualmente el row preexiste.
    const calls = { upserts: [] as UpsertCall[] }
    createAuthenticatedClientMock.mockResolvedValue(
      makeSupabase({ calls }) as unknown,
    )

    try {
      await submitProfile(undefined, makeFormData(validValues))
    } catch {
      // redirect throwa
    }
    expect(calls.upserts).toHaveLength(1)
  })
})
