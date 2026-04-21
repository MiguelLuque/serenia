'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { MessageBubble } from './message-bubble'
import { ChatInput } from './chat-input'
import { CrisisBanner } from './crisis-banner'

interface ChatViewProps {
  sessionId: string
  initialMessages: UIMessage[]
  expiresAt: Date
}

export function ChatView({ sessionId, initialMessages, expiresAt }: ChatViewProps) {
  const [isExpired, setIsExpired] = useState(() => new Date() >= expiresAt)
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
      if (new Date() >= expiresAt) {
        setIsExpired(true)
      }
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
