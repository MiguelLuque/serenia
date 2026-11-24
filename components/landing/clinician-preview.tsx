import { ShieldAlert, FileText, ChartLine } from 'lucide-react'

/** Vista ilustrativa del panel del profesional. Pacientes y datos ficticios. */

const PATIENTS = [
  { initials: 'AM', name: 'Paciente A', note: 'Resumen de sesión nuevo', tag: 'Pendiente de revisión', tone: 'teal' },
  { initials: 'JR', name: 'Paciente B', note: 'GAD-7 completado · 11 puntos', tag: 'Cuestionario', tone: 'stone' },
  { initials: 'LP', name: 'Paciente C', note: 'Señal de riesgo detectada', tag: 'Prioritario', tone: 'amber' },
] as const

const TONES = {
  teal: 'bg-teal-50 text-teal-800 ring-teal-200',
  stone: 'bg-stone-100 text-stone-700 ring-stone-200',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200',
} as const

export function ClinicianPreview() {
  return (
    <div
      className="rounded-3xl border border-white/15 bg-white/[0.06] p-4 shadow-2xl backdrop-blur sm:p-5"
      role="img"
      aria-label="Ejemplo ficticio del panel del profesional con resúmenes pendientes de revisión, cuestionarios y una señal de riesgo prioritaria."
    >
      <div aria-hidden className="flex items-center justify-between px-1 pb-3">
        <p className="text-sm font-semibold text-white">Bandeja del profesional</p>
        <p className="text-[11px] text-teal-200/80">Datos ficticios</p>
      </div>
      <ul aria-hidden className="space-y-2">
        {PATIENTS.map(patient => (
          <li key={patient.name} className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3 text-stone-800">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
              {patient.initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{patient.name}</p>
              <p className="truncate text-xs text-stone-500">{patient.note}</p>
            </div>
            <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ring-1 sm:inline ${TONES[patient.tone]}`}>
              {patient.tag}
            </span>
          </li>
        ))}
      </ul>
      <div aria-hidden className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] text-teal-50">
        <span className="flex flex-col items-center gap-1 rounded-xl bg-white/[0.07] px-2 py-2.5"><FileText className="size-4" />Informes</span>
        <span className="flex flex-col items-center gap-1 rounded-xl bg-white/[0.07] px-2 py-2.5"><ChartLine className="size-4" />Evolución</span>
        <span className="flex flex-col items-center gap-1 rounded-xl bg-white/[0.07] px-2 py-2.5"><ShieldAlert className="size-4" />Riesgo</span>
      </div>
    </div>
  )
}
