import Link from 'next/link'
import type { InboxRow } from '@/lib/server/clinician/inbox'
import { assessmentStatusLabel } from '@/lib/shared/clinician/assessment-labels'
import {
  LONGITUDINAL_CODES,
  QUESTIONNAIRE_REGISTRY,
} from '@/lib/shared/questionnaires/registry'
import { Badge } from '@/components/ui/badge'

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

const RISK_LABEL: Record<
  Exclude<InboxRow['riskState'], 'none'>,
  { label: string; variant: 'secondary' | 'destructive' }
> = {
  watch: { label: 'Vigilar', variant: 'secondary' },
  active: { label: 'Riesgo activo', variant: 'destructive' },
  acute: { label: 'Riesgo agudo', variant: 'destructive' },
}

function buildLongitudinalLine(row: InboxRow): string {
  const pieces: string[] = [`Sesión nº ${row.sessionNumber}`]
  if (row.daysSincePrevious !== null) {
    pieces.push(`${row.daysSincePrevious} días desde la anterior`)
  }
  // Plan 8 Fase 1 (ADR-021 punto #1): trends data-driven a partir del
  // registry. Iteramos LONGITUDINAL_CODES para mantener orden consistente
  // (PHQ-9, GAD-7, BDI-II...) y usamos `shortLabel` para el display clínico.
  for (const code of LONGITUDINAL_CODES) {
    const trend = row.trendsByCode[code]
    if (trend && trend.length > 0) {
      pieces.push(`${QUESTIONNAIRE_REGISTRY[code].shortLabel}: ${trend.join('→')}`)
    }
  }
  if (row.openTasksCount > 0) {
    const suffix = row.openTasksCount === 1 ? 'acuerdo abierto' : 'acuerdos abiertos'
    pieces.push(`${row.openTasksCount} ${suffix}`)
  }
  return pieces.join(' · ')
}

export function InboxList({ rows }: { rows: InboxRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-4 py-8 text-center text-sm text-muted-foreground">
        No hay sesiones cerradas por revisar.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-stone-200/80 overflow-hidden rounded-2xl border border-stone-200/80 bg-white">
      {rows.map((row) => {
        const status = assessmentStatusLabel(row.assessmentStatus)
        const riskBadge =
          row.riskState !== 'none' ? RISK_LABEL[row.riskState] : null
        return (
          <li key={row.sessionId} className={row.hasCrisis ? 'bg-red-50' : undefined}>
            <Link
              href={`/app/clinica/sesion/${row.sessionId}`}
              className={`flex flex-col gap-2 px-4 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${
                row.hasCrisis ? 'shadow-[inset_4px_0_0_var(--color-red-500)] hover:bg-red-100/60' : 'hover:bg-stone-50'
              }`}
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-semibold text-stone-900">
                    {row.displayName ?? 'Paciente sin nombre'}
                  </span>
                  <span className="text-muted-foreground">
                    Cerrada {formatRelative(row.closedAt)}
                  </span>
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                  {buildLongitudinalLine(row)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                {riskBadge && (
                  <Badge variant={riskBadge.variant}>{riskBadge.label}</Badge>
                )}
                {row.hasCrisis && (
                  <Badge variant="destructive">CRISIS</Badge>
                )}
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
