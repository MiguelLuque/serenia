import Link from 'next/link'
import { redirect } from 'next/navigation'
import { patientDisplayName } from '@/lib/shared/clinician/display-name'
import { getPatientReports, REPORT_STATE_COPY, type PatientReport } from '@/lib/server/assessments/patient-reports'
import { createAuthenticatedClient } from '@/lib/server/supabase/server'
import { getOrResolveActiveSession } from '@/lib/server/sessions/service'
import { getOpenSessionRiskSignals, type OpenSessionRiskSignal } from '@/lib/server/clinician/open-risk'
import { OpenRiskSignals } from '@/components/clinician/open-risk-signals'
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
import { PageHeader } from '@/components/brand/page-header'
import { BrandOrb } from '@/components/brand/brand-mark'
import {
  brandCardClass,
  brandPrimaryButtonClass,
  safetyCardClass,
  safetyLinkClass,
} from '@/components/brand/styles'
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

const TODAY_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Madrid',
})

function formatAgreedOn(iso: string): string {
  return AGREED_ON_FORMATTER.format(new Date(iso))
}

function OpenAgreementsCard({ tasks }: { tasks: PatientOpenTask[] }) {
  return (
    <section aria-labelledby="acuerdos-titulo">
      <Card className={brandCardClass}>
        <CardHeader>
          <CardTitle id="acuerdos-titulo">Tus acuerdos recientes</CardTitle>
          <CardDescription>
            Acuerdos validados tras una revisión clínica.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay acuerdos. Aparecerán aquí cuando tu profesional revise
              una sesión.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {tasks.map((task) => (
                <li key={task.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="font-medium text-stone-800">
                      {task.descripcion}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      acordado el {formatAgreedOn(task.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {tasks.length > 0 ? (
        <p className="mt-2 px-1 text-xs text-muted-foreground">
          Estos acuerdos los revisó tu profesional después de una sesión.
          Serenia los tendrá presentes la próxima vez que hables con ella.
        </p>
      ) : null}
    </section>
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
    // The inbox must stay usable if this supplementary read fails.
    let openRiskSignals: OpenSessionRiskSignal[] = []
    let openRiskUnavailable = false
    try { openRiskSignals = await getOpenSessionRiskSignals(supabase) }
    catch { openRiskUnavailable = true; console.error('[inbox] open-session risk signals unavailable') }
    const tabClass = (active: boolean) =>
      `inline-flex min-h-9 items-center rounded-full px-4 text-sm font-medium transition-colors ${
        active ? 'bg-white text-primary shadow-sm ring-1 ring-stone-900/5' : 'text-muted-foreground hover:text-stone-900'
      }`
    const pagerClass =
      'inline-flex min-h-9 items-center rounded-full border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 hover:bg-stone-50'
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Panel clínico"
          title="Bandeja"
          description="Sesiones cerradas pendientes de revisión."
        />
        <OpenRiskSignals signals={openRiskSignals} />
        {openRiskUnavailable && <p role="alert" className="text-sm text-red-800">No se pudieron comprobar las señales de riesgo de sesiones abiertas. Recarga para reintentar.</p>}
        <nav aria-label="Filtros de bandeja" className="inline-flex gap-1 rounded-full bg-muted p-1">
          <Link href="/app" aria-current={pendingOnly ? 'page' : undefined} className={tabClass(pendingOnly)}>Pendientes</Link>
          <Link href="/app?view=all" aria-current={!pendingOnly ? 'page' : undefined} className={tabClass(!pendingOnly)}>Todas</Link>
        </nav>
        <InboxList rows={rows} />
        <nav aria-label="Paginación de bandeja" className="flex items-center justify-between gap-3">
          <span>{page > 1 && <Link className={pagerClass} href={`/app?page=${page-1}${pendingOnly ? '' : '&view=all'}`}>Página anterior</Link>}</span>
          <span className="text-sm tabular-nums text-muted-foreground">Página {page}</span>
          <span>{hasMore && <Link className={pagerClass} href={`/app?page=${page+1}${pendingOnly ? '' : '&view=all'}`}>Página siguiente</Link>}</span>
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

  const name = patientDisplayName(profile)
  const lastClosedForCrisis = lastClosed?.closureReason === 'crisis_detected'
  const newSessionCard = (
    <Card className={`${brandCardClass} relative overflow-hidden`}>
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-[radial-gradient(circle,#ccfbf1_0%,transparent_70%)] opacity-70" />
      <CardHeader className="relative gap-1.5 sm:px-6 sm:pt-2">
        <div className="flex items-center gap-3">
          <BrandOrb className="size-9" />
          <CardTitle className="text-lg">Empieza una sesión nueva</CardTitle>
        </div>
        <CardDescription className="mt-1 max-w-xl leading-relaxed">
          Las sesiones duran hasta 60 minutos. Si pasan 30 minutos sin actividad, la sesión puede cerrarse.
        </CardDescription>
      </CardHeader>
      <CardContent className="relative sm:px-6 sm:pb-2">
        <form action={startSessionAction}>
          <Button type="submit" className={brandPrimaryButtonClass}>Iniciar nueva sesión</Button>
        </form>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={TODAY_FORMATTER.format(new Date())}
        title={name ? `Hola, ${name}.` : 'Hola.'}
        description="Aquí puedes iniciar una sesión con Serenia o continuar la que ya tienes abierta."
      />

      {activeSession ? (
        <>
          <Card className={`${brandCardClass} relative overflow-hidden`}>
            <CardHeader className="gap-1.5 sm:px-6 sm:pt-2">
              <div className="flex items-center gap-3">
                <BrandOrb className="size-9" />
                <div>
                  <CardTitle className="text-lg">Tienes una sesión en curso.</CardTitle>
                  <CardDescription>
                    Iniciada {formatMinutesAgo(activeSession.opened_at)}.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="sm:px-6 sm:pb-2">
              <Button className={brandPrimaryButtonClass} render={<Link href={`/app/sesion/${activeSession.id}`} />} nativeButton={false}>
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
            <Card className={safetyCardClass}>
              <CardHeader>
                <CardTitle className="text-red-950">Tu última sesión se cerró por seguridad.</CardTitle>
                <CardDescription className="text-red-900">
                  No hay revisión humana inmediata garantizada. Si necesitas ayuda ahora,
                  llama a la <a className={safetyLinkClass} href={SAFETY_RESOURCES.suicide.href}>{SAFETY_RESOURCES.suicide.name}</a>{' '}
                  (gratuita, 24 horas) o al <a className={safetyLinkClass} href={SAFETY_RESOURCES.emergency.href}>{SAFETY_RESOURCES.emergency.phone}</a> en caso de emergencia.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {!lastClosedForCrisis && newSessionCard}

          {lastClosed?.report?.state === 'available' && !lastClosedForCrisis ? (
            <Card className={brandCardClass}>
              <CardHeader>
                <CardTitle>Resumen de tu última sesión</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[15px] leading-relaxed text-stone-700">
                  {lastClosed.report?.summary}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {lastClosed?.report && lastClosed.report.state !== 'available' && <p role="status" className="px-1 text-sm text-muted-foreground">{REPORT_STATE_COPY[lastClosed.report.state]}</p>}
          {openTasks.length > 0 || lastClosed !== null ? (
            <OpenAgreementsCard tasks={openTasks} />
          ) : null}

          {/* Tras un cierre por crisis el aviso de seguridad manda: la nueva sesión va al final. */}
          {lastClosedForCrisis && newSessionCard}
        </>
      )}
    </div>
  )
}
