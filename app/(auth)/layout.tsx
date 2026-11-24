import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { brandSerif } from '@/app/fonts'
import { SAFETY_RESOURCES } from '@/lib/shared/safety-resources'
import '@/app/landing.css'

/**
 * Marco visual de las páginas de acceso (login, registro y verificación).
 * Solo presentación: la lógica de autenticación vive en las páginas y en
 * `app/(auth)/actions.ts`, y no cambia.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${brandSerif.variable} grid min-h-screen flex-1 bg-[#f8f6f2] text-stone-800 lg:grid-cols-[1fr_1.05fr]`}>
      {/* Panel de marca (escritorio) */}
      <aside className="relative isolate hidden overflow-hidden bg-[#0c3b38] text-teal-50 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div aria-hidden className="landing-aurora landing-aurora--dark -z-10">
          <span />
          <span />
          <span />
        </div>
        <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-white">
          <span aria-hidden className="landing-orb-mini inline-block size-7 rounded-full" />
          Serenia
        </Link>

        <div className="max-w-md">
          <div aria-hidden className="breath size-28">
            <span className="breath-ring" />
            <span className="breath-ring" />
          </div>
          <p className="landing-serif mt-10 text-5xl leading-[1.08] text-white xl:text-[3.5rem]">
            Aquí puedes ir <em className="text-teal-200">a tu ritmo.</em>
          </p>
          <p className="mt-5 text-lg leading-relaxed text-teal-100/80">
            Un espacio para poner en palabras cómo estás, con el seguimiento de tu profesional detrás.
          </p>
        </div>

        <p className="max-w-md text-sm leading-relaxed text-teal-100/70">
          Serenia no es un servicio de urgencias. Si piensas en hacerte daño, llama a la{' '}
          <a className="font-medium text-white underline underline-offset-2" href={SAFETY_RESOURCES.suicide.href}>
            {SAFETY_RESOURCES.suicide.name}
          </a>{' '}
          (gratuita, 24 horas). En peligro inmediato, al{' '}
          <a className="font-medium text-white underline underline-offset-2" href={SAFETY_RESOURCES.emergency.href}>
            {SAFETY_RESOURCES.emergency.phone}
          </a>
          .
        </p>
      </aside>

      {/* Columna del formulario */}
      <div className="relative isolate flex min-h-screen flex-col overflow-hidden">
        <div aria-hidden className="landing-aurora -z-10 opacity-60 lg:opacity-40">
          <span />
          <span />
          <span />
        </div>
        <header className="flex items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight lg:invisible">
            <span aria-hidden className="landing-orb-mini inline-block size-7 rounded-full" />
            Serenia
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-white/70 hover:text-stone-900">
            <ArrowLeft className="size-4" />
            Volver al inicio
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="landing-enter w-full max-w-sm">{children}</div>
        </main>

        <footer className="space-y-4 px-5 pb-8 text-xs leading-relaxed text-stone-500 sm:px-8">
          <p className="lg:hidden">
            Serenia no es un servicio de urgencias. Si piensas en hacerte daño, llama a la{' '}
            <a className="font-medium text-stone-700 underline underline-offset-2" href={SAFETY_RESOURCES.suicide.href}>
              {SAFETY_RESOURCES.suicide.name}
            </a>{' '}
            (gratuita, 24 horas). En peligro inmediato, al{' '}
            <a className="font-medium text-stone-700 underline underline-offset-2" href={SAFETY_RESOURCES.emergency.href}>
              {SAFETY_RESOURCES.emergency.phone}
            </a>
            .
          </p>
          <nav aria-label="Legal" className="flex justify-center gap-5 lg:justify-end">
            <Link className="hover:text-stone-800" href="/privacidad">Privacidad</Link>
            <Link className="hover:text-stone-800" href="/terminos">Términos de uso</Link>
          </nav>
        </footer>
      </div>
    </div>
  )
}
