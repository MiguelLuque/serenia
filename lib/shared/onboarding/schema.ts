import { z } from 'zod'

/**
 * Plan 8 Fase 3 (T3.3) / ADR-019 / ADR-020.
 *
 * Schema del intake clínico mínimo. Se valida en el server action
 * `app/onboarding/actions.ts`. Vive en `lib/` porque es lógica pura
 * reutilizable y porque ADR-019 prohibe que `app/` tenga zod schemas
 * compartidos.
 *
 * Campos: los 4 imprescindibles para que la asistente psicológica
 * TCC/ACT pueda dirigirse al paciente correctamente desde la sesión 1.
 * El resto del Patient Profile se difiere a Plan 9.
 */
export const PronounsSchema = z.enum(['el', 'ella', 'elle', 'prefer_not_say'])
export type Pronouns = z.infer<typeof PronounsSchema>

export const ClinicalIntakeSchema = z.object({
  informalName: z
    .string()
    .trim()
    .min(1, 'Indica un nombre')
    .max(80),
  pronouns: PronounsSchema,
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  reasonForConsulting: z
    .string()
    .trim()
    .min(10, 'Cuéntanos un poco más')
    .max(2000, 'Resume en menos de 2000 caracteres'),
})

export type ClinicalIntakeInput = z.infer<typeof ClinicalIntakeSchema>
