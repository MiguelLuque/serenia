import { redirect } from 'next/navigation'
import { ProfileForm } from '@/components/onboarding/profile-form'
import { createAuthenticatedClient } from '@/lib/server/supabase/server'
import { PageHeader } from '@/components/brand/page-header'
import { BrandOrb } from '@/components/brand/brand-mark'

export default async function Page() {
  const supabase = await createAuthenticatedClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')
  const { data: profile, error } = await supabase.from('user_profiles').select('informal_name,pronouns,birth_date,reason_for_consulting').eq('user_id', user.id).single()
  if (error) throw error
  return (
    <div className="flex-1 bg-background">
      <div className="mx-auto max-w-xl px-5 py-10 sm:py-14">
        <p className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-stone-900">
          <BrandOrb />
          Serenia
        </p>
        <PageHeader
          className="mt-10"
          eyebrow="Antes de empezar"
          title="Tu perfil y aceptación vigente"
          description="Serenia está en fase de pruebas. Estos datos personalizan la conversación y pueden procesarse por los proveedores de alojamiento, datos e IA descritos en la información provisional de privacidad."
        />
        <div className="mt-8 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(28,25,23,0.04)] sm:p-7">
          <ProfileForm initial={profile ?? undefined} />
        </div>
      </div>
    </div>
  )
}
