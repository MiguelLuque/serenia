'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getQuestionnaireCardHeader } from '@/lib/shared/questionnaires/card-metadata'

interface Option {
  value: number
  label: string
}

interface Item {
  id: string
  order_index: number
  prompt: string
  options_json: unknown
}

interface Definition {
  code: string
  name: string
}

interface QuestionnaireCardProps {
  instanceId: string
  definition: Definition
  items: Item[]
  /**
   * Called once after the answers POST succeeds. Used by the parent to push a
   * synthetic user turn into the chat so the assistant acknowledges the
   * result (see `buildQuestionnaireResultNotice` in app/api/chat/route.ts).
   *
   * Without this, the stream stays idle and the ASQ acute-risk protocol
   * (Línea 024 + close_session_crisis) is unreachable.
   */
  onSubmitted?: () => void
}

function parseOptions(raw: unknown): Option[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (o): o is Option =>
      typeof o === 'object' &&
      o !== null &&
      typeof (o as { value?: unknown }).value === 'number' &&
      typeof (o as { label?: unknown }).label === 'string',
  )
}

export function QuestionnaireCard(props: QuestionnaireCardProps) {
  return <QuestionnaireInstance key={props.instanceId} {...props} />
}

function QuestionnaireInstance({
  instanceId,
  definition,
  items,
  onSubmitted,
}: QuestionnaireCardProps) {
  const router = useRouter()
  const header = getQuestionnaireCardHeader(definition.code, definition.name)
  const [answers, setAnswers] = useState<Record<number, Option>>({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const promptRef = useRef<HTMLParagraphElement>(null)
  const advancedRef = useRef(false)

  const sorted = [...items].sort((a, b) => a.order_index - b.order_index)
  const isCssrs = definition.code === 'CSSRS'
  const isAsq = definition.code === 'ASQ'
  // ASQ item 5 is conditional: only ask if any of items 1-4 is positive.
  const visibleItems = isAsq
    ? sorted.filter((item) => {
        if (item.order_index < 5) return true
        const anyPositive = [1, 2, 3, 4].some(
          (o) => (answers[o]?.value ?? 0) === 1,
        )
        return anyPositive
      })
    : isCssrs
      ? sorted.filter(item => !([3, 4, 5].includes(item.order_index) && answers[2]?.value === 0) && !(item.order_index === 7 && answers[6]?.value === 0))
      : sorted

  const current = visibleItems[currentIdx]
  const isLast = currentIdx === visibleItems.length - 1

  function selectOption(option: Option) {
    if (!current) return
    setAnswers((prev) => ({ ...prev, [current.order_index]: option }))
  }

  async function handleNext() {
    if (!current) return
    if (!answers[current.order_index]) return
    if (!isLast) {
      advancedRef.current = true
      setCurrentIdx((i) => i + 1)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const payload = visibleItems.map((item) => {
        const a = answers[item.order_index]
        return {
          itemOrder: item.order_index,
          valueNumeric: a.value,
          valueRaw: a.label,
        }
      })
      const res = await fetch(
        `/api/questionnaires/${instanceId}/answers`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: payload }),
        },
      )
      if (!res.ok) throw new Error('No se pudieron guardar las respuestas. Puedes reintentar sin perderlas.')
      setSubmitted(true)
      // Notify the parent after durable scoring. It sends immediately only
      // when no turn is outstanding; otherwise the next admitted turn sees it.
      onSubmitted?.()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error enviando respuestas')
      setSubmitting(false)
    }
  }

  // Al pasar de pregunta, el foco va al nuevo enunciado (no en la primera).
  useEffect(() => {
    if (!advancedRef.current) return
    advancedRef.current = false
    promptRef.current?.focus()
  }, [currentIdx])

  if (submitted) {
    return (
      <Card className="rounded-2xl border border-teal-200 bg-teal-50 ring-0">
        <CardContent role="status" className="py-1 text-sm text-teal-900">
          Enviado. Serenia tiene tu resultado.
        </CardContent>
      </Card>
    )
  }

  if (!current) return null

  const options = parseOptions(current.options_json)
  const selected = answers[current.order_index]

  const promptId = `question-prompt-${instanceId}-${current.order_index}`
  const progress = Math.round(((currentIdx + 1) / visibleItems.length) * 100)

  return (
    <Card className="max-h-[55dvh] overflow-y-auto rounded-2xl border border-stone-200/80 shadow-[0_8px_30px_-12px_rgba(15,80,75,0.25)] ring-0" size="sm">
      <CardHeader className="gap-1.5">
        <CardTitle className="text-[15px]">{header.title}</CardTitle>
        <p className="text-xs text-muted-foreground">{header.duration}</p>
        <div className="mt-1 flex items-center gap-3">
          <div aria-hidden className="h-1 flex-1 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
          </div>
          <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
            Pregunta {currentIdx + 1} de {visibleItems.length}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p id={promptId} ref={promptRef} tabIndex={-1} className="text-[15px] font-medium text-stone-900 outline-none">{current.prompt}</p>
        <div role="radiogroup" aria-labelledby={promptId} className="flex flex-col gap-2">
          {options.map((opt) => {
            const isSelected = selected?.value === opt.value
            return (
              <label
                key={opt.value}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2 text-left text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-600 ${
                  isSelected
                    ? 'border-teal-700 bg-teal-50 text-teal-950'
                    : 'border-stone-200 bg-white text-stone-800 hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                <input type="radio" name={`question-${instanceId}-${current.order_index}`} value={opt.value} checked={isSelected} disabled={submitting} onChange={() => selectOption(opt)} className="size-4 shrink-0 accent-teal-700" />
                {opt.label}
              </label>
            )
          })}
        </div>
        {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleNext}
            disabled={!selected || submitting}
            className="h-10 rounded-full px-5"
          >
            {isLast ? (submitting ? 'Enviando…' : 'Enviar') : 'Siguiente'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
