'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { MessageBubble } from './message-bubble'
import { ChatInput } from './chat-input'
import { CrisisBanner } from './crisis-banner'
import { QuestionnaireCard } from './questionnaire-card'
import { getOwnedChatState } from '@/app/app/chat-recovery-actions'
import type { ChatRecovery } from '@/lib/shared/chat/recovery'
import { endSessionAction } from '@/app/app/actions'

interface ActiveQuestionnaire {
  instanceId: string
  status: 'proposed' | 'in_progress' | 'scored'
  definition: { code: string; name: string }
  items: Array<{
    id: string
    order_index: number
    prompt: string
    options_json: unknown
  }>
}

interface ChatViewProps {
  sessionId: string
  initialMessages: UIMessage[]
  expiresAt: Date
  activeQuestionnaire?: ActiveQuestionnaire | null
  initialRecovery?: ChatRecovery | null
}

function minutesRemaining(expiresAt: Date, now = Date.now()): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now) / 60_000))
}

// Walk all parts of all messages and return which close-tool, if any,
// reached output-available. Pure function so the derived state is
// reflected on render without a useState/useEffect round-trip.
function detectServerClose(
  messages: readonly UIMessage[],
): 'none' | 'confirm' | 'crisis' {
  let hit: 'none' | 'confirm' | 'crisis' = 'none'
  for (const message of messages) {
    for (const part of message.parts) {
      if (
        'state' in part &&
        part.state === 'output-available' &&
        (part.type === 'tool-confirm_close_session' ||
          part.type === 'tool-close_session_crisis')
      ) {
        // Crisis wins over confirm — if both show up in the same stream
        // (shouldn't happen, but be defensive), crisis drives the redirect.
        if (part.type === 'tool-close_session_crisis') return 'crisis'
        hit = 'confirm'
      }
    }
  }
  return hit
}

