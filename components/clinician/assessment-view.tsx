'use client'

import { useState } from 'react'
import type { SessionDetail } from '@/lib/clinician/session-detail'
import { assessmentStatusLabel } from '@/lib/clinician/assessment-labels'
import { AssessmentEditor } from '@/components/clinician/assessment-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type SuicidalityLevel = 'none' | 'passive' | 'active' | 'acute'
type SelfHarmLevel = 'none' | 'historic' | 'current'

const SUICIDALITY_LABEL: Record<SuicidalityLevel, string> = {
  none: 'Sin ideación',
  passive: 'Ideación pasiva',
  active: 'Ideación activa',
  acute: 'Ideación aguda',
}

const SUICIDALITY_VARIANT: Record<
  SuicidalityLevel,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  none: 'outline',
  passive: 'secondary',
  active: 'destructive',
  acute: 'destructive',
}

const SELF_HARM_LABEL: Record<SelfHarmLevel, string> = {
  none: 'Sin autolesiones',
  historic: 'Autolesiones previas',
  current: 'Autolesiones actuales',
}

const SELF_HARM_VARIANT: Record<
  SelfHarmLevel,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  none: 'outline',
  historic: 'secondary',
  current: 'destructive',
}

const CLOSURE_LABELS: Record<string, string> = {
  user_request: 'Cerrada por paciente',
  time_limit: 'Fin de tiempo',
  inactivity: 'Inactividad',
  crisis_detected: 'Crisis detectada',
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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function BulletList({ items }: { items: readonly string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-600">—</p>
  }
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((item, i) => (
        <li key={i} className="whitespace-pre-wrap">
          {item}
        </li>
      ))}
    </ul>
  )
}

