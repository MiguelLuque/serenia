import { createAuthenticatedClient } from '@/lib/supabase/server'

export default async function AppHome() {
  const supabase = await createAuthenticatedClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, display_name')
    .eq('user_id', user!.id)
    .single()

  if (profile?.role === 'clinician') {
    return (
      <div>
        <h2 className="text-xl font-semibold">Panel clínico</h2>
        <p className="mt-2 text-slate-600">
          Próximamente — Plan 5 añade el listado de pacientes y la revisión de informes.
        </p>
      </div>
    )
  }
  return (
    <div>
      <h2 className="text-xl font-semibold">Hola, {profile?.display_name}.</h2>
      <p className="mt-2 text-slate-600">
        Aquí podrás iniciar una sesión con Serenia. Chat y sesiones llegan en los Planes 3 y 4.
      </p>
    </div>
  )
}
