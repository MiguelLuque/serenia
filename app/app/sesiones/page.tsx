import { createAuthenticatedClient } from '@/lib/supabase/server'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SAFETY_RESOURCES } from '@/lib/clinical/safety-resources'

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
  const { data: { user } } = await supabase.auth.getUser()

  const { data: sessions } = await supabase
    .from('clinical_sessions')
    .select('id, opened_at, closed_at, closure_reason')
    .eq('user_id', user!.id)
    .eq('status', 'closed')
    .order('closed_at', { ascending: false })
    .limit(50)

  const sessionIds = (sessions ?? []).map((s) => s.id)
  const { data: assessments } = sessionIds.length
    ? await supabase
        .from('assessments')
        .select('session_id, summary_json')
        .eq('assessment_type', 'closure')
        .in('session_id', sessionIds)
    : { data: [] as Array<{ session_id: string; summary_json: unknown }> }

  const summaryBySession = new Map<string, string | null>()
  for (const a of assessments ?? []) {
    if (!a.session_id) continue
    const summary = a.summary_json as
      | { patient_facing_summary?: string }
      | null
    summaryBySession.set(a.session_id, summary?.patient_facing_summary ?? null)
  }

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
            const summary = summaryBySession.get(session.id) ?? null
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
                      Tu psicólogo la está revisando. Si necesitas ayuda ahora,
                      llama a la <strong>{SAFETY_RESOURCES.suicide.name}</strong>.
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {summary ? (
                    <p className="text-sm text-slate-700">{summary}</p>
                  ) : (
                    <p className="text-sm italic text-slate-500">
                      Esta sesión no tiene resumen disponible.
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
