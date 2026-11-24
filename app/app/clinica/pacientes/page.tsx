import Link from 'next/link'
import { PageHeader } from '@/components/brand/page-header'
import { createAuthenticatedClient } from '@/lib/server/supabase/server'
import { getClinicianPatients } from '@/lib/server/clinician/patients'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function PatientsIndexPage() {
  const supabase = await createAuthenticatedClient()
  const patients = await getClinicianPatients(supabase)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Panel clínico"
        title="Pacientes"
        description="Pacientes con al menos una sesión cerrada."
      />

      {patients.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-4 py-8 text-center text-sm text-muted-foreground">
          Aún no hay pacientes con sesiones cerradas.
        </p>
      ) : (
        <ul className="divide-y divide-stone-200/80 overflow-hidden rounded-2xl border border-stone-200/80 bg-white">
          {patients.map((p) => (
            <li key={p.userId}>
              <Link
                href={`/app/clinica/paciente/${p.userId}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm outline-none transition-colors hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <div>
                  <div className="font-semibold text-stone-900">
                    {p.displayName ?? 'Paciente sin nombre'}
                  </div>
                  <div className="text-muted-foreground">
                    {p.closedSessionCount}{' '}
                    {p.closedSessionCount === 1
                      ? 'sesión cerrada'
                      : 'sesiones cerradas'}
                  </div>
                </div>
                <div className="text-right text-muted-foreground">
                  <div className="text-xs uppercase tracking-wide">
                    Última sesión
                  </div>
                  <div className="tabular-nums">{formatDate(p.lastClosedAt)}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
