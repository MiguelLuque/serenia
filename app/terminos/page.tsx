import Link from 'next/link'
import { UrgentHelpText } from '@/components/shared/urgent-help'
import { CURRENT_ACCEPTANCE_VERSION } from '@/lib/shared/onboarding/acceptance'

export default function Page() {
  return <main className="mx-auto max-w-2xl space-y-4 px-4 py-12"><h1 className="text-2xl font-semibold">Borrador técnico de uso</h1><p>Versión: {CURRENT_ACCEPTANCE_VERSION}</p><p>Documento provisional para pruebas: no son términos legales aprobados ni autorización de lanzamiento.</p><p>Serenia ofrece conversaciones con IA que puede cometer errores. No sustituye una evaluación ni atención sanitaria. No hay revisión humana inmediata o continua garantizada.</p><p>Acceso de prueba para personas de 18 años o más. <UrgentHelpText lead={false} linkClassName="underline" /></p><p>La aceptación registrada incluye fecha y versión. El uso real requiere aprobar términos, responsabilidades, disponibilidad clínica y condiciones de tratamiento antes del lanzamiento.</p><Link className="underline" href="/onboarding">Volver al perfil</Link></main>
}
