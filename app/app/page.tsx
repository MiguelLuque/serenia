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

  let lastClosed:
    | {
        closureReason: string | null
        patientFacingSummary: string | null
      }
    | null = null

  if (!activeSession) {
    const { data: sess } = await supabase
      .from('clinical_sessions')
      .select('id, closed_at, closure_reason')
      .eq('user_id', user!.id)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (sess) {
      const { data: assessment } = await supabase
        .from('assessments')
        .select('summary_json')
        .eq('session_id', sess.id)
        .eq('assessment_type', 'closure')
        .maybeSingle()

      const summary = assessment?.summary_json as
        | { patient_facing_summary?: string }
        | null
      lastClosed = {
        closureReason: sess.closure_reason,
        patientFacingSummary: summary?.patient_facing_summary ?? null,
      }
    }
  }

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
        <>
          {lastClosed?.closureReason === 'crisis_detected' ? (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle>Tu última sesión se cerró por seguridad.</CardTitle>
                <CardDescription>
                  Tu psicólogo la está revisando hoy. Si necesitas ayuda ahora,
                  llama a la <strong>Línea 024</strong>.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : lastClosed?.patientFacingSummary ? (
            <Card>
              <CardHeader>
                <CardTitle>Resumen de tu última sesión</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700">
                  {lastClosed.patientFacingSummary}
                </p>
              </CardContent>
            </Card>
          ) : null}

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
        </>
      )}
    </div>
  )
}
