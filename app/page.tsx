import type { Metadata } from 'next'
import Link from 'next/link'
import { isPublicRegistrationEnabled } from '@/lib/shared/auth/registration-policy'
import { SAFETY_RESOURCES } from '@/lib/shared/safety-resources'

export const metadata: Metadata = {
  title: 'Serenia — Apoyo conversacional para ansiedad y ánimo bajo',
  description:
    'Serenia es un espacio de conversación con IA para explorar cómo te sientes, con cuestionarios validados y resúmenes pensados para tu profesional. No sustituye la atención sanitaria ni de urgencia.',
}

const STEPS = [
  {
    title: 'Cuenta cómo estás',
    body: 'Conversas a tu ritmo, por escrito, en sesiones con principio y final. Serenia escucha, pregunta con cuidado y te ayuda a ordenar lo que sientes.',
  },
  {
    title: 'Mide lo que cuesta nombrar',
    body: 'Cuando tiene sentido, la conversación te propone cuestionarios clínicos validados, como el PHQ-9 o el GAD-7. La puntuación se calcula de forma automática y fija, no la interpreta la IA a ojo.',
  },
  {
    title: 'Llévalo a tu profesional',
    body: 'Cada sesión deja un resumen. Los informes preliminares quedan marcados como pendientes de revisión por un profesional y nunca se presentan como un diagnóstico.',
  },
] as const

const IS = [
  'Un espacio para desahogarte y poner en palabras lo que te pasa.',
  'Un seguimiento de cómo evoluciona tu ánimo y tu ansiedad entre sesiones.',
  'Un apoyo complementario al trabajo con un profesional de la salud mental.',
] as const

const IS_NOT = [
  'Un diagnóstico ni una evaluación clínica completa.',
  'Un sustituto de tu psicólogo, tu psiquiatra o tu médico.',
  'Un servicio de urgencias: no hay una persona revisando cada conversación en tiempo real.',
] as const

