import { z } from 'zod'

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

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>
