import { Phone } from 'lucide-react'
import { SAFETY_RESOURCES } from '@/lib/shared/safety-resources'

/** Franja fija de ayuda inmediata del chat: siempre visible, sin animación y sin opción de cerrarla. */
export function CrisisBanner() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-1.5 text-sm text-stone-800">
      <span>¿Necesitas ayuda inmediata?</span>
      <span className="flex flex-wrap items-center gap-x-1">
        <a
          href={SAFETY_RESOURCES.suicide.href}
          className="inline-flex min-h-8 items-center sm:min-h-10 gap-1.5 rounded-md px-1.5 font-semibold text-amber-950 underline underline-offset-2"
        >
          <Phone aria-hidden className="size-3.5" />
          {SAFETY_RESOURCES.suicide.name}
        </a>
        <span className="text-stone-600">(gratuita, 24 h)</span>
        <span aria-hidden className="hidden text-stone-400 sm:inline">·</span>
        <a
          href={SAFETY_RESOURCES.emergency.href}
          className="inline-flex min-h-8 items-center sm:min-h-10 gap-1.5 rounded-md px-1.5 font-semibold text-amber-950 underline underline-offset-2"
        >
          <Phone aria-hidden className="size-3.5" />
          {SAFETY_RESOURCES.emergency.phone} emergencias
        </a>
      </span>
    </div>
  )
}