export default function HomePage() {
  const registrationOpen = isPublicRegistrationEnabled()

  return (
    <div className="flex min-h-screen flex-col bg-stone-50 text-stone-800 dark:bg-stone-950 dark:text-stone-100">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span aria-hidden className="inline-block size-6 rounded-full bg-gradient-to-br from-teal-300 to-teal-600" />
          Serenia
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          {registrationOpen && (
            <Link className="hidden rounded-full px-4 py-2 hover:bg-stone-200/60 sm:inline-block dark:hover:bg-stone-800" href="/registro">
              Crear cuenta
            </Link>
          )}
          <Link className="rounded-full border border-stone-300 px-4 py-2 hover:bg-white dark:border-stone-700 dark:hover:bg-stone-900" href="/login">
            Entrar
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-5 pb-14 pt-10 sm:pt-16">
          <p className="inline-flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1 text-xs font-medium text-teal-900 dark:bg-teal-950 dark:text-teal-200">
            <span aria-hidden className="size-1.5 rounded-full bg-teal-600" />
            Piloto privado · España · Mayores de 18 años
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Un lugar tranquilo para poner en palabras cómo estás.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-600 dark:text-stone-300">
            Serenia es un apoyo conversacional con inteligencia artificial para quienes atraviesan ansiedad o ánimo bajo.
            Te acompaña entre sesiones, te ayuda a seguir cómo evolucionas y prepara resúmenes que puedes compartir con
            tu profesional.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link className="rounded-full bg-teal-700 px-6 py-3 text-white shadow-sm hover:bg-teal-800" href="/login">
              Entrar a Serenia
            </Link>
            {registrationOpen ? (
              <Link className="rounded-full border border-stone-300 px-6 py-3 hover:bg-white dark:border-stone-700 dark:hover:bg-stone-900" href="/registro">
                Crear cuenta
              </Link>
            ) : (
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Ahora mismo el acceso es solo por invitación.
              </p>
            )}
          </div>

          <SafetyNotice className="mt-10" />
        </section>

        <section aria-labelledby="como-funciona" className="border-y border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
          <div className="mx-auto max-w-5xl px-5 py-14">
            <h2 id="como-funciona" className="text-2xl font-semibold tracking-tight">Cómo funciona</h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="rounded-2xl border border-stone-200 p-6 dark:border-stone-800">
                  <span className="flex size-8 items-center justify-center rounded-full bg-teal-50 text-sm font-semibold text-teal-800 dark:bg-teal-950 dark:text-teal-200">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="que-es" className="mx-auto max-w-5xl px-5 py-14">
          <h2 id="que-es" className="text-2xl font-semibold tracking-tight">Qué es Serenia y qué no es</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <List title="Serenia es" items={IS} tone="positive" />
            <List title="Serenia no es" items={IS_NOT} tone="neutral" />
          </div>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-stone-500 dark:text-stone-400">
            Serenia usa modelos de IA que pueden equivocarse. Si algo de lo que dice no te encaja, coméntalo con tu
            profesional. Nunca te recomendará medicación ni te dará un diagnóstico.
          </p>
        </section>

        <section aria-labelledby="profesionales" className="bg-teal-900 text-teal-50 dark:bg-teal-950">
          <div className="mx-auto grid max-w-5xl gap-8 px-5 py-14 sm:grid-cols-2">
            <div>
              <h2 id="profesionales" className="text-2xl font-semibold tracking-tight">Pensado junto a profesionales</h2>
              <p className="mt-4 leading-relaxed text-teal-100">
                El clínico dispone de un panel con los resúmenes de sesión, la evolución de los cuestionarios y las
                señales de riesgo que la conversación haya detectado, para llegar a la consulta con más contexto.
              </p>
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Tus datos, con cuidado</h2>
              <p className="mt-4 leading-relaxed text-teal-100">
                Lo que compartes en Serenia puede incluir información de salud. Tú ves el resumen de cada sesión, y
                los informes clínicos internos se reservan al profesional autorizado. Consulta los detalles en la{' '}
                <Link className="underline underline-offset-2" href="/privacidad">información de privacidad</Link>.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 dark:border-stone-800">
        <div className="mx-auto max-w-5xl space-y-6 px-5 py-10 text-sm text-stone-500 dark:text-stone-400">
          <SafetyNotice compact />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p>Serenia · Prototipo en fase de pruebas. No sustituye la atención sanitaria.</p>
            <nav className="flex gap-4">
              <Link className="hover:underline" href="/privacidad">Privacidad</Link>
              <Link className="hover:underline" href="/terminos">Términos de uso</Link>
              <Link className="hover:underline" href="/login">Entrar</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}

function SafetyNotice({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const { suicide, emergency } = SAFETY_RESOURCES
  if (compact) {
    return (
      <p>
        Serenia no es un servicio de urgencias. Si estás en peligro, llama al{' '}
        <a className="font-medium text-stone-700 underline underline-offset-2 dark:text-stone-200" href={emergency.href}>
          {emergency.phone}
        </a>
        . Si piensas en hacerte daño, llama a la{' '}
        <a className="font-medium text-stone-700 underline underline-offset-2 dark:text-stone-200" href={suicide.href}>
          {suicide.name}
        </a>{' '}
        (gratuita, 24 horas).
      </p>
    )
  }
  return (
    <aside
      aria-label="Ayuda urgente"
      className={`max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100 ${className}`}
    >
      <p className="font-semibold">Serenia no es un servicio de urgencias.</p>
      <p className="mt-1 text-sm leading-relaxed">
        Si piensas en hacerte daño o en quitarte la vida, llama ahora a la{' '}
        <a className="font-semibold underline underline-offset-2" href={suicide.href}>{suicide.name}</a>{' '}
        (gratuita, 24 horas). Si tu vida o la de otra persona corre peligro inmediato, llama al{' '}
        <a className="font-semibold underline underline-offset-2" href={emergency.href}>{emergency.phone}</a>.
      </p>
    </aside>
  )
}

function List({ title, items, tone }: { title: string; items: readonly string[]; tone: 'positive' | 'neutral' }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-900">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-4 space-y-3">
        {items.map(item => (
          <li key={item} className="flex gap-3 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
            <span
              aria-hidden
              className={`mt-1.5 size-2 shrink-0 rounded-full ${tone === 'positive' ? 'bg-teal-500' : 'bg-stone-400'}`}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
