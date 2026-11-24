'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, FileText, Pause, Play } from 'lucide-react'

/**
 * Demostración animada de una sesión. Todo el contenido es ficticio.
 *
 * El servidor pinta la conversación completa (útil sin JS, para buscadores y
 * con movimiento reducido). En el cliente, tras unos segundos, la conversación
 * se reproduce paso a paso en bucle, solo mientras está en pantalla.
 */

const GAD7_OPTIONS = ['Ningún día', 'Varios días', 'Más de la mitad de los días', 'Casi todos los días'] as const

// Pasos: 0 usuario · 1 escribiendo · 2 Serenia · 3 usuario · 4 escribiendo
// 5 Serenia · 6 cuestionario · 7 respuesta marcada · 8 resumen guardado
const FINAL_STEP = 8
const STEP_DURATIONS = [1400, 1500, 2600, 1600, 1500, 2600, 1700, 1500, 4200]

export function ChatDemo() {
  const [step, setStep] = useState(FINAL_STEP)
  const [fading, setFading] = useState(false)
  const [paused, setPaused] = useState(false)
  const [animated, setAnimated] = useState(false)
  const pausedRef = useRef(false)
  const resumeRef = useRef<() => void>(() => {})
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el control de pausa solo existe si hay animación
    setAnimated(true)

    let visible = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let current = FINAL_STEP

    const observer =
      typeof IntersectionObserver === 'undefined'
        ? undefined
        : new IntersectionObserver(entries => {
            const wasVisible = visible
            visible = entries.some(entry => entry.isIntersecting)
            if (visible && !wasVisible) schedule(1200)
          })
    if (rootRef.current) observer?.observe(rootRef.current)

    function advance() {
      if (!visible || document.hidden || pausedRef.current) return
      if (current >= FINAL_STEP) {
        setFading(true)
        timer = setTimeout(() => {
          current = 0
          setStep(0)
          setFading(false)
          schedule(STEP_DURATIONS[0])
        }, 450)
        return
      }
      current += 1
      setStep(current)
      schedule(STEP_DURATIONS[current])
    }

    function schedule(ms: number) {
      clearTimeout(timer)
      timer = setTimeout(advance, ms)
    }

    resumeRef.current = () => schedule(600)

    function onVisibility() {
      if (!document.hidden && visible) schedule(800)
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Primera vuelta: deja ver la conversación completa y luego la reproduce.
    schedule(3200)

    return () => {
      clearTimeout(timer)
      observer?.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      delete document.documentElement.dataset.motion
    }
  }, [])

  function togglePause() {
    const next = !pausedRef.current
    pausedRef.current = next
    setPaused(next)
    if (next) {
      document.documentElement.dataset.motion = 'paused'
    } else {
      delete document.documentElement.dataset.motion
      resumeRef.current()
    }
  }

  const shown = (at: number) => step >= at
  const typing = step === 1 || step === 4

  return (
    <div className="w-full max-w-md">
    <div
      ref={rootRef}
      className="relative w-full max-w-md rounded-[2rem] border border-white/70 bg-white/80 p-2 shadow-[0_30px_80px_-30px_rgba(15,80,75,0.45)] ring-1 ring-stone-900/5 backdrop-blur-xl"
      role="img"
      aria-label="Ejemplo ficticio de una sesión en Serenia: la persona cuenta que duerme mal, Serenia responde con empatía, le propone el cuestionario GAD-7 y guarda un resumen pendiente de revisión profesional."
    >
      <div className="overflow-hidden rounded-[1.6rem] bg-gradient-to-b from-stone-50 to-white">
        <div className="flex items-center gap-3 border-b border-stone-200/70 px-5 py-3.5">
          <span aria-hidden className="landing-orb-mini size-8 rounded-full" />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-stone-800">Serenia</p>
            <p className="text-xs text-stone-500">Sesión de hoy · 25 min</p>
          </div>
          <span className="ml-auto rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-stone-500">
            Ejemplo
          </span>
        </div>

        <div
          aria-hidden
          className={`chat-demo flex [mask-image:linear-gradient(to_bottom,transparent,black_2.5rem)] h-[25rem] flex-col justify-end gap-2.5 overflow-hidden px-4 pb-4 pt-6 transition-opacity duration-500 sm:h-[26rem] ${fading ? 'opacity-0' : 'opacity-100'}`}
        >
          <Bubble from="user" shown={shown(0)}>
            Llevo unas semanas durmiendo mal y con un nudo en el estómago casi todo el día.
          </Bubble>
          <Bubble from="serenia" shown={shown(2)}>
            Gracias por contármelo. Suena agotador llevarlo tantos días. ¿Hay algún momento en que lo notes más?
          </Bubble>
          <Bubble from="user" shown={shown(3)}>
            Por las noches, cuando pienso en el trabajo.
          </Bubble>
          <Bubble from="serenia" shown={shown(5)}>
            Si te parece bien, te propongo un cuestionario breve para entender mejor estas dos semanas.
          </Bubble>

          <div className={`chat-item ${shown(6) ? 'is-shown' : ''} rounded-2xl border border-teal-100 bg-white p-3.5 shadow-sm`}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">GAD-7 · 1 de 7</p>
              <p className="text-[11px] text-stone-500">Últimas 2 semanas</p>
            </div>
            <p className="mt-1.5 text-[13px] font-medium text-stone-800">Sentirse nervioso/a, ansioso/a o muy alterado/a</p>
            <div className="mt-2.5 grid grid-cols-2 gap-1.5">
              {GAD7_OPTIONS.map((option, index) => {
                const selected = index === 1 && shown(7)
                return (
                  <span
                    key={option}
                    className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] leading-tight transition-colors duration-300 ${
                      selected ? 'border-teal-600 bg-teal-600 text-white' : 'border-stone-200 text-stone-600'
                    }`}
                  >
                    {selected && <Check className="size-3 shrink-0" strokeWidth={3} />}
                    {option}
                  </span>
                )
              })}
            </div>
          </div>

          <div className={`chat-item ${shown(8) ? 'is-shown' : ''} flex items-center gap-2 self-center rounded-full bg-stone-800 px-3.5 py-1.5 text-[11px] text-stone-100`}>
            <FileText className="size-3.5" />
            Resumen guardado · pendiente de revisión profesional
          </div>

          <div className={`chat-item ${typing ? 'is-shown' : 'is-collapsed'} flex gap-1 self-start rounded-2xl rounded-bl-md bg-white px-3.5 py-3 shadow-sm ring-1 ring-stone-200/70`}>
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        </div>
      </div>
    </div>
    {animated && (
      <button
        type="button"
        onClick={togglePause}
        aria-pressed={paused}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-white/70 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-teal-700"
      >
        {paused ? <Play aria-hidden className="size-3.5" /> : <Pause aria-hidden className="size-3.5" />}
        {paused ? 'Reanudar animaciones' : 'Pausar animaciones'}
      </button>
    )}
    </div>
  )
}

function Bubble({ from, shown, children }: { from: 'user' | 'serenia'; shown: boolean; children: React.ReactNode }) {
  const base = 'chat-item max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed'
  const tone =
    from === 'user'
      ? 'self-end rounded-br-md bg-teal-700 text-white'
      : 'self-start rounded-bl-md bg-white text-stone-700 shadow-sm ring-1 ring-stone-200/70'
  return <p className={`${base} ${tone} ${shown ? 'is-shown' : ''}`}>{children}</p>
}
