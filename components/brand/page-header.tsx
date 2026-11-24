import type { ReactNode } from 'react'
import { cn } from '@/lib/shared/utils'

/**
 * Cabecera de cada página de la app: antetítulo opcional, título en la serif
 * de marca (el único sitio de la app donde se usa) y una descripción breve.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
        )}
        <h1 className={cn('landing-serif text-[2rem] leading-[1.1] sm:text-[2.375rem] text-stone-900', eyebrow && 'mt-1.5')}>
          {title}
        </h1>
        {description && (
          <p className="mt-2 leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
