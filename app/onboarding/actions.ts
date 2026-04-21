'use server'
import { redirect } from 'next/navigation'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { ProfileSchema } from '@/lib/auth/schemas'

type ActionState = { error?: string } | undefined

export async function submitProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = {
    displayName: formData.get('displayName'),
    birthDate: formData.get('birthDate'),
    sex: formData.get('sex'),
    country: formData.get('country'),
    city: formData.get('city'),
    employment: formData.get('employment'),
    relationshipStatus: formData.get('relationshipStatus'),
    livingWith: formData.get('livingWith'),
    priorTherapy: formData.get('priorTherapy') === 'on',
    currentMedication: formData.get('currentMedication') === 'on',
    reasonForConsulting: formData.get('reasonForConsulting'),
  }
  const parsed = ProfileSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createAuthenticatedClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('user_profiles')
    .update({
      display_name: parsed.data.displayName,
      birth_date: parsed.data.birthDate,
      sex: parsed.data.sex,
      country: parsed.data.country,
      city: parsed.data.city,
      employment: parsed.data.employment,
      relationship_status: parsed.data.relationshipStatus,
      living_with: parsed.data.livingWith,
      prior_therapy: parsed.data.priorTherapy,
      current_medication: parsed.data.currentMedication,
      reason_for_consulting: parsed.data.reasonForConsulting,
      onboarding_status: 'complete',
    })
    .eq('user_id', user.id)

  if (error) return { error: 'No se pudo guardar el perfil' }
  redirect('/app')
}
