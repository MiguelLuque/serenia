import Link from 'next/link'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { getOrResolveActiveSession } from '@/lib/sessions/service'
import { getClinicianInbox } from '@/lib/clinician/inbox'
import {
  getPatientOpenTasks,
  type PatientOpenTask,
} from '@/lib/patient-tasks/open-tasks'
import { InboxList } from '@/components/clinician/inbox-list'
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

const AGREED_ON_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Madrid',
})

function formatAgreedOn(iso: string): string {
  return AGREED_ON_FORMATTER.format(new Date(iso))
}

function OpenAgreementsCard({ tasks }: { tasks: PatientOpenTask[] }) {
  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Tus acuerdos recientes</CardTitle>
          <CardDescription>
            Lo que acordaste con tu psicólogo para esta semana.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-slate-600">
              Aún no hay acuerdos. Aparecerán aquí cuando tu psicólogo revise
              tu próxima sesión.
            </p>
          ) : (
            <ul className="space-y-2">
              {tasks.map((task) => (
                <li key={task.id}>
                  <p className="font-medium text-slate-800">
                    {task.descripcion}
                  </p>
                  <p className="text-xs text-slate-500">
                    acordado el {formatAgreedOn(task.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {tasks.length > 0 ? (
        <p className="mt-2 text-xs text-slate-500">
          Estos acuerdos los revisó tu psicólogo después de tu última sesión.
          Serenia los tendrá presentes la próxima vez que hables con ella.
        </p>
      ) : null}
    </div>
  )
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
    const rows = await getClinicianInbox(supabase)
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Bandeja</h2>
          <p className="mt-1 text-sm text-slate-600">
            Sesiones cerradas pendientes de revisión.
          </p>
        </div>
        <InboxList rows={rows} />
      </div>
    )
  }

  const activeSession = await getOrResolveActiveSession(supabase, user!.id)
  const openTasks = await getPatientOpenTasks(supabase, user!.id)

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
        <>
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
          {openTasks.length > 0 ? (
            <OpenAgreementsCard tasks={openTasks} />
          ) : null}
        </>
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

          {openTasks.length > 0 || lastClosed !== null ? (
            <OpenAgreementsCard tasks={openTasks} />
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
