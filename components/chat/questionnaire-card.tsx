'use client'

import { useState } from 'react'
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

  if (submitted) {
    return (
      <Card className="mx-3 mb-2 border-emerald-200 bg-emerald-50">
        <CardContent role="status" className="py-3 text-sm text-emerald-900">
          Enviado. Serenia tiene tu resultado.
        </CardContent>
      </Card>
    )
  }

  if (!current) return null

  const options = parseOptions(current.options_json)
  const selected = answers[current.order_index]

  return (
    <Card className="mx-3 mb-2" size="sm">
      <CardHeader>
        <CardTitle>{header.title}</CardTitle>
        <p className="text-xs text-muted-foreground">{header.duration}</p>
        <p className="text-xs text-muted-foreground">
          Pregunta {currentIdx + 1} de {visibleItems.length}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{current.prompt}</p>
        <div role="radiogroup" aria-label={current.prompt} className="flex flex-col gap-2">
          {options.map((opt) => {
            const isSelected = selected?.value === opt.value
            return (
              <label
                key={opt.value}
                className={`rounded border px-3 py-2 text-left text-sm transition ${
                  isSelected
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                }`}
              >
                <input type="radio" name={`question-${instanceId}-${current.order_index}`} value={opt.value} checked={isSelected} disabled={submitting} onChange={() => selectOption(opt)} className="mr-2" />
                {opt.label}
              </label>
            )
          })}
        </div>
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={handleNext}
            disabled={!selected || submitting}
          >
            {isLast ? (submitting ? 'Enviando…' : 'Enviar') : 'Siguiente'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
