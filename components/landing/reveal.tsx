'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

type RevealProps = {
  children: ReactNode
  className?: string
  /** Retraso en milisegundos, para escalonar elementos hermanos. */
  delay?: number
  as?: 'div' | 'li' | 'section'
}

/**
 * Aparición suave al entrar en pantalla.
 *
 * El HTML del servidor se pinta siempre visible (sin JS o con lectores de
 * pantalla no se oculta nada). Solo tras montar, y únicamente si el bloque aún
 * no está en pantalla y la persona no pidió reducir el movimiento, se oculta
 * para revelarlo después: así nunca parpadea lo que ya se estaba viendo.
 */
export function Reveal({ children, className = '', delay = 0, as: Tag = 'div' }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [state, setState] = useState<'idle' | 'pending' | 'shown'>('idle')

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (typeof IntersectionObserver === 'undefined') return

    const rect = node.getBoundingClientRect()
    if (rect.top < window.innerHeight * 0.92) return

    setState('pending')
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setState('shown')
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const style = delay ? ({ '--reveal-delay': `${delay}ms` } as CSSProperties) : undefined

  return (
    <Tag
      ref={ref as never}
      data-reveal={state}
      className={`reveal ${className}`}
      style={style}
    >
      {children}
    </Tag>
  )
}