export function ChatView({
  sessionId,
  initialMessages,
  expiresAt,
  activeQuestionnaire,
  initialRecovery = null,
}: ChatViewProps) {
  const router = useRouter()
  const [minsLeft, setMinsLeft] = useState(() => minutesRemaining(expiresAt))
  const isTimeExpired = minsLeft <= 0
  const isEnding = minsLeft > 0 && minsLeft <= 10
  const listRef = useRef<HTMLDivElement>(null)
  const refreshedToolsRef = useRef<Set<string>>(new Set())
  const crisisRedirectRef = useRef(false)

  const [recovery, setRecovery] = useState(initialRecovery)
  const [recoveryError, setRecoveryError] = useState(false)
  const [externallyClosed, setExternallyClosed] = useState(false)
  const [urgentMode, setUrgentMode] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const failedRef = useRef(false)
  const lastAttemptRef = useRef<ChatRecovery | null>(initialRecovery)
  const activeRequestRef = useRef<string | null>(null)
  const cancelledRequestsRef = useRef(new Set<string>())
  const httpStatusRef = useRef<number | null>(null)
  // A newer read, send, retry or urgent transition makes older snapshots obsolete.
  const operationRef = useRef(0)
  const lifecycleRef = useRef({ mounted: false, sessionId })

  useEffect(() => {
    lifecycleRef.current = { mounted: true, sessionId }
    operationRef.current += 1
    return () => {
      lifecycleRef.current.mounted = false
      operationRef.current += 1
    }
  }, [sessionId])

  function isCurrentOperation(operation: number) {
    return operationRef.current === operation && lifecycleRef.current.mounted && lifecycleRef.current.sessionId === sessionId
  }

  const trackedFetch = useCallback(async (url: RequestInfo | URL, init?: RequestInit) => {
    const response = await fetch(url, init)
    httpStatusRef.current = response.status
    return response
  }, [])

  const { messages, sendMessage, status, error, stop, setMessages, clearError } = useChat({
    id: sessionId,
    messages: initialMessages,
    onError: () => { failedRef.current = true; if (lastAttemptRef.current) setRecovery({ ...lastAttemptRef.current, canRetry: false }) },
    // The installed SDK constructor stores fetch; it runs only when sending.
    // eslint-disable-next-line react-hooks/refs
    transport: new DefaultChatTransport({
      api: '/api/chat',
      fetch: trackedFetch,
      body: { sessionId },
      prepareSendMessagesRequest: ({ messages, body }) => {
        const message = [...messages].reverse().find(message => message.role === 'user')
        const requestId = typeof body?.requestId === 'string' ? body.requestId : message?.id
        const text = typeof body?.retryText === 'string' ? body.retryText : message?.parts.filter(part => part.type === 'text').map(part => part.text).join('')
        return { body: { sessionId, requestId, messages: requestId && typeof text === 'string' ? [{ id: requestId, role: 'user', parts: [{ type: 'text', text }] }] : [] } }
      },
    }),
  })

  // `closeSignal` is derived from `messages` on every render: 'confirm'
  // for a non-crisis close (confirm_close_session reached
  // output-available) and 'crisis' for close_session_crisis. This is how
  // the client knows the server closed the session before the next POST
  // would 409.
  const closeSignal = detectServerClose(messages)
  const isClosed = closeSignal !== 'none' || externallyClosed
  const isExpired = isTimeExpired || isClosed

  async function rehydrate(allowLocalFallback = true) {
    const operation = ++operationRef.current
    const localFallback = allowLocalFallback && status === 'error' && lastAttemptRef.current
      ? { ...lastAttemptRef.current, canRetry: httpStatusRef.current !== 422 } : null
    try {
      const state = await getOwnedChatState(sessionId)
      if (!isCurrentOperation(operation)) return null
      setRecoveryError(false)
      if (state.closed) {
        setExternallyClosed(true); setRecovery(null); setUrgentMode(false)
        router.refresh()
        return operation
      }
      setRecovery(state.recovery ?? localFallback)
      setMessages(state.messages)
      return operation
    } catch {
      if (isCurrentOperation(operation)) setRecoveryError(true)
      return null
    }
  }

  useEffect(() => {
    if (status === 'error') {
      if (error?.message.includes('onboardingRequired')) router.replace('/onboarding')
      // An interrupted/closed turn is never inferred to be retryable.
      const timer = setTimeout(() => void rehydrate(), 0)
      return () => clearTimeout(timer)
    }
    // Rehydrate at the transport boundary; do not refetch on every message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, sessionId])

  useEffect(() => {
    if (!recovery || recovery.status !== 'generating' || recovery.canRetry) return
    const delay = Math.max(1000, new Date(recovery.leaseUntil).getTime() - Date.now() + 100)
    const timer = setTimeout(() => void rehydrate(), delay)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recovery])

  async function retry() {
    if (!recovery?.canRetry || retrying) return
    const operation = ++operationRef.current
    const attempt = recovery
    activeRequestRef.current = attempt.requestId
    lastAttemptRef.current = attempt
    failedRef.current = false; setRetrying(true); clearError()
    try {
      const existing = messages.find(message => message.id === attempt.userMessageId || message.id === attempt.requestId)
      await sendMessage(existing ? { text: attempt.text, messageId: existing.id } : undefined, { body: { requestId: attempt.requestId, retryText: attempt.text } })
      if (isCurrentOperation(operation) && !failedRef.current && !cancelledRequestsRef.current.has(attempt.requestId)) {
        const snapshotOperation = await rehydrate(false)
        if (snapshotOperation !== null && isCurrentOperation(snapshotOperation)) setUrgentMode(false)
      }
    } finally {
      if (lifecycleRef.current.mounted && lifecycleRef.current.sessionId === sessionId && activeRequestRef.current === attempt.requestId) setRetrying(false)
    }
  }

  async function send(text: string): Promise<boolean> {
    if (recovery && !urgentMode) return false
    const operation = ++operationRef.current
    failedRef.current = false; clearError()
    const requestId = crypto.randomUUID()
    activeRequestRef.current = requestId
    lastAttemptRef.current = { requestId, userMessageId: requestId, text, status: 'failed', canRetry: true, leaseUntil: new Date().toISOString() }
    await sendMessage({ id: requestId, role: 'user', parts: [{ type: 'text', text }] })
    const completed = isCurrentOperation(operation) && !failedRef.current && !cancelledRequestsRef.current.has(requestId)
    if (completed) { setRecovery(null); setUrgentMode(false) }
    return completed
  }

  useEffect(() => {
    if (status !== 'ready') return
    for (const message of messages) {
      for (const part of message.parts) {
        // Plan 4: questionnaire proposal refreshes the server component
        // so the card renders from SSR state.
        if (
          part.type === 'tool-propose_questionnaire' &&
          'state' in part &&
          part.state === 'output-available'
        ) {
          const key = `${message.id}:${'toolCallId' in part ? part.toolCallId : ''}`
          if (!refreshedToolsRef.current.has(key)) {
            refreshedToolsRef.current.add(key)
            router.refresh()
          }
        }
      }
    }
  }, [messages, status, router])

  // Plan 4.2: on crisis close, push the patient to /app after a short
  // beat so the home page's red Línea 024 banner
  // (app/app/page.tsx — lastClosed.closureReason === 'crisis_detected')
  // is the first thing they see. Non-crisis confirm stays put — the
  // end-of-session banner below has a link to /app when the patient is
  // ready.
  useEffect(() => {
    if (closeSignal !== 'crisis') return
    if (crisisRedirectRef.current) return
    crisisRedirectRef.current = true
    const timer = setTimeout(() => {
      router.push('/app')
    }, 1800)
    return () => clearTimeout(timer)
  }, [closeSignal, router])

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
        <>
          {activeQuestionnaire &&
            activeQuestionnaire.status !== 'scored' && (
              <QuestionnaireCard
                key={activeQuestionnaire.instanceId}
                instanceId={activeQuestionnaire.instanceId}
                definition={activeQuestionnaire.definition}
                items={activeQuestionnaire.items}
                onSubmitted={() => {
                  // A scored result is durable. If another turn is pending,
                  // its notice is consumed by the next admitted turn.
                  if (!recovery && status === 'ready') void send('He completado el cuestionario.')
                  router.refresh()
                }}
              />
            )}
          {(recovery || status === 'error' || status === 'submitted' || status === 'streaming') && <div className="space-y-2 border-t p-3 text-sm">
            <p role="status" aria-live="polite">{recovery ? recovery.canRetry ? 'Tu texto se conserva. Puedes reintentar el mismo turno.' : recovery.status === 'generating' ? 'La respuesta sigue pendiente. Puedes escribir mientras esperas.' : 'No se puede reintentar este turno. Puedes recargar o enviar una señal urgente nueva.' : status === 'error' ? 'No se completó la respuesta. Tu texto se conserva; estamos comprobando el turno guardado.' : 'Esperando respuesta. Puedes seguir escribiendo.'}</p>
            {recovery?.canRetry && !urgentMode && <button type="button" disabled={retrying || status === 'submitted' || status === 'streaming'} onClick={() => void retry()} className="underline">Reintentar el mismo mensaje</button>}
            <button type="button" onClick={() => { operationRef.current += 1; if (activeRequestRef.current) cancelledRequestsRef.current.add(activeRequestRef.current); void stop(); setUrgentMode(true) }} className="block underline">Interrumpir espera y enviar una señal urgente</button>
            <button type="button" onClick={() => void rehydrate()} className="block underline">Comprobar estado guardado</button>
            {recoveryError && <p role="alert">No se pudo comprobar el estado. Conserva tu texto y vuelve a comprobarlo o recarga.</p>}
          </div>}
          {urgentMode && <p role="status" className="px-3 text-sm">Escribe una señal nueva de peligro inmediato para ti o para otra persona. Solo una señal de seguridad puede sustituir el turno pendiente; un mensaje ordinario seguirá esperando. Si necesitas atención inmediata, llama al 112 o al 024.</p>}
          <ChatInput
            status={recovery && !urgentMode ? 'submitted' : status}
            disabled={isExpired}
            onSend={send}
          />
        </>
      )}

      <CrisisBanner />
    </div>
  )
}
