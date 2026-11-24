import { redirect } from 'next/navigation'
import { getPatientReports, REPORT_STATE_COPY } from '@/lib/server/assessments/patient-reports'
import { createAuthenticatedClient } from '@/lib/server/supabase/server'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SAFETY_RESOURCES } from '@/lib/shared/safety-resources'
import { PageHeader } from '@/components/brand/page-header'
import { BrandOrb } from '@/components/brand/brand-mark'
import { brandCardClass, safetyCardClass, safetyLinkClass } from '@/components/brand/styles'
import Link from 'next/link'

const closureLabels: Record<string, string> = {
  user_request: 'Cerrada por ti',
  time_limit: 'Fin de tiempo',
  inactivity: 'Inactividad',
  crisis_detected: 'Cerrada por seguridad',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function SesionesPage() {
  const supabase = await createAuthenticatedClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) redirect('/login')
  const { data: sessions, error: sessionsError } = await supabase
    .from('clinical_sessions')
    .select('id, opened_at, closed_at, closure_reason')
    .eq('user_id', user.id)
    .eq('status', 'closed')
    .order('closed_at', { ascending: false })
    .limit(50)

  const sessionIds = (sessions ?? []).map((s) => s.id)
  if (sessionsError) throw sessionsError
  const reports = await getPatientReports(supabase, sessionIds)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Historial"
        title="Tus sesiones"
        description="Aquí encontrarás un resumen de cada sesión cerrada."
      />

      {(!sessions || sessions.length === 0) ? (
        <Card className={brandCardClass}>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <BrandOrb className="size-10" />
            <p className="text-[15px] text-stone-700">Todavía no tienes sesiones cerradas.</p>
            <Link href="/app" className="text-sm font-medium text-primary underline underline-offset-4">
              Ir al inicio para empezar una
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ol className="space-y-3">
          {sessions.map((session) => {
            const report = reports.get(session.id)
            const summary = report?.state === 'available' ? report.summary : null
            const isCrisis = session.closure_reason === 'crisis_detected'
            return (
              <li key={session.id}>
              <Card
                className={isCrisis ? safetyCardClass : brandCardClass}
              >
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="text-base">
                      {session.closed_at
                        ? formatDate(session.closed_at)
                        : formatDate(session.opened_at)}
                    </CardTitle>
                    {session.closure_reason && (
                      <Badge variant={isCrisis ? 'destructive' : 'secondary'}>
                        {closureLabels[session.closure_reason] ??
                          session.closure_reason}
                      </Badge>
                    )}
                  </div>
                  {isCrisis && (
                    <CardDescription className="text-red-900">
                      No hay revisión humana inmediata garantizada. Si necesitas ayuda ahora,
                      llama a la <a className={safetyLinkClass} href={SAFETY_RESOURCES.suicide.href}>{SAFETY_RESOURCES.suicide.name}</a>{' '}
                      (gratuita, 24 horas) o al <a className={safetyLinkClass} href={SAFETY_RESOURCES.emergency.href}>{SAFETY_RESOURCES.emergency.phone}</a> en caso de emergencia.
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {summary ? (
                    <p className="text-[15px] leading-relaxed text-stone-700">{summary}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {report && report.state !== 'available' ? REPORT_STATE_COPY[report.state] : REPORT_STATE_COPY.unavailable}
                    </p>
                  )}
                </CardContent>
              </Card>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
