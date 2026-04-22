import Link from 'next/link'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { getClinicianPatients } from '@/lib/clinician/patients'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

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
      <div>
        <h2 className="text-xl font-semibold">Pacientes</h2>
        <p className="mt-1 text-sm text-slate-600">
          Pacientes con al menos una sesión cerrada.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Listado</CardTitle>
        </CardHeader>
        <CardContent>
          {patients.length === 0 ? (
            <p className="text-sm text-slate-600">
              Aún no hay pacientes con sesiones cerradas.
            </p>
          ) : (
            <ul className="space-y-2">
              {patients.map((p) => (
                <li key={p.userId}>
                  <Link
                    href={`/app/clinica/paciente/${p.userId}`}
                    className="block transition-opacity hover:opacity-90"
                  >
                    <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                      <div>
                        <div className="font-medium">
                          {p.displayName ?? 'Paciente sin nombre'}
                        </div>
                        <div className="text-slate-600">
                          {p.closedSessionCount}{' '}
                          {p.closedSessionCount === 1
                            ? 'sesión cerrada'
                            : 'sesiones cerradas'}
                        </div>
                      </div>
                      <div className="text-right text-slate-600">
                        <div className="text-xs uppercase tracking-wide">
                          Última sesión
                        </div>
                        <div>{formatDate(p.lastClosedAt)}</div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