export function AssessmentView({ detail }: { detail: SessionDetail }) {
  const { session, patient, assessment, messages } = detail
  const closureLabel = session.closureReason
    ? CLOSURE_LABELS[session.closureReason] ?? session.closureReason
    : null
  const isCrisis = session.closureReason === 'crisis_detected'
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div className="space-y-6">
      {isCrisis && (
        <Card className="border-red-300 bg-red-50">
          <CardHeader>
            <CardTitle className="text-base text-red-900">
              Crisis detectada
            </CardTitle>
            <CardDescription className="text-red-800">
              Esta sesión se cerró por detección de crisis. Revisa con
              prioridad.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Cabecera sesión */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">
                {patient?.displayName ?? 'Paciente sin nombre'}
              </CardTitle>
              <CardDescription>
                Sesión abierta {formatDateTime(session.openedAt)}
                {session.closedAt ? (
                  <> · Cerrada {formatDateTime(session.closedAt)}</>
                ) : null}
                {closureLabel ? <> · {closureLabel}</> : null}
              </CardDescription>
            </div>
            {assessment ? (
              <Badge
                variant={assessmentStatusLabel(assessment.status).variant}
              >
                {assessmentStatusLabel(assessment.status).label}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      {assessment ? (
        isEditing ? (
          <AssessmentEditor
            assessmentId={assessment.id}
            sessionId={session.id}
            userId={session.userId}
            initial={assessment.summary}
            onCancel={() => setIsEditing(false)}
            onSaved={() => setIsEditing(false)}
          />
        ) : (
          <AssessmentSections
            assessment={assessment}
            onEdit={() => setIsEditing(true)}
          />
        )
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informe no generado</CardTitle>
            <CardDescription>
              No se ha podido generar un informe clínico para esta sesión.
              Revisa la transcripción a continuación.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Transcripción */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transcripción</CardTitle>
          <CardDescription>
            {messages.length === 0
              ? 'Sin mensajes en esta sesión.'
              : `${messages.length} mensajes`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {messages.length > 0 && (
            <details className="rounded-md border bg-slate-50 p-3 text-sm">
              <summary className="cursor-pointer font-medium">
                Mostrar transcripción completa
              </summary>
              <ol className="mt-3 space-y-3">
                {messages.map((m) => (
                  <li key={m.id} className="border-l-2 border-slate-300 pl-3">
                    <div className="text-xs text-slate-600">
                      <span className="font-medium text-slate-800">
                        {m.role === 'user' ? 'Paciente' : 'Serenia'}
                      </span>
                      {' · '}
                      {formatTime(m.createdAt)}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{m.text}</p>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AssessmentSections({
  assessment,
  onEdit,
}: {
  assessment: NonNullable<SessionDetail['assessment']>
  onEdit: () => void
}) {
  const { summary } = assessment
  const risk = summary.risk_assessment

  return (
    <>
      {/* Motivo de consulta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Motivo de consulta</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">
            {summary.chief_complaint || '—'}
          </p>
        </CardContent>
      </Card>

      {/* Problemas presentes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Problemas presentes</CardTitle>
        </CardHeader>
        <CardContent>
          <BulletList items={summary.presenting_issues} />
        </CardContent>
      </Card>

      {/* Estado anímico / afecto */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado anímico y afecto</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">
            {summary.mood_affect || '—'}
          </p>
        </CardContent>
      </Card>

      {/* Patrones cognitivos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Patrones cognitivos</CardTitle>
        </CardHeader>
        <CardContent>
          <BulletList items={summary.cognitive_patterns} />
        </CardContent>
      </Card>

      {/* Evaluación de riesgo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evaluación de riesgo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Ideación suicida:</span>
            <Badge
              variant={SUICIDALITY_VARIANT[risk.suicidality] ?? 'secondary'}
            >
              {SUICIDALITY_LABEL[risk.suicidality] ?? risk.suicidality}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Autolesión:</span>
            <Badge variant={SELF_HARM_VARIANT[risk.self_harm] ?? 'secondary'}>
              {SELF_HARM_LABEL[risk.self_harm] ?? risk.self_harm}
            </Badge>
          </div>
          {risk.notes && (
            <div>
              <div className="font-medium">Notas</div>
              <p className="whitespace-pre-wrap text-slate-700">
                {risk.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cuestionarios completados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Cuestionarios completados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summary.questionnaires.length === 0 ? (
            <p className="text-sm text-slate-600">
              Sin cuestionarios completados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-600">
                    <th className="py-2 pr-3 font-medium">Código</th>
                    <th className="py-2 pr-3 font-medium">Puntuación</th>
                    <th className="py-2 font-medium">Banda</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.questionnaires.flatMap((q, i) => {
                    const rowKey = `${q.code}-${i}`
                    const rows = [
                      <tr
                        key={rowKey}
                        className={
                          q.flags.length > 0 ? '' : 'border-b last:border-b-0'
                        }
                      >
                        <td className="py-2 pr-3 font-medium">{q.code}</td>
                        <td className="py-2 pr-3">{q.score}</td>
                        <td className="py-2">
                          <Badge variant="secondary">{q.band}</Badge>
                        </td>
                      </tr>,
                    ]
                    if (q.flags.length > 0) {
                      rows.push(
                        <tr
                          key={`${rowKey}-flags`}
                          className="border-b last:border-b-0"
                        >
                          <td
                            colSpan={3}
                            className="pb-3 text-xs text-slate-700"
                          >
                            <ul className="list-disc space-y-0.5 pl-5">
                              {q.flags.map((f, fi) => (
                                <li key={fi}>
                                  Ítem {f.itemOrder}: {f.reason}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>,
                      )
                    }
                    return rows
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Áreas a explorar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Áreas a explorar</CardTitle>
        </CardHeader>
        <CardContent>
          <BulletList items={summary.areas_for_exploration} />
        </CardContent>
      </Card>

      {/* Impresión preliminar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Impresión preliminar</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">
            {summary.preliminary_impression || '—'}
          </p>
        </CardContent>
      </Card>

      {/* Acciones recomendadas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Acciones recomendadas al clínico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BulletList items={summary.recommended_actions_for_clinician} />
        </CardContent>
      </Card>

      {/* Resumen para el paciente — muted card para diferenciarlo */}
      <Card className="bg-slate-50">
        <CardHeader>
          <CardTitle className="text-base">Resumen para el paciente</CardTitle>
          <CardDescription>
            Este es el texto que verá el paciente en su panel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">
            {summary.patient_facing_summary || '—'}
          </p>
        </CardContent>
      </Card>

      {/* Acciones */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acciones</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={onEdit}>Editar informe</Button>
          <Button
            variant="secondary"
            // TODO T6: marcar como revisado sin cambios
            onClick={() => {}}
            disabled
          >
            Marcar como revisado sin cambios
          </Button>
          <Button
            variant="destructive"
            // TODO T6: rechazar informe
            onClick={() => {}}
            disabled
          >
            Rechazar informe
          </Button>
        </CardContent>
      </Card>
    </>
  )
}
