'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import type { ChatStatus } from 'ai'
import { ArrowUp } from 'lucide-react'

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
    // The active send owns this text; typing now creates a separate draft.
    setText('')
    try {
      const sent = await onSend(value)
      if (sent === false) setText(current => current || value)
    } catch { setText(current => current || value); setError(true) }
    finally { setSending(false) }
  }

  return (
    <div>
      <div className="flex items-end gap-2 rounded-2xl border border-stone-300 bg-white p-2 shadow-[0_1px_3px_rgba(28,25,23,0.06)] transition-colors focus-within:border-teal-600 focus-within:ring-3 focus-within:ring-teal-600/35">
        <Textarea
          aria-label="Mensaje para Serenia"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Escribe lo que quieras compartir…"
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          className="max-h-40 min-h-11 resize-none border-0 bg-transparent px-2 py-2.5 text-base shadow-none focus-visible:ring-0 md:text-[15px] dark:bg-transparent"
        />
        <Button
          type="button"
          onClick={() => void submit()}
          disabled={sendDisabled || !text.trim()}
          className="size-11 shrink-0 rounded-full p-0 shadow-md shadow-teal-900/15 sm:w-auto sm:px-4"
        >
          <ArrowUp aria-hidden className="size-5 sm:size-4" />
          <span className="sr-only sm:not-sr-only">Enviar</span>
        </Button>
      </div>
      {error && <p role="alert" className="mt-2 px-2 text-sm text-red-800">No se pudo enviar. Tu texto sigue aquí.</p>}
    </div>
  )
}
