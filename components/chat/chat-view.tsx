'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { MessageBubble } from './message-bubble'
import { ChatInput } from './chat-input'
import { CrisisBanner } from './crisis-banner'
import { endSessionAction } from '@/app/app/actions'

interface ChatViewProps {
  sessionId: string
  initialMessages: UIMessage[]
  expiresAt: Date
}

function minutesRemaining(expiresAt: Date, now = Date.now()): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now) / 60_000))
}

export function ChatView({ sessionId, initialMessages, expiresAt }: ChatViewProps) {
  const [minsLeft, setMinsLeft] = useState(() => minutesRemaining(expiresAt))
  const isExpired = minsLeft <= 0
  const isEnding = minsLeft > 0 && minsLeft <= 10
  const listRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status } = useChat({
    id: sessionId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { sessionId },
    }),
  })

  useEffect(() => {
    if (isExpired) return
    const interval = setInterval(() => {
      setMinsLeft(minutesRemaining(expiresAt))
    }, 30_000)
    return () => clearInterval(interval)
  }, [expiresAt, isExpired])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, status])

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div
        className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-xs ${
          isEnding
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : 'border-slate-200 bg-slate-50 text-slate-500'
        }`}
      >
        <span>
          {isExpired
            ? 'La sesión ha terminado.'
            : `${minsLeft} min restantes`}
        </span>
        <div className="flex items-center gap-3">
          {isEnding && !isExpired && (
            <span className="font-medium">Queda poco tiempo.</span>
          )}
          {!isExpired && (
            <form action={endSessionAction}>
              <input type="hidden" name="sessionId" value={sessionId} />
              <button
                type="submit"
                className="rounded border border-slate-300 bg-white px-2 py-0.5 font-medium text-slate-700 hover:bg-slate-100"
              >
                Terminar sesión
              </button>
            </form>
          )}
        </div>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-slate-500">
            Empieza la conversación cuando estés lista.
          </p>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
      </div>

      {isExpired ? (
        <div className="border-t border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
          <p>La sesión ha terminado.{' '}
            <Link href="/app" className="font-medium text-slate-900 underline">
              Vuelve al inicio.
            </Link>
          </p>
        </div>
      ) : (
        <ChatInput
          status={status}
          disabled={isExpired}
          onSend={(text) => {
            void sendMessage({ text })
          }}
        />
      )}

      <CrisisBanner />
    </div>
  )
}
