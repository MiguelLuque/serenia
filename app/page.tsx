import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  ChartLine,
  ChevronDown,
  ClipboardList,
  FileText,
  MessageCircleHeart,
  Phone,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react'
import { ChatDemo } from '@/components/landing/chat-demo'
import { ClinicianPreview } from '@/components/landing/clinician-preview'
import { Reveal } from '@/components/landing/reveal'
import { TrendChart } from '@/components/landing/trend-chart'
import { isPublicRegistrationEnabled } from '@/lib/shared/auth/registration-policy'
import { SAFETY_RESOURCES } from '@/lib/shared/safety-resources'
import { brandSerif as serif } from './fonts'
import './landing.css'


export const metadata: Metadata = {
  title: 'Serenia — Apoyo conversacional para ansiedad y ánimo bajo',
  description:
    'Serenia es un espacio de conversación con IA para explorar cómo te sientes, con cuestionarios validados y resúmenes pensados para tu profesional. No sustituye la atención sanitaria ni de urgencia.',
}

const STEPS = [
  {
    icon: MessageCircleHeart,
    title: 'Cuenta cómo estás',
    body: 'Conversas a tu ritmo, por escrito, en sesiones con principio y final. Serenia escucha, pregunta con cuidado y te ayuda a ordenar lo que sientes.',
  },
  {
    icon: ClipboardList,
    title: 'Mide lo que cuesta nombrar',
    body: 'Cuando tiene sentido, te propone cuestionarios clínicos validados, como el PHQ-9 o el GAD-7. La puntuación se calcula de forma fija y comprobable, no la estima la IA.',
  },
  {
    icon: FileText,
    title: 'Llévalo a tu profesional',
    body: 'Cada sesión deja un resumen. Los informes preliminares quedan marcados como pendientes de revisión profesional, sin un plazo garantizado, y nunca se presentan como un diagnóstico.',
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

const FAQ = [
  {
    q: '¿Estoy hablando con una persona?',
    a: 'No. Las conversaciones son con un asistente de inteligencia artificial preparado para escuchar y hacer preguntas con cuidado. Puede equivocarse, y nunca te dará un diagnóstico ni te recomendará medicación.',
  },
  {
    q: '¿Qué pasa si estoy pasando por un momento muy difícil?',
    a: `Si en la conversación aparecen señales de riesgo, Serenia te mostrará recursos de ayuda inmediata y lo dejará señalado para el profesional. Pero no es un servicio de urgencias: si estás en peligro, llama al ${SAFETY_RESOURCES.emergency.phone}, y si piensas en hacerte daño, a la ${SAFETY_RESOURCES.suicide.name}.`,
  },
  {
    q: '¿Quién puede ver lo que escribo?',
    a: 'Tú ves el resumen de cada sesión cuando el profesional lo ha revisado y autorizado; no hay un plazo de revisión garantizado. Los informes clínicos internos se reservan al profesional autorizado. Tienes los detalles en la información de privacidad.',
  },
  {
    q: '¿Cómo puedo empezar?',
    a: 'Ahora mismo Serenia está en un piloto privado para mayores de 18 años en España, y el acceso es por invitación.',
  },
] as const

export default function HomePage() {
  const registrationOpen = isPublicRegistrationEnabled()

  return (
    <div className={`${serif.variable} flex min-h-screen flex-col bg-[#f8f6f2] text-stone-800`}>
      <header className="sticky top-0 z-30 border-b border-stone-900/5 bg-[#f8f6f2]/75 backdrop-blur-lg">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            <span aria-hidden className="landing-orb-mini inline-block size-7 rounded-full" />
            Serenia
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-1 text-sm">
            <a className="hidden rounded-full px-3.5 py-2 text-stone-600 hover:text-stone-900 md:inline-block" href="#como-funciona">Cómo funciona</a>
            <a className="hidden rounded-full px-3.5 py-2 text-stone-600 hover:text-stone-900 md:inline-block" href="#profesionales">Profesionales</a>
            <a className="hidden rounded-full px-3.5 py-2 text-stone-600 hover:text-stone-900 md:inline-block" href="#preguntas">Preguntas</a>
            {registrationOpen && (
              <Link className="hidden rounded-full px-3.5 py-2 text-stone-600 hover:text-stone-900 sm:inline-block" href="/registro">
                Crear cuenta
              </Link>
            )}
            <Link className="ml-1 rounded-full bg-stone-900 px-4 py-2 text-white transition-colors hover:bg-stone-700" href="/login">
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* ---------- Hero ---------- */}
        <section className="relative isolate overflow-hidden">
          <div aria-hidden className="landing-aurora -z-10">
            <span />
            <span />
            <span />
          </div>
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-16 pt-12 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:pb-24">
            <div>
              <p className="landing-enter inline-flex items-center gap-2 rounded-full border border-teal-900/10 bg-white/70 px-3 py-1 text-xs font-medium text-teal-900 backdrop-blur">
                <span aria-hidden className="size-1.5 rounded-full bg-teal-600" />
                Piloto privado · España · Mayores de 18 años
              </p>
              <h1
                className="landing-enter landing-serif mt-6 text-[2.75rem] leading-[1.05] text-stone-900 sm:text-6xl lg:text-[4.25rem]"
                style={{ '--enter-delay': '80ms' } as React.CSSProperties}
              >
                Un lugar tranquilo para poner en palabras{' '}
                <em className="text-teal-700">cómo estás.</em>
              </h1>
              <p
                className="landing-enter mt-6 max-w-xl text-lg leading-relaxed text-stone-600"
                style={{ '--enter-delay': '160ms' } as React.CSSProperties}
              >
                Serenia es un apoyo conversacional con inteligencia artificial para quienes atraviesan ansiedad o ánimo
                bajo. Te acompaña entre sesiones, te ayuda a ver cómo evolucionas y prepara resúmenes que puedes
                compartir con tu profesional.
              </p>
              <div
                className="landing-enter mt-8 flex flex-wrap items-center gap-3"
                style={{ '--enter-delay': '240ms' } as React.CSSProperties}
              >
                <Link
                  className="group inline-flex items-center gap-2 rounded-full bg-teal-700 px-6 py-3.5 font-medium text-white shadow-lg shadow-teal-900/20 transition-all hover:bg-teal-800 hover:shadow-teal-900/30"
                  href="/login"
                >
                  Entrar a Serenia
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                {registrationOpen ? (
                  <Link className="rounded-full border border-stone-300 bg-white/60 px-6 py-3.5 font-medium hover:bg-white" href="/registro">
                    Crear cuenta
                  </Link>
                ) : (
                  <p className="text-sm text-stone-500">Ahora mismo el acceso es solo por invitación.</p>
                )}
              </div>
              <ul
                className="landing-enter mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-stone-600"
                style={{ '--enter-delay': '320ms' } as React.CSSProperties}
              >
                <li className="flex items-center gap-2"><ClipboardList className="size-4 text-teal-700" />Cuestionarios validados</li>
                <li className="flex items-center gap-2"><Stethoscope className="size-4 text-teal-700" />Revisión profesional</li>
                <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-teal-700" />Sin diagnósticos automáticos</li>
              </ul>
            </div>

            <div
              className="landing-enter relative mx-auto w-full max-w-md lg:mr-0"
              style={{ '--enter-delay': '200ms' } as React.CSSProperties}
            >
              <ChatDemo />
              <div aria-hidden className="landing-float absolute -left-20 -top-10 hidden rounded-2xl bg-white/90 px-4 py-3 shadow-xl ring-1 ring-stone-900/5 backdrop-blur xl:block">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">PHQ-9</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-stone-700">
                  <ChartLine className="size-4 text-teal-600" /> Tendencia de 6 semanas
                </p>
              </div>
              <div aria-hidden className="landing-float-late absolute -bottom-7 -right-8 hidden rounded-2xl bg-white/90 px-4 py-3 shadow-xl ring-1 ring-stone-900/5 backdrop-blur xl:block">
                <p className="flex items-center gap-1.5 text-sm font-medium text-stone-700">
                  <ClipboardList className="size-4 text-teal-600" /> Puntuación automática
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Aviso de urgencias ---------- */}
        <section aria-label="Ayuda urgente" className="border-y border-amber-200/70 bg-amber-50">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-5 text-amber-950 sm:flex-row sm:items-center sm:gap-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <Phone className="size-5 text-amber-700" />
            </span>
            <p className="text-sm leading-relaxed">
              <strong className="font-semibold">Serenia no es un servicio de urgencias.</strong> Si piensas en hacerte
              daño o en quitarte la vida, llama ahora a la{' '}
              <a className="font-semibold underline underline-offset-2" href={SAFETY_RESOURCES.suicide.href}>{SAFETY_RESOURCES.suicide.name}</a>{' '}
              (gratuita, 24 horas). Si tu vida o la de otra persona corre peligro inmediato, llama al{' '}
              <a className="font-semibold underline underline-offset-2" href={SAFETY_RESOURCES.emergency.href}>{SAFETY_RESOURCES.emergency.phone}</a>.
            </p>
          </div>
        </section>

        {/* ---------- Cómo funciona ---------- */}
        <section id="como-funciona" aria-labelledby="como-funciona-titulo" className="scroll-mt-20 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
            <Reveal className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">Cómo funciona</p>
              <h2 id="como-funciona-titulo" className="landing-serif mt-3 text-4xl leading-tight text-stone-900 sm:text-5xl">
                Una conversación, un seguimiento y un profesional detrás.
              </h2>
            </Reveal>
            <ol className="mt-14 grid gap-5 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <Reveal as="li" key={step.title} delay={index * 120} className="group relative rounded-3xl border border-stone-200 bg-[#fbfaf8] p-7 transition-shadow hover:shadow-[0_20px_50px_-30px_rgba(15,80,75,0.45)]">
                  <div className="flex items-center justify-between">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-md shadow-teal-900/20 transition-transform group-hover:-translate-y-0.5">
                      <step.icon className="size-5" />
                    </span>
                    <span aria-hidden className="landing-serif text-5xl text-stone-200">{index + 1}</span>
                  </div>
                  <h3 className="mt-6 text-lg font-semibold text-stone-900">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-stone-600">{step.body}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- Evolución ---------- */}
        <section aria-labelledby="evolucion-titulo" className="overflow-hidden">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:py-28 lg:grid-cols-2">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">Seguimiento</p>
              <h2 id="evolucion-titulo" className="landing-serif mt-3 text-4xl leading-tight text-stone-900 sm:text-5xl">
                Ver el camino, no solo el día de hoy.
              </h2>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-stone-600">
                Los cuestionarios que respondes se guardan con su fecha. Así tú y tu profesional podéis ver cómo cambian
                las cosas semana a semana, con números que se calculan siempre igual.
              </p>
              <ul className="mt-6 space-y-2.5 text-stone-600">
                <li className="flex gap-3"><Dot />PHQ-9 para el ánimo y GAD-7 para la ansiedad, entre otros.</li>
                <li className="flex gap-3"><Dot />La puntuación la calcula el sistema con las reglas de cada cuestionario, no la IA.</li>
                <li className="flex gap-3"><Dot />Un historial de tus sesiones para volver a ellas cuando quieras.</li>
              </ul>
            </Reveal>
            <Reveal delay={150}>
              <TrendChart />
            </Reveal>
          </div>
        </section>

        {/* ---------- Profesionales ---------- */}
        <section id="profesionales" aria-labelledby="profesionales-titulo" className="relative isolate scroll-mt-20 overflow-hidden bg-[#0c3b38] text-teal-50">
          <div aria-hidden className="absolute -right-40 -top-40 -z-10 size-[36rem] rounded-full bg-teal-500/20 blur-3xl" />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:py-28 lg:grid-cols-2">
            <Reveal className="order-2 lg:order-1" delay={120}>
              <ClinicianPreview />
            </Reveal>
            <Reveal className="order-1 lg:order-2">
              <p className="text-sm font-semibold uppercase tracking-wider text-teal-300">Para profesionales</p>
              <h2 id="profesionales-titulo" className="landing-serif mt-3 text-4xl leading-tight text-white sm:text-5xl">
                Llegar a consulta con más contexto.
              </h2>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-teal-100/90">
                El profesional dispone de un panel con los resúmenes de sesión, la evolución de los cuestionarios y las
                señales de riesgo que la conversación haya detectado. Los informes preliminares los revisa y corrige
                el profesional, sin un plazo de revisión garantizado: la última palabra es siempre humana.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ---------- Qué es y qué no es ---------- */}
        <section aria-labelledby="que-es-titulo" className="bg-white">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
            <Reveal className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">Con los pies en el suelo</p>
              <h2 id="que-es-titulo" className="landing-serif mt-3 text-4xl leading-tight text-stone-900 sm:text-5xl">
                Qué es Serenia, y qué no es.
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-5 md:grid-cols-2">
              <Reveal>
                <List title="Serenia es" items={IS} tone="positive" />
              </Reveal>
              <Reveal delay={120}>
                <List title="Serenia no es" items={IS_NOT} tone="neutral" />
              </Reveal>
            </div>
            <Reveal className="mt-6 max-w-3xl text-sm leading-relaxed text-stone-500">
              <p>
                Serenia usa modelos de IA que pueden equivocarse. Si algo de lo que dice no te encaja, coméntalo con tu
                profesional. Nunca te recomendará medicación ni te dará un diagnóstico.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ---------- Preguntas ---------- */}
        <section id="preguntas" aria-labelledby="preguntas-titulo" className="scroll-mt-20">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:py-28 lg:grid-cols-[1fr_1.4fr]">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">Preguntas frecuentes</p>
              <h2 id="preguntas-titulo" className="landing-serif mt-3 text-4xl leading-tight text-stone-900 sm:text-5xl">
                Lo que suele preguntarse antes de empezar.
              </h2>
              <p className="mt-5 text-stone-600">
                Más detalle en la{' '}
                <Link className="font-medium text-teal-800 underline underline-offset-2" href="/privacidad">información de privacidad</Link>{' '}
                y los{' '}
                <Link className="font-medium text-teal-800 underline underline-offset-2" href="/terminos">términos de uso</Link>.
              </p>
            </Reveal>
            <Reveal delay={120} className="divide-y divide-stone-200 border-y border-stone-200">
              {FAQ.map(item => (
                <details key={item.q} className="faq group py-5">
                  <summary className="flex items-center justify-between gap-6 text-left text-lg font-medium text-stone-900">
                    {item.q}
                    <ChevronDown className="size-5 shrink-0 text-stone-400" />
                  </summary>
                  <p className="mt-3 leading-relaxed text-stone-600">{item.a}</p>
                </details>
              ))}
            </Reveal>
          </div>
        </section>

        {/* ---------- Cierre con respiración ---------- */}
        <section aria-labelledby="cierre-titulo" className="px-5 pb-20">
          <Reveal className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-[#0c3b38] px-6 py-16 text-center text-white sm:py-20">
            <div aria-hidden className="absolute inset-x-0 -top-32 -z-10 mx-auto size-[30rem] rounded-full bg-teal-400/20 blur-3xl" />
            <div aria-hidden className="breath mx-auto size-40 sm:size-48">
              <span className="breath-ring" />
              <span className="breath-ring" />
              <span className="breath-label text-sm font-medium tracking-wide text-teal-950">
                <span>Inspira</span>
                <span>Suelta el aire</span>
              </span>
            </div>
            <h2 id="cierre-titulo" className="landing-serif mx-auto mt-10 max-w-2xl text-4xl leading-tight sm:text-5xl">
              Tómate un momento. Aquí no hay prisa.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-teal-100/90">
              Si ya tienes una invitación, entra y empieza tu primera sesión cuando te venga bien.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 font-medium text-teal-900 transition-colors hover:bg-teal-50" href="/login">
                Entrar a Serenia <ArrowRight className="size-4" />
              </Link>
              {registrationOpen && (
                <Link className="rounded-full border border-white/30 px-6 py-3.5 font-medium hover:bg-white/10" href="/registro">
                  Crear cuenta
                </Link>
              )}
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl space-y-6 px-5 py-10 text-sm text-stone-500">
          <p>
            Serenia no es un servicio de urgencias. Si estás en peligro, llama al{' '}
            <a className="font-medium text-stone-700 underline underline-offset-2" href={SAFETY_RESOURCES.emergency.href}>
              {SAFETY_RESOURCES.emergency.phone}
            </a>
            . Si piensas en hacerte daño, llama a la{' '}
            <a className="font-medium text-stone-700 underline underline-offset-2" href={SAFETY_RESOURCES.suicide.href}>
              {SAFETY_RESOURCES.suicide.name}
            </a>{' '}
            (gratuita, 24 horas).
          </p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="flex items-center gap-2">
              <span aria-hidden className="landing-orb-mini inline-block size-4 rounded-full" />
              Serenia · Prototipo en fase de pruebas. No sustituye la atención sanitaria.
            </p>
            <nav aria-label="Legal" className="flex gap-5">
              <Link className="hover:text-stone-800" href="/privacidad">Privacidad</Link>
              <Link className="hover:text-stone-800" href="/terminos">Términos de uso</Link>
              <Link className="hover:text-stone-800" href="/login">Entrar</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Dot() {
  return <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-teal-600" />
}

function List({ title, items, tone }: { title: string; items: readonly string[]; tone: 'positive' | 'neutral' }) {
  return (
    <div className={`h-full rounded-3xl border p-7 ${tone === 'positive' ? 'border-teal-100 bg-teal-50/50' : 'border-stone-200 bg-[#fbfaf8]'}`}>
      <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
      <ul className="mt-5 space-y-3.5">
        {items.map(item => (
          <li key={item} className="flex gap-3 leading-relaxed text-stone-600">
            <span
              aria-hidden
              className={`mt-2 size-2 shrink-0 rounded-full ${tone === 'positive' ? 'bg-teal-500' : 'bg-stone-400'}`}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
