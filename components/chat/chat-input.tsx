'use client'

import { useRef } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import type { ChatStatus } from 'ai'

interface ChatInputProps {
  onSend: (text: string) => void
  status: ChatStatus
  disabled?: boolean
}

export function ChatInput({ onSend, status, disabled = false }: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const isDisabled = disabled || status !== 'ready'

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const text = ref.current?.value.trim()
    if (!text || isDisabled) return
    onSend(text)
    if (ref.current) ref.current.value = ''
  }

  return (
    <div className="flex gap-2 border-t border-slate-200 bg-white p-3">
      <Textarea
        ref={ref}
        placeholder="Escribe lo que quieras compartir..."
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        className="max-h-32 min-h-[2.5rem] resize-none"
      />
      <Button
        type="button"
        onClick={submit}
        disabled={isDisabled}
        size="sm"
        className="self-end"
      >
        Enviar
      </Button>
    </div>
  )
}
