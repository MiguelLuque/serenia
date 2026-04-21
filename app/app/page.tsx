import Link from 'next/link'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { getOrResolveActiveSession } from '@/lib/sessions/service'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { startSessionAction } from './actions'

function formatMinutesAgo(from: string): string {
  const diffMs = Date.now() - new Date(from).getTime()
  const minutes = Math.max(0, Math.floor(diffMs / 60_000))
  if (minutes < 1) return 'hace menos de un minuto'
  if (minutes === 1) return 'hace 1 minuto'
  return `hace ${minutes} minutos`
}

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

  const activeSession = await getOrResolveActiveSession(supabase, user!.id)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Hola, {profile?.display_name}.</h2>
        <p className="mt-2 text-slate-600">
          Aquí puedes iniciar una sesión con Serenia o continuar la que ya tienes abierta.
        </p>
      </div>

      {activeSession ? (
        <Card>
          <CardHeader>
            <CardTitle>Tienes una sesión en curso.</CardTitle>
            <CardDescription>
              Iniciada {formatMinutesAgo(activeSession.opened_at)}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<Link href={`/app/sesion/${activeSession.id}`} />} nativeButton={false}>
              Continuar tu sesión
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Empieza una sesión nueva</CardTitle>
            <CardDescription>
              Las sesiones duran hasta 60 minutos. Puedes pausar y seguir cuando quieras.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={startSessionAction}>
              <Button type="submit">Iniciar nueva sesión</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
