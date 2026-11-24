import { cn } from '@/lib/shared/utils'

/** Orbe de marca estático. Decorativo: siempre va acompañado de texto. */
export function BrandOrb({ className }: { className?: string }) {
  return <span aria-hidden className={cn('landing-orb-mini inline-block size-7 shrink-0 rounded-full', className)} />
}
