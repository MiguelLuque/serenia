import { redirect } from 'next/navigation'
import { ProfileForm } from '@/components/onboarding/profile-form'
import { createAuthenticatedClient } from '@/lib/server/supabase/server'

export default async function Page() {
  const supabase = await createAuthenticatedClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')
  const { data: profile, error } = await supabase.from('user_profiles').select('informal_name,pronouns,birth_date,reason_for_consulting').eq('user_id', user.id).single()
  if (error) throw error
  return (
    <div className="mx-auto max-w-xl py-12 px-4">
      <h1 className="text-2xl font-semibold">Tu perfil y aceptación vigente</h1>
      <p className="mt-2 text-slate-600">Serenia está en fase de pruebas. Estos datos personalizan la conversación y pueden procesarse por los proveedores de alojamiento, datos e IA descritos en la información provisional de privacidad.</p>
      <div className="mt-8"><ProfileForm initial={profile ?? undefined} /></div>
    </div>
  )
}
