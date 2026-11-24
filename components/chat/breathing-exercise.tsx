'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Respiración guiada opcional del estado vacío del chat. Solo arranca si la
 * persona lo pide, dura seis respiraciones (1 min) y se puede parar en
 * cualquier momento. Con prefers-reduced-motion el círculo queda quieto.
 */
export function BreathingExercise() {
  const [active, setActive] = useState(false)
  // Con movimiento reducido el círculo no se mueve: la pauta va en texto.
  const [reducedMotion, setReducedMotion] = useState(false)

  if (!active) {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-10 rounded-full border-stone-300 bg-white px-5"
        onClick={() => {
          setReducedMotion(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
          setActive(true)
        }}
      >
        Respirar un minuto
      </Button>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div aria-hidden className="breath size-28">
        <span className="breath-ring" onAnimationEnd={() => setActive(false)} />
        <span className="breath-ring" />
        <span className="breath-label text-sm font-medium text-teal-950">
          <span>Inhala</span>
          <span>Exhala</span>
        </span>
      </div>
      <p role="status" className="max-w-xs text-sm text-muted-foreground">
        {reducedMotion
          ? 'Inhala despacio contando hasta cuatro y suelta el aire contando hasta seis. Repítelo a tu ritmo.'
          : 'Inhala mientras el círculo crece y suelta el aire mientras se encoge.'}
      </p>
      <Button
        type="button"
        variant="ghost"
        className="h-10 rounded-full px-5"
        onClick={() => setActive(false)}
      >
        Parar
      </Button>
    </div>
  )
}
