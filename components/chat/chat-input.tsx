'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import type { ChatStatus } from 'ai'

interface ChatInputProps {
  onSend: (text: string) => void | boolean | Promise<void | boolean>
  status: ChatStatus
  disabled?: boolean
  draft?: { value: string; onChange: Dispatch<SetStateAction<string>> }
}

export function ChatInput({ onSend, status, disabled = false, draft }: ChatInputProps) {
  const [localText, setLocalText] = useState('')
  const text = draft?.value ?? localText
  const setText = draft?.onChange ?? setLocalText
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(false)

  const isDisabled = disabled
  const sendDisabled = isDisabled || sending || (status !== 'ready' && status !== 'error')

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }

  async function submit() {
    const value = text.trim()
    if (!value || sendDisabled) return
    setSending(true); setError(false)
    try {
      const sent = await onSend(value)
      if (sent !== false) setText(current => current === value || current.trim() === value ? '' : current)
    } catch { setError(true) }
    finally { setSending(false) }
  }

  return (
    <div className="flex gap-2 border-t border-slate-200 bg-white p-3">
      <Textarea
        aria-label="Mensaje para Serenia"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Escribe lo que quieras compartir..."
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        className="max-h-32 min-h-[2.5rem] resize-none"
      />
      {error && <p role="alert">No se pudo enviar. Tu texto sigue aquí.</p>}
      <Button
        type="button"
        onClick={() => void submit()}
        disabled={sendDisabled || !text.trim()}
        size="sm"
        className="self-end"
      >
        Enviar
      </Button>
    </div>
  )
}
