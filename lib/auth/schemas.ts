import { z } from 'zod'

export function isAdult(birthDate: Date): boolean {
  const today = new Date()
  const cutoff = new Date(
    today.getFullYear() - 18,
    today.getMonth(),
    today.getDate(),
    today.getHours(),
    today.getMinutes(),
    today.getSeconds(),
    today.getMilliseconds(),
  )
  return birthDate.getTime() <= cutoff.getTime()
}

const PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d).{8,}$/

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().regex(PASSWORD_RE, 'Mínimo 8 caracteres, una mayúscula y un número'),
  consent: z.literal(true),
})

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// Plan 8 Fase 3 (T3.3): el ProfileSchema antiguo (11 campos) se sustituye
// por `lib/onboarding/schema.ts` (4 campos clínicos imprescindibles).
// `isAdult` se conserva por si se reusa más adelante.

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>
