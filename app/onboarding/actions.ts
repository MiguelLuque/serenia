'use server'
import { redirect } from 'next/navigation'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { ClinicalIntakeSchema } from '@/lib/onboarding/schema'

type ActionState = { error?: string } | undefined

/**
 * Plan 8 Fase 3 (T3.3) / ADR-019 / ADR-020.
 *
 * Onboarding clínico reducido a 4 campos imprescindibles para sesión 1.
 * Las columnas legacy (sex, country, city, employment, relationship_status,
 * living_with, prior_therapy, current_medication) NO se tocan aquí; Plan 9
 * (Patient Profile completo) las reusará y se mantienen nullable.
 */
export async function submitProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = {
    informalName: formData.get('informalName'),
    pronouns: formData.get('pronouns'),
    birthDate: formData.get('birthDate'),
    reasonForConsulting: formData.get('reasonForConsulting'),
  }
  const parsed = ClinicalIntakeSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createAuthenticatedClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('user_profiles')
    .upsert(
      {
        user_id: user.id,
        informal_name: parsed.data.informalName,
        pronouns: parsed.data.pronouns,
        birth_date: parsed.data.birthDate,
        reason_for_consulting: parsed.data.reasonForConsulting,
        onboarding_status: 'complete',
      },
      { onConflict: 'user_id' },
    )

  if (error) return { error: 'No se pudo guardar el perfil' }
  redirect('/app')
}
