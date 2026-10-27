import Link from 'next/link'
import { redirect } from 'next/navigation'
import { patientDisplayName } from '@/lib/shared/clinician/display-name'
import { getPatientReports, REPORT_STATE_COPY, type PatientReport } from '@/lib/server/assessments/patient-reports'
import { createAuthenticatedClient } from '@/lib/server/supabase/server'
import { getOrResolveActiveSession } from '@/lib/server/sessions/service'
import { getClinicianInboxPage } from '@/lib/server/clinician/inbox'
import {
  getPatientOpenTasks,
  type PatientOpenTask,
} from '@/lib/server/patient-tasks/open-tasks'
import { InboxList } from '@/components/clinician/inbox-list'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SAFETY_RESOURCES } from '@/lib/shared/safety-resources'
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
            Acuerdos validados tras una revisión clínica.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-slate-600">
              Aún no hay acuerdos. Aparecerán aquí cuando tu psicólogo revise
              una sesión.
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
          Estos acuerdos los revisó tu psicólogo después de una sesión.
          Serenia los tendrá presentes la próxima vez que hables con ella.
        </p>
      ) : null}
    </div>
  )
}

export default async function AppHome({ searchParams }: { searchParams?: Promise<{ page?: string; view?: string }> } = {}) {
  const supabase = await createAuthenticatedClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role, display_name, informal_name')
    .eq('user_id', user.id)
    .single()

  if (profileError) throw profileError
  if (profile?.role === 'clinician') {
    const query = await searchParams
    const page = Math.max(1, Math.min(100_000, Number.parseInt(query?.page ?? '1', 10) || 1))
    const pendingOnly = query?.view !== 'all'
    const { rows, hasMore } = await getClinicianInboxPage(supabase, { page, pendingOnly })
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Bandeja</h2>
          <p className="mt-1 text-sm text-slate-600">
            Sesiones cerradas pendientes de revisión.
          </p>
        </div>
        <nav aria-label="Filtros de bandeja" className="flex gap-4"><Link href="/app" aria-current={pendingOnly ? 'page' : undefined}>Pendientes</Link><Link href="/app?view=all" aria-current={!pendingOnly ? 'page' : undefined}>Todas</Link></nav>
        <InboxList rows={rows} />
        <nav aria-label="Paginación de bandeja" className="flex gap-4">
          {page > 1 && <Link href={`/app?page=${page-1}${pendingOnly ? '' : '&view=all'}`}>Página anterior</Link>}
          <span>Página {page}</span>
          {hasMore && <Link href={`/app?page=${page+1}${pendingOnly ? '' : '&view=all'}`}>Página siguiente</Link>}
        </nav>
      </div>
    )
  }

  const activeSession = await getOrResolveActiveSession(supabase, user.id)
  const openTasks = await getPatientOpenTasks(supabase, user.id)

  let lastClosed:
    | {
        closureReason: string | null
        report: PatientReport | null
      }
    | null = null

  if (!activeSession) {
    const { data: sess, error: sessionError } = await supabase
      .from('clinical_sessions')
      .select('id, closed_at, closure_reason')
      .eq('user_id', user.id)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (sessionError) throw sessionError
    if (sess) {
      const reports = await getPatientReports(supabase, [sess.id])
      lastClosed = { closureReason: sess.closure_reason, report: reports.get(sess.id) ?? null }

    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Hola, {patientDisplayName(profile) ?? 'bienvenida'}.</h2>
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
                  No hay revisión humana inmediata garantizada. Si necesitas ayuda ahora,
                  llama a la <strong>{SAFETY_RESOURCES.suicide.name}</strong>.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : lastClosed?.report?.state === 'available' ? (
            <Card>
              <CardHeader>
                <CardTitle>Resumen de tu última sesión</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700">
                  {lastClosed.report?.summary}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {lastClosed?.report && lastClosed.report.state !== 'available' && <p role="status" className="text-sm text-slate-600">{REPORT_STATE_COPY[lastClosed.report.state]}</p>}
          {openTasks.length > 0 || lastClosed !== null ? (
            <OpenAgreementsCard tasks={openTasks} />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Empieza una sesión nueva</CardTitle>
              <CardDescription>
                Las sesiones duran hasta 60 minutos. Tras 30 minutos de inactividad se comprueba el cierre al retomar la sesión o en la revisión automática.
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
