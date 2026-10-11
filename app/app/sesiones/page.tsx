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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Tus sesiones</h2>
        <p className="mt-1 text-sm text-slate-600">
          Aquí encontrarás un resumen de cada sesión cerrada.
        </p>
      </div>

      {(!sessions || sessions.length === 0) ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-slate-600">
            Todavía no tienes sesiones cerradas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const report = reports.get(session.id)
            const summary = report?.state === 'available' ? report.summary : null
            const isCrisis = session.closure_reason === 'crisis_detected'
            return (
              <Card
                key={session.id}
                className={isCrisis ? 'border-red-200 bg-red-50' : undefined}
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
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
                      llama a la <strong>{SAFETY_RESOURCES.suicide.name}</strong>.
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {summary ? (
                    <p className="text-sm text-slate-700">{summary}</p>
                  ) : (
                    <p className="text-sm italic text-slate-500">
                      {report && report.state !== 'available' ? REPORT_STATE_COPY[report.state] : REPORT_STATE_COPY.unavailable}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
