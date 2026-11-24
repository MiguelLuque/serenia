import Link from 'next/link'
import type { OpenSessionRiskSignal } from '@/lib/server/clinician/open-risk'
import { Badge } from '@/components/ui/badge'

const RISK_TYPE_LABEL: Record<OpenSessionRiskSignal['riskType'], string> = {
  suicidal_ideation: 'Ideación suicida',
  self_harm: 'Autolesión',
  severe_distress: 'Malestar grave',
  crisis_other: 'Otra señal de crisis',
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
}

/** Renders nothing when there are no signals, so the inbox is unchanged. */
export function OpenRiskSignals({ signals }: { signals: OpenSessionRiskSignal[] }) {
  if (!signals.length) return null
  return (
    <section aria-labelledby="open-risk-heading" className="space-y-3 rounded-2xl border border-red-300 bg-red-50 p-4">
      <div>
        <h3 id="open-risk-heading" className="text-base font-semibold text-red-900">Señales de riesgo en sesiones sin cerrar</h3>
        <p className="mt-1 text-sm text-red-900">
          Señales automáticas provisionales, no un diagnóstico. La sesión sigue abierta y todavía no tiene informe.
        </p>
      </div>
      <ul className="space-y-2">
        {signals.map(signal => (
          <li key={signal.eventId}>
            <Link href={`/app/clinica/paciente/${signal.userId}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-white p-3 text-sm transition-colors hover:bg-red-50/50">
              <span className="font-medium">{signal.displayName ?? 'Paciente sin nombre'}</span>
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant="destructive">{signal.severity === 'critical' ? 'Crítica' : 'Alta'}</Badge>
                <span>{RISK_TYPE_LABEL[signal.riskType]}</span>
                <span className="text-muted-foreground">registrada el {formatDateTime(signal.createdAt)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
