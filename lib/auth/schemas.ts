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

export const ProfileSchema = z.object({
  displayName: z.string().min(1).max(80),
  birthDate: z.string().refine((s) => isAdult(new Date(s)), 'Debes ser mayor de 18 años'),
  sex: z.enum(['female', 'male', 'non_binary', 'prefer_not_say']),
  country: z.string().min(2).max(64),
  city: z.string().min(1).max(120),
  employment: z.enum(['employed', 'unemployed', 'student', 'retired', 'homemaker', 'other']),
  relationshipStatus: z.enum(['single', 'in_relationship', 'married', 'divorced', 'widowed', 'other']),
  livingWith: z.enum(['alone', 'with_family', 'with_partner', 'with_roommates', 'other']),
  priorTherapy: z.boolean(),
  currentMedication: z.boolean(),
  reasonForConsulting: z.string().min(10).max(2000),
})

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type ProfileInput = z.infer<typeof ProfileSchema>
