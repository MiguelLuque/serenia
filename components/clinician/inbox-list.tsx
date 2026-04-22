import Link from 'next/link'
import type { InboxRow } from '@/lib/clinician/inbox'
import { assessmentStatusLabel } from '@/lib/clinician/assessment-labels'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

function formatRelative(iso: string | null): string {
  if (!iso) return 'fecha desconocida'
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'hace menos de un minuto'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `hace ${days} d`
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function InboxList({ rows }: { rows: InboxRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>
            No hay sesiones cerradas por revisar.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const status = assessmentStatusLabel(row.assessmentStatus)
        return (
          <Link
            key={row.sessionId}
            href={`/app/clinica/sesion/${row.sessionId}`}
            className="block transition-opacity hover:opacity-90"
          >
            <Card className={row.hasCrisis ? 'border-red-200 bg-red-50' : undefined}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {row.displayName ?? 'Paciente sin nombre'}
                    </CardTitle>
                    <CardDescription>
                      Cerrada {formatRelative(row.closedAt)}
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {row.hasCrisis && (
                      <Badge variant="destructive">CRISIS</Badge>
                    )}
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
