'use server'
import { redirect } from 'next/navigation'
import { createAuthenticatedClient } from '@/lib/server/supabase/server'
import { CURRENT_ACCEPTANCE_VERSION } from '@/lib/shared/onboarding/acceptance'
import { ClinicalIntakeSchema } from '@/lib/shared/onboarding/schema'

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

  if (formData.get('acceptance') !== 'on' || formData.get('acceptanceVersion') !== CURRENT_ACCEPTANCE_VERSION) return { error: 'Lee y acepta el borrador técnico vigente para continuar' }

  const supabase = await createAuthenticatedClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'No autenticado' }

  const { error } = await supabase.rpc('complete_patient_onboarding', {
    p_informal_name: parsed.data.informalName,
    p_pronouns: parsed.data.pronouns,
    p_birth_date: parsed.data.birthDate,
    p_reason: parsed.data.reasonForConsulting,
    p_version: CURRENT_ACCEPTANCE_VERSION,
    p_accepted: true,
  })

  if (error) return { error: 'No se pudo guardar el perfil' }
  redirect('/app')
}
