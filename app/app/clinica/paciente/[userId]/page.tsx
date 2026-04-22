import Link from 'next/link'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { getPatientDetail } from '@/lib/clinician/patient'
import { assessmentStatusLabel } from '@/lib/clinician/assessment-labels'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const CLOSURE_LABELS: Record<string, string> = {
  user_request: 'Cerrada por paciente',
  time_limit: 'Fin de tiempo',
  inactivity: 'Inactividad',
  crisis_detected: 'Crisis detectada',
}

const SEVERITY_VARIANT: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  low: 'outline',
  moderate: 'secondary',
  high: 'destructive',
  critical: 'destructive',
}

const SEVERITY_LABEL: Record<string, string> = {
  low: 'Baja',
  moderate: 'Moderada',
  high: 'Alta',
  critical: 'Crítica',
}

const RISK_TYPE_LABEL: Record<string, string> = {
  suicidal_ideation: 'Ideación suicida',
  self_harm: 'Autolesión',
  severe_distress: 'Malestar severo',
  crisis_other: 'Otra crisis',
}

const QUESTIONNAIRE_LABEL: Record<string, string> = {
  PHQ9: 'PHQ-9',
  GAD7: 'GAD-7',
}

function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const supabase = await createAuthenticatedClient()
  const detail = await getPatientDetail(supabase, userId)

  const { profile, questionnaireResults, riskEvents, sessions } = detail

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {profile.displayName ?? 'Paciente sin nombre'}
          </CardTitle>
          {profile.birthDate && (
            <p className="text-sm text-slate-600">
              {calculateAge(profile.birthDate)} años
            </p>
          )}
        </CardHeader>
      </Card>

      {/* Tendencias cuestionarios */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tendencias de cuestionarios</CardTitle>
        </CardHeader>
        <CardContent>
          {questionnaireResults.length === 0 ? (
            <p className="text-sm text-slate-600">
              Sin cuestionarios completados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-600">
                    <th className="py-2 pr-3 font-medium">Cuestionario</th>
                    <th className="py-2 pr-3 font-medium">Fecha</th>
                    <th className="py-2 pr-3 font-medium">Puntuación</th>
                    <th className="py-2 font-medium">Nivel</th>
                  </tr>
                </thead>
                <tbody>
                  {questionnaireResults.map((r, i) => (
                    <tr
                      key={`${r.code}-${r.scoredAt ?? i}`}
                      className="border-b last:border-b-0"
                    >
                      <td className="py-2 pr-3 font-medium">
                        {QUESTIONNAIRE_LABEL[r.code] ?? r.code}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">
                        {formatDate(r.scoredAt)}
                      </td>
                      <td className="py-2 pr-3">{r.totalScore}</td>
                      <td className="py-2">
                        <Badge variant="secondary">{r.severityBand}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Eventos de riesgo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventos de riesgo</CardTitle>
        </CardHeader>
        <CardContent>
          {riskEvents.length === 0 ? (
            <p className="text-sm text-slate-600">Sin eventos de riesgo.</p>
          ) : (
            <ul className="space-y-2">
              {riskEvents.map((event) => {
                const label =
                  RISK_TYPE_LABEL[event.riskType] ?? event.riskType
                const severityVariant =
                  SEVERITY_VARIANT[event.severity] ?? 'secondary'
                const severityLabel =
                  SEVERITY_LABEL[event.severity] ?? event.severity
                const body = (
                  <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                    <div>
                      <div className="font-medium">{label}</div>
                      <div className="text-slate-600">
                        {formatDateTime(event.createdAt)}
                      </div>
                    </div>
                    <Badge variant={severityVariant}>{severityLabel}</Badge>
                  </div>
                )
                return (
                  <li key={event.id}>
                    {event.sessionId ? (
                      <Link
                        href={`/app/clinica/sesion/${event.sessionId}`}
                        className="block transition-opacity hover:opacity-90"
                      >
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Sesiones */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sesiones</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-600">Sin sesiones.</p>
          ) : (
            <ul className="space-y-2">
              {sessions.map((session) => {
                const status = assessmentStatusLabel(session.assessmentStatus)
                const closureLabel = session.closureReason
                  ? CLOSURE_LABELS[session.closureReason] ??
                    session.closureReason
                  : null
                const dateIso = session.closedAt ?? session.openedAt
                return (
                  <li key={session.id}>
                    <Link
                      href={`/app/clinica/sesion/${session.id}`}
                      className="block transition-opacity hover:opacity-90"
                    >
                      <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                        <div>
                          <div className="font-medium">
                            {formatDate(dateIso)}
                          </div>
                          {closureLabel && (
                            <div className="text-slate-600">{closureLabel}</div>
                          )}
                        </div>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
