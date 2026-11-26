'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { latestSafetyPromptRequestId } from '@/lib/shared/chat/safety-prompt'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { MessageBubble, TypingBubble } from './message-bubble'
import { BreathingExercise } from './breathing-exercise'
import { BrandOrb } from '@/components/brand/brand-mark'
import { ChatInput } from './chat-input'
import { CrisisBanner } from './crisis-banner'
import { QuestionnaireCard } from './questionnaire-card'
import { closeOwnedSessionFromView, getOwnedChatState, resolveOwnedChatTurn } from '@/app/app/chat-recovery-actions'
import type { ChatRecovery } from '@/lib/shared/chat/recovery'
import { UrgentHelpText } from '@/components/shared/urgent-help'

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
  serverNow?: Date
  activeQuestionnaire?: ActiveQuestionnaire | null
  initialRecovery?: ChatRecovery | null
  initialClosed?: boolean
}

interface LocalSubmission {
  requestId: string
  userMessageId?: string
  text: string
  safetyPromptRequestId?: string
  urgent: boolean
  state: 'sending' | 'uncertain' | 'interrupted'
}


const CLOSE_ACTION_TIMEOUT_MS = 15_000
const LOCAL_TEXT_COPY_WARNING = 'El texto pendiente solo sigue en esta pantalla. Cópialo antes de recargar o salir.'

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
      if (part.type === 'data-session-closed' && typeof part.data === 'object' && part.data !== null && 'closed' in part.data && part.data.closed === true && 'reason' in part.data) {
        if (part.data.reason === 'crisis_detected') return 'crisis'
        if (part.data.reason === 'time_limit' || part.data.reason === 'user_request' || part.data.reason === 'inactivity') hit = 'confirm'
      }
      if (
        'state' in part &&
        part.state === 'output-available' &&
        'output' in part && part.output !== null &&
        typeof part.output === 'object' &&
        'closed' in part.output && part.output.closed === true &&
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

function hasVisibleAssistantResponseAfter(messages: readonly UIMessage[], userMessageId: string): boolean {
  const userIndex = messages.findIndex(message => message.id === userMessageId && message.role === 'user')
  if (userIndex < 0) return false
  for (const message of messages.slice(userIndex + 1)) {
    if (message.role === 'user') return false
    if (message.role === 'assistant' && message.parts.some(part => part.type === 'text' && part.text.trim().length > 0)) return true
  }
  return false
}

const primaryActionClass = 'inline-flex min-h-9 items-center rounded-full border border-teal-700 bg-white px-3.5 font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-60'
const secondaryActionClass = 'inline-flex min-h-9 items-center rounded-full px-3 font-medium text-stone-700 underline underline-offset-2 hover:bg-white/70 disabled:opacity-60'

export function ChatView({
  sessionId,
  initialMessages,
  expiresAt,
  serverNow,
  activeQuestionnaire,
  initialRecovery = null,
  initialClosed = false,
}: ChatViewProps) {
  const router = useRouter()
  const [clock, setClock] = useState(() => ({ serverNow: serverNow?.getTime() ?? Date.now(), expiresAt: expiresAt.getTime(), monotonic: performance.now() }))
  const [minsLeft, setMinsLeft] = useState(() => minutesRemaining(expiresAt, serverNow?.getTime() ?? Date.now()))
  const [draft, setDraft] = useState('')
  const [closing, setClosing] = useState(false)
  const [closeUncertain, setCloseUncertain] = useState(false)
  const [closeConfirmation, setCloseConfirmation] = useState<{ requestId: string; attempt: number } | null>(null)
  const [confirmingEnd, setConfirmingEnd] = useState(false)
  const endButtonRef = useRef<HTMLButtonElement>(null)
  const [closeNotice, setCloseNotice] = useState('')
  const isTimeExpired = minsLeft <= 0
  const isEnding = minsLeft > 0 && minsLeft <= 10
  const listRef = useRef<HTMLDivElement>(null)
  // Mensajes ya presentes al cargar: no se animan, solo los nuevos.
  const [initialMessageIds] = useState(() => new Set(initialMessages.map(message => message.id)))
  const refreshedToolsRef = useRef<Set<string>>(new Set())
  const crisisRedirectRef = useRef(false)

  const [recovery, setRecovery] = useState(initialRecovery)
  const [recoveryError, setRecoveryError] = useState(false)
  const [recoveryChecking, setRecoveryChecking] = useState(false)
  const [resolvingTurn, setResolvingTurn] = useState(false)
  const resolvingRef = useRef(false)
  const [resolutionNotice, setResolutionNotice] = useState('')
  const [recoveryUnconfirmed, setRecoveryUnconfirmed] = useState(false)
  const [receiptCompleted, setReceiptCompleted] = useState(false)
  const [externallyClosed, setExternallyClosed] = useState(initialClosed)
  const [urgentMode, setUrgentMode] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [localSubmissions, setLocalSubmissions] = useState<LocalSubmission[]>([])
  const [copiedSubmissionIds, setCopiedSubmissionIds] = useState<string[]>([])
  const failedRef = useRef(false)
  const lastAttemptRef = useRef<ChatRecovery | null>(initialRecovery)
  const completedRecoveryRef = useRef<ChatRecovery | null>(null)
  const closeUncertainRef = useRef(false)
  const closeActionPendingRef = useRef<string | null>(null)
  const activeRequestRef = useRef<string | null>(null)
  const cancelledRequestsRef = useRef(new Set<number>())
  const transportSequenceRef = useRef(0)
  const activeTransportRef = useRef<number | null>(null)
  const queuedTransportsRef = useRef<number[]>([])
  const retryingTransportRef = useRef<number | null>(null)
  const localSubmissionsRef = useRef<LocalSubmission[]>([])
  const deferredClosedReadRef = useRef<string | null>(null)
  const needsFreshClosedReadRef = useRef(false)
  const httpStatusRef = useRef<number | null>(null)
  // Reads order snapshots without invalidating a valid transport completion.
  const transitionRef = useRef(0)
  const recoveryReadRef = useRef(0)
  // A failed or interrupted turn may have committed a questionnaire without
  // returning its tool event. Reconcile the server-rendered card on recovery;
  // keep the intent while a generating turn may still finish.
  const questionnaireRefreshPendingRef = useRef(initialRecovery !== null)
  const generatingRefreshRef = useRef<string | null>(null)
  const lifecycleRef = useRef({ mounted: false, sessionId })

  useEffect(() => {
    lifecycleRef.current = { mounted: true, sessionId }
    transitionRef.current += 1
    return () => {
      lifecycleRef.current.mounted = false
      transitionRef.current += 1
    }
  }, [sessionId])

  function isCurrentTransition(operation: number) {
    return transitionRef.current === operation && lifecycleRef.current.mounted && lifecycleRef.current.sessionId === sessionId
  }

  function updateLocalSubmission(requestId: string, submission: LocalSubmission | null) {
    const current = localSubmissionsRef.current
    const next = submission === null
      ? current.filter(item => item.requestId !== requestId)
      : current.some(item => item.requestId === requestId)
        ? current.map(item => item.requestId === requestId ? submission : item)
        : [...current, submission]
    localSubmissionsRef.current = next
    setLocalSubmissions(next)
  }

  function beginTransport(requestId: string) {
    const transport = ++transportSequenceRef.current
    activeTransportRef.current = transport
    activeRequestRef.current = requestId
    queuedTransportsRef.current.push(transport)
    // A response status belongs to one transport only. A network error before
    // response headers leaves this null instead of inheriting an earlier 422.
    httpStatusRef.current = null
    return transport
  }

  function flushDeferredClosedRead() {
    if (!needsFreshClosedReadRef.current || queuedTransportsRef.current.length > 0 || activeTransportRef.current !== null) return
    const requestId = deferredClosedReadRef.current
    needsFreshClosedReadRef.current = false
    deferredClosedReadRef.current = null
    setTimeout(() => {
      if (queuedTransportsRef.current.length === 0 && activeTransportRef.current === null) void rehydrate(false, requestId ? { requestId } : undefined)
      else {
        needsFreshClosedReadRef.current = true
        deferredClosedReadRef.current = requestId
      }
    }, 0)
  }

  function endTransport(transport: number) {
    queuedTransportsRef.current = queuedTransportsRef.current.filter(item => item !== transport)
    cancelledRequestsRef.current.delete(transport)
    if (activeTransportRef.current === transport) {
      activeTransportRef.current = null
      activeRequestRef.current = null
    }
    if (queuedTransportsRef.current.length === 0) flushDeferredClosedRead()
  }

  const trackedFetch = useCallback(async (url: RequestInfo | URL, init?: RequestInit) => {
    const transport = queuedTransportsRef.current.shift()
    const response = await fetch(url, init)
    if (transport !== undefined && activeTransportRef.current === transport) httpStatusRef.current = response.status
    return response
  }, [])

  const { messages, sendMessage, status, error, stop, setMessages, clearError } = useChat({
    id: sessionId,
    messages: initialMessages,
    onError: () => {
      failedRef.current = true
      questionnaireRefreshPendingRef.current = true
      generatingRefreshRef.current = null
      setRecoveryChecking(true)
      const requestId = activeRequestRef.current
      const submission = requestId ? localSubmissionsRef.current.find(item => item.requestId === requestId) : null
      if (submission) updateLocalSubmission(requestId!, { ...submission, state: 'uncertain' })
      if (lastAttemptRef.current) setRecovery({ ...lastAttemptRef.current, canRetry: false })
    },
    // The installed SDK constructor stores fetch; it runs only when sending.
    // Its callback reads transport refs only after a user action, not during render.
    // eslint-disable-next-line react-hooks/refs
    transport: new DefaultChatTransport({
      api: '/api/chat',
      fetch: trackedFetch,
      body: { sessionId },
      prepareSendMessagesRequest: ({ messages, body }) => {
        const message = [...messages].reverse().find(message => message.role === 'user')
        const requestId = typeof body?.requestId === 'string' ? body.requestId : message?.id
        const text = typeof body?.retryText === 'string' ? body.retryText : message?.parts.filter(part => part.type === 'text').map(part => part.text).join('')
        const safetyPromptRequestId = typeof body?.safetyPromptRequestId === 'string' ? body.safetyPromptRequestId : undefined
        return { body: { sessionId, requestId, safetyPromptRequestId, messages: requestId && typeof text === 'string' ? [{ id: requestId, role: 'user', parts: [{ type: 'text', text }] }] : [] } }
      },
    }),
  })

  // `closeSignal` also recognizes persisted legacy crisis-close payloads;
  // the current generative route cannot invoke a crisis-close tool.
  const closeSignal = detectServerClose(messages)
  const isClosed = closeSignal !== 'none' || externallyClosed
  const isExpired = isTimeExpired || isClosed

  async function rehydrate(allowLocalFallback = true, options?: { completedFallback?: ChatRecovery; ignoreCompletedFallback?: boolean; requestId?: string; isValid?: () => boolean }) {
    const operation = transitionRef.current
    const read = ++recoveryReadRef.current
    const transportWasActive = activeTransportRef.current !== null
    const confirmedFallback = options?.completedFallback ?? (options?.ignoreCompletedFallback ? null : completedRecoveryRef.current)
    const requestId = options?.requestId ?? (status === 'error' || recovery !== null ? lastAttemptRef.current?.requestId : undefined)
    const currentAttempt = lastAttemptRef.current
    const localFallback = confirmedFallback ?? (allowLocalFallback && status === 'error' && currentAttempt &&
      (requestId === undefined || currentAttempt.requestId === requestId)
      ? { ...currentAttempt, canRetry: httpStatusRef.current !== 422 } : null)
    try {
      const state = await getOwnedChatState(sessionId, requestId)
      if (options?.isValid?.() === false || recoveryReadRef.current !== read || !lifecycleRef.current.mounted || lifecycleRef.current.sessionId !== sessionId) return null
      if (!isCurrentTransition(operation)) {
        if (state.closed && transportWasActive) {
          completedRecoveryRef.current = null
          setRecoveryUnconfirmed(false)
          setReceiptCompleted(false)
          questionnaireRefreshPendingRef.current = false
          generatingRefreshRef.current = null
          setRecoveryChecking(false)
          setExternallyClosed(true)
          setRecovery(null)
          setUrgentMode(false)
          needsFreshClosedReadRef.current = true
          deferredClosedReadRef.current = requestId ?? activeRequestRef.current ?? lastAttemptRef.current?.requestId ?? null
          flushDeferredClosedRead()
        }
        return null
      }
      if (options?.requestId === undefined && requestId !== undefined && lastAttemptRef.current?.requestId !== requestId) return null
      setRecoveryError(false)
      const completedResponseVisible = requestId !== undefined && state.receipt === 'completed' && state.receiptUserMessageId !== undefined && hasVisibleAssistantResponseAfter(state.messages, state.receiptUserMessageId)
      if (requestId && state.receiptUserMessageId) {
        const localSubmission = localSubmissionsRef.current.find(item => item.requestId === requestId)
        if (localSubmission) {
          updateLocalSubmission(requestId, completedResponseVisible ? null : {
            ...localSubmission,
            userMessageId: state.receiptUserMessageId,
            state: state.receipt === 'interrupted' ? 'interrupted' : localSubmission.state,
          })
        }
      }
      const interruptedReceipt = requestId !== undefined && state.receipt === 'interrupted'
      if (state.closed) {
        closeUncertainRef.current = false
        setCloseUncertain(false)
        setCloseConfirmation(null)
        setCloseNotice('')
        completedRecoveryRef.current = null
        setRecoveryUnconfirmed(false)
        setReceiptCompleted(false)
        questionnaireRefreshPendingRef.current = false
        generatingRefreshRef.current = null
        // A closed snapshot is authoritative for session status, but may have
        // been read before the currently dispatched message was persisted.
        // Keep the optimistic transcript and local copy until its receipt is
        // known; incrementing the transition here would make that receipt stale.
        const transportActive = transportWasActive || queuedTransportsRef.current.length > 0
        if (!transportActive) {
          transitionRef.current += 1
          setMessages(state.messages)
        } else {
          needsFreshClosedReadRef.current = true
          deferredClosedReadRef.current = requestId ?? activeRequestRef.current ?? lastAttemptRef.current?.requestId ?? null
          flushDeferredClosedRead()
        }
        setRecoveryChecking(false)
        setExternallyClosed(true); setRecovery(null); setUrgentMode(false)
        return null
      }
      // Even an open snapshot can predate an optimistic send or a later draft.
      // Discard its conversation data while the transport is in flight; each
      // deferred read is also fenced by both transition and read identity.
      if (transportWasActive || activeTransportRef.current !== null) return null
      if (closeUncertainRef.current && closeActionPendingRef.current !== sessionId) {
        closeUncertainRef.current = false
        setCloseUncertain(false)
        setCloseNotice('El estado guardado confirma que la sesión sigue abierta.')
      }
      setRecoveryChecking(false)
      if (state.timing) syncClock(state.timing)
      if (completedResponseVisible || interruptedReceipt) setUrgentMode(false)
      if (state.recovery && completedRecoveryRef.current && (state.recovery.requestId !== completedRecoveryRef.current.requestId || state.recovery.attempt !== completedRecoveryRef.current.attempt)) completedRecoveryRef.current = null
      const effectiveFallback = completedResponseVisible || (interruptedReceipt && localFallback?.requestId === requestId) ? null : localFallback
      const effectiveRecovery = interruptedReceipt && state.recovery?.requestId === requestId
        ? { ...state.recovery, canRetry: false }
        : state.recovery
      setReceiptCompleted(effectiveRecovery === null && effectiveFallback !== null && (confirmedFallback !== null || (state.receipt === 'completed' && requestId !== undefined)))
      setRecoveryUnconfirmed(effectiveRecovery === null && effectiveFallback !== null)
      setRecovery(effectiveRecovery ?? effectiveFallback)
      setMessages(state.messages)
      if (questionnaireRefreshPendingRef.current) {
        if (state.recovery?.status === 'generating') {
          const generation = `${state.recovery.requestId}:${state.recovery.canRetry}`
          if (generatingRefreshRef.current !== generation) {
            generatingRefreshRef.current = generation
            router.refresh()
          }
        } else {
          questionnaireRefreshPendingRef.current = false
          generatingRefreshRef.current = null
          router.refresh()
        }
      }
      return { operation, read }
    } catch {
      if (options?.isValid?.() !== false && isCurrentTransition(operation) && recoveryReadRef.current === read) setRecoveryError(true)
      return null
    }
  }

  function syncClock(timing: { serverNow: number; expiresAt: number }) {
    setClock({ ...timing, monotonic: performance.now() })
    setMinsLeft(minutesRemaining(new Date(timing.expiresAt), timing.serverNow))
  }

  async function finishSession() {
    if (closing || closeUncertain || closeActionPendingRef.current === sessionId || isClosed || status === 'submitted' || status === 'streaming') return
    const operation = ++transitionRef.current
    setClosing(true); setCloseNotice('')
    try {
      const closeRequest = closeOwnedSessionFromView(sessionId, isTimeExpired ? 'time_limit' : 'user_request', closeConfirmation)
      closeActionPendingRef.current = sessionId
      let timeout: ReturnType<typeof setTimeout> | undefined
      const outcome = await Promise.race([
        closeRequest.then(result => ({ kind: 'result' as const, result })),
        new Promise<{ kind: 'timeout' }>(resolve => { timeout = setTimeout(() => resolve({ kind: 'timeout' }), CLOSE_ACTION_TIMEOUT_MS) }),
      ])
      if (timeout) clearTimeout(timeout)
      if (outcome.kind === 'timeout') {
        if (isCurrentTransition(operation)) {
          transitionRef.current += 1
          closeUncertainRef.current = true
          setCloseUncertain(true)
          setCloseNotice(`No se pudo confirmar el cierre; puede haberse completado. Comprueba el estado guardado antes de continuar. ${LOCAL_TEXT_COPY_WARNING} Si necesitas enviar una señal urgente, activa esa opción.`)
        }
        void closeRequest.then(() => {
          if (closeActionPendingRef.current === sessionId) closeActionPendingRef.current = null
          if (lifecycleRef.current.mounted && lifecycleRef.current.sessionId === sessionId) void rehydrate(false)
        }, () => {
          if (closeActionPendingRef.current === sessionId) closeActionPendingRef.current = null
          if (lifecycleRef.current.mounted && lifecycleRef.current.sessionId === sessionId) void rehydrate(false)
        })
        return
      }
      if (closeActionPendingRef.current === sessionId) closeActionPendingRef.current = null
      if (!isCurrentTransition(operation)) { void rehydrate(false); return }
      const result = outcome.result
      closeUncertainRef.current = false
      setCloseUncertain(false)
      if (result.closed) { transitionRef.current += 1; completedRecoveryRef.current = null; setExternallyClosed(true); setRecovery(null); setUrgentMode(false); setCloseConfirmation(null) }
      else {
        syncClock(result.timing)
        if (result.reason === 'turn_unresolved') {
          const confirmationChanged = closeConfirmation !== null && (closeConfirmation.requestId !== result.requestId || closeConfirmation.attempt !== result.attempt)
          setCloseConfirmation({ requestId: result.requestId, attempt: result.attempt })
          setCloseNotice(confirmationChanged
            ? 'El turno pendiente ha cambiado desde la confirmación. Comprueba el estado guardado y confirma otra vez antes de terminar.'
            : 'El último mensaje está guardado, pero no hay una respuesta confirmada. Comprueba su estado y, si el reintento está disponible, repite el mismo mensaje. Para terminar sin respuesta, confirma de nuevo.')
        } else {
          setCloseConfirmation(null)
          if (result.reason === 'turn_pending') {
            setCloseNotice('Hay una respuesta en curso. Estamos comprobando su estado guardado; puedes volver a comprobarlo antes de cerrar.')
            void rehydrate(false)
          } else {
            setCloseNotice('El servidor indica que aún queda tiempo. Puedes continuar o terminar la sesión.')
          }
        }
      }
    } catch {
      if (closeActionPendingRef.current === sessionId) closeActionPendingRef.current = null
      if (isCurrentTransition(operation)) {
        closeUncertainRef.current = true
        setCloseUncertain(true)
        setCloseNotice(`No se pudo confirmar el cierre; puede haberse completado. Comprueba el estado guardado antes de continuar. ${LOCAL_TEXT_COPY_WARNING}`)
      }
    } finally {
      if (lifecycleRef.current.mounted && lifecycleRef.current.sessionId === sessionId) setClosing(false)
    }
  }

  function interruptForUrgentSignal() {
    transitionRef.current += 1
    const transport = activeTransportRef.current
    const requestId = activeRequestRef.current
    if (transport !== null) cancelledRequestsRef.current.add(transport)
    if (requestId) {
      const submission = localSubmissionsRef.current.find(item => item.requestId === requestId)
      if (submission) updateLocalSubmission(requestId, { ...submission, state: 'uncertain' })
      setRecoveryChecking(false)
      setRecoveryError(false)
    }
    void stop()
    setUrgentMode(true)
  }

  function checkSavedState() {
    const submission = localSubmissionsRef.current.find(item => item.state === 'uncertain' || item.state === 'interrupted')
    const requestId = submission?.requestId ?? (recoveryChecking ? lastAttemptRef.current?.requestId : undefined)
    if (submission) {
      setRecoveryChecking(true)
      setRecoveryError(false)
    }
    void rehydrate(true, requestId ? { requestId } : undefined)
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
    const serverNow = clock.serverNow + Math.max(0, performance.now() - clock.monotonic)
    const delay = Math.max(1000, new Date(recovery.leaseUntil).getTime() - serverNow + 100)
    const timer = setTimeout(() => void rehydrate(), delay)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recovery, clock])

  async function resolveTurn() {
    if (!recovery || recovery.attempt === undefined || resolvingRef.current || closing || retrying || status === 'submitted' || status === 'streaming') return
    resolvingRef.current = true
    const operation = ++transitionRef.current
    const requestId = recovery.requestId
    const attempt = recovery.attempt
    const resolvedRecovery = recovery
    let resolutionActive = true
    setResolvingTurn(true); setResolutionNotice('')
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        (async () => {
          const result = await resolveOwnedChatTurn(sessionId, requestId, attempt)
          if (!resolutionActive || !isCurrentTransition(operation)) return
          if (result === 'busy' || result === 'active' || result === 'unknown') {
            setResolutionNotice('No hemos podido confirmar la resolución. Puedes comprobarla de nuevo.')
            return
          }
          questionnaireRefreshPendingRef.current = true
          generatingRefreshRef.current = null
          const completedFallback = result === 'completed' ? { ...resolvedRecovery, status: 'failed' as const, canRetry: true } : undefined
          if (completedFallback) completedRecoveryRef.current = completedFallback
          await rehydrate(false, { completedFallback, isValid: () => resolutionActive })
        })(),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Resolution timed out')), 15_000) }),
      ])
    } catch {
      if (isCurrentTransition(operation)) {
        resolutionActive = false
        setResolutionNotice('No hemos podido confirmar la resolución. Puedes comprobarla de nuevo.')
      }
    } finally {
      resolutionActive = false
      if (timeout) clearTimeout(timeout)
      resolvingRef.current = false
      if (lifecycleRef.current.mounted && lifecycleRef.current.sessionId === sessionId) setResolvingTurn(false)
    }
  }

  async function retry() {
    if (!recovery?.canRetry || retrying) return
    setCloseConfirmation(null)
    setCloseNotice('')
    questionnaireRefreshPendingRef.current = true
    generatingRefreshRef.current = null
    const operation = ++transitionRef.current
    const attempt = recovery
    lastAttemptRef.current = attempt
    failedRef.current = false
    clearError()
    const transport = beginTransport(attempt.requestId)
    retryingTransportRef.current = transport
    setRetrying(true)
    let completed = false
    try {
      const existing = messages.find(message => message.id === attempt.userMessageId || message.id === attempt.requestId)
      const safetyPromptRequestId = localSubmissionsRef.current.find(item => item.requestId === attempt.requestId)?.safetyPromptRequestId
      await sendMessage(existing ? { text: attempt.text, messageId: existing.id } : undefined, { body: { requestId: attempt.requestId, retryText: attempt.text, safetyPromptRequestId } })
      completed = isCurrentTransition(operation) && !failedRef.current && !cancelledRequestsRef.current.has(transport)
    } catch {
      failedRef.current = true
    } finally {
      endTransport(transport)
      if (retryingTransportRef.current === transport) {
        retryingTransportRef.current = null
        if (lifecycleRef.current.mounted && lifecycleRef.current.sessionId === sessionId) setRetrying(false)
      }
    }
    if (completed) {
      // Completion supersedes snapshots captured while this turn was pending.
      transitionRef.current += 1
      completedRecoveryRef.current = null
      setRecoveryChecking(true)
      const snapshot = await rehydrate(false, { ignoreCompletedFallback: true })
      if (snapshot !== null && isCurrentTransition(snapshot.operation) && recoveryReadRef.current === snapshot.read) { completedRecoveryRef.current = null; setUrgentMode(false) }
    }
  }

  async function send(text: string, replay?: LocalSubmission): Promise<boolean> {
    const isStoredReplay = replay !== undefined && localSubmissionsRef.current.some(item => item.requestId === replay.requestId && item.text === replay.text)
    if (closing || isClosed || ((recovery || recoveryChecking || isTimeExpired) && !urgentMode && !isStoredReplay)) return false
    const operation = ++transitionRef.current
    setCloseConfirmation(null)
    setCloseNotice('')
    const messagesBeforeReplay = replay ? messages : null
    const recoveryBeforeReplay = replay ? recovery : null
    completedRecoveryRef.current = null
    failedRef.current = false; clearError()
    const requestId = replay?.requestId ?? crypto.randomUUID()
    const urgent = replay?.urgent ?? urgentMode
    const submission: LocalSubmission = { requestId, userMessageId: replay?.userMessageId, text, urgent, safetyPromptRequestId: replay?.safetyPromptRequestId ?? latestSafetyPromptRequestId(messages), state: 'sending' }
    updateLocalSubmission(requestId, submission)
    if (urgent) setUrgentMode(true)
    lastAttemptRef.current = { requestId, userMessageId: requestId, text, status: 'failed', canRetry: true, leaseUntil: new Date().toISOString() }
    const transport = beginTransport(requestId)
    let completed = false
    try {
      const existing = messages.find(message => message.id === replay?.userMessageId) ?? messages.find(message => message.id === requestId)
      const message = existing
        ? { text, messageId: existing.id }
        : { id: requestId, role: 'user' as const, parts: [{ type: 'text' as const, text }] }
      await sendMessage(message, { body: { requestId, retryText: text, safetyPromptRequestId: submission.safetyPromptRequestId } })
      completed = isCurrentTransition(operation) && !failedRef.current && !cancelledRequestsRef.current.has(transport)
    } catch {
      failedRef.current = true
    } finally {
      endTransport(transport)
    }
    if (completed) {
      updateLocalSubmission(requestId, null)
      transitionRef.current += 1
      if (replay) {
        if (messagesBeforeReplay) {
          const replayAnchor = messagesBeforeReplay.findIndex(message => message.id === replay.userMessageId || message.id === requestId)
          const preservedTail = replayAnchor >= 0 ? messagesBeforeReplay.slice(replayAnchor + 1) : messagesBeforeReplay
          const pendingMessage: UIMessage | null = recoveryBeforeReplay && recoveryBeforeReplay.requestId !== requestId
            ? { id: recoveryBeforeReplay.userMessageId, role: 'user', parts: [{ type: 'text', text: recoveryBeforeReplay.text }] }
            : null
          setMessages(current => {
            const currentIds = new Set(current.map(message => message.id))
            const restored = [...current]
            for (const message of [...preservedTail, ...(pendingMessage ? [pendingMessage] : [])]) {
              if (currentIds.has(message.id)) continue
              currentIds.add(message.id)
              restored.push(message)
            }
            return restored
          })
        }
        setUrgentMode(false)
        setRecoveryError(false)
        setRecoveryChecking(true)
        const snapshot = await rehydrate(false, { ignoreCompletedFallback: true })
        if (snapshot !== null && isCurrentTransition(snapshot.operation) && recoveryReadRef.current === snapshot.read) setUrgentMode(false)
      } else {
        setRecovery(null); setRecoveryError(false); setRecoveryChecking(false); setRecoveryUnconfirmed(false); setUrgentMode(false)
      }
    } else {
      updateLocalSubmission(requestId, { ...submission, state: 'uncertain' })
    }
    // The local copy owns this submitted text until a successful response is
    // confirmed. The composer remains available for the next draft.
    return true
  }

  async function copyLocalSubmission(submission: LocalSubmission) {
    try {
      await navigator.clipboard.writeText(submission.text)
      setCopiedSubmissionIds(current => current.includes(submission.requestId) ? current : [...current, submission.requestId])
    } catch {
      // The selectable local text remains visible if browser clipboard access is unavailable.
    }
  }

  useEffect(() => {
    if (status !== 'ready' || isClosed) return
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
  }, [messages, status, router, isClosed])

  // Plan 4.2: on crisis close, push the patient to /app after a short
  // beat so the home page's red Línea 024 banner
  // (app/app/page.tsx — lastClosed.closureReason === 'crisis_detected')
  // is the first thing they see. Non-crisis confirm stays put — the
  // end-of-session banner below has a link to /app when the patient is
  // ready.
  useEffect(() => {
    if (initialClosed || closeSignal !== 'crisis') return
    const hasUncopiedSubmission = localSubmissions.some(submission => !copiedSubmissionIds.includes(submission.requestId))
    if (draft.trim() || hasUncopiedSubmission) {
      crisisRedirectRef.current = false
      return
    }
    if (crisisRedirectRef.current) return
    crisisRedirectRef.current = true
    const timer = setTimeout(() => {
      router.push('/app')
    }, 1800)
    return () => clearTimeout(timer)
  }, [closeSignal, router, draft, initialClosed, localSubmissions, copiedSubmissionIds])

  useEffect(() => {
    if (isClosed) return
    const interval = setInterval(() => {
      setMinsLeft(minutesRemaining(new Date(clock.expiresAt), clock.serverNow + Math.max(0, performance.now() - clock.monotonic)))
    }, 1000)
    return () => clearInterval(interval)
  }, [clock, isClosed])

  useEffect(() => {
    if (isClosed) return
    const sync = () => { if (document.visibilityState === 'visible') void rehydrate() }
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    return () => { window.removeEventListener('focus', sync); document.removeEventListener('visibilitychange', sync) }
    // Snapshots use the same transition guards as manual recovery.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, status, isClosed])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, status])

  const lastMessage = messages.at(-1)
  const lastHasAssistantText = lastMessage?.role === 'assistant' && lastMessage.parts.some(part => part.type === 'text' && part.text.trim().length > 0)
  const showTyping = status === 'submitted' || (status === 'streaming' && !lastHasAssistantText)
  // Espera normal de respuesta: el panel de estado se muestra igual, pero más ligero.
  const onlyWaiting = (status === 'submitted' || status === 'streaming') && !isTimeExpired && !closeUncertain && !closeConfirmation && !closeNotice && !recovery && !recoveryChecking && !localSubmissions.some(submission => submission.state !== 'sending')
  const unresolvedSubmission = localSubmissions.find(submission => submission.state === 'uncertain' || submission.state === 'interrupted')
  const recoveryStatus = recoveryChecking
    ? recoveryError ? 'No hemos podido comprobar cómo terminó el turno. Puedes comprobar el estado de nuevo.' : 'Estamos comprobando cómo terminó el turno.'
    : closeUncertain ? 'El cierre no está confirmado. Comprueba el estado guardado antes de continuar; puedes activar el envío urgente si lo necesitas.'
    : recovery
      ? recovery.canRetry
        ? receiptCompleted ? 'Tu turno guardado terminó, pero no podemos confirmar que la respuesta se muestre. Puedes recuperar el mismo mensaje.'
          : recovery.status === 'generating' || recoveryUnconfirmed ? 'Aún no podemos confirmar cómo terminó el turno. Puedes reintentar el mismo mensaje.'
          : 'Tu texto guardado está disponible en este turno. Puedes reintentarlo.'
        : recovery.status === 'generating' ? 'La respuesta sigue pendiente. Puedes escribir mientras esperas.'
          : 'No se puede reintentar este turno. Puedes recargar o enviar una señal urgente nueva.'
      : status === 'submitted' || status === 'streaming' ? 'Esperando respuesta. Puedes seguir escribiendo.'
        : unresolvedSubmission?.state === 'interrupted'
          ? `${LOCAL_TEXT_COPY_WARNING} Comprueba el estado antes de continuar.`
          : unresolvedSubmission ? `No hemos podido confirmar el envío. ${LOCAL_TEXT_COPY_WARNING} Comprueba el estado antes de continuar.`
            : status === 'error' ? 'Estamos comprobando cómo terminó el turno.'
              : closeNotice ? isTimeExpired ? 'El tiempo se ha agotado; falta confirmar el cierre guardado.' : 'La sesión sigue activa; puedes continuar o terminar cuando quieras.'
                : 'El contador indica el fin del tiempo; falta confirmar el cierre guardado.'

  return (
    <div className="mx-auto flex h-[calc(100dvh-7.5rem)] w-full max-w-2xl flex-col gap-3 md:h-[calc(100dvh-5rem)]">
      <div
        className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm sm:px-4 ${
          isEnding
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : 'border-stone-200/80 bg-white text-muted-foreground'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandOrb className="size-7" />
          <div className="min-w-0 leading-tight">
            <p className="font-semibold text-stone-900">Serenia</p>
            <p className="text-xs tabular-nums">
              {isClosed
                ? 'La sesión ha terminado.'
                : isTimeExpired ? 'Tiempo agotado · cierre pendiente de confirmar' : `${minsLeft} min restantes`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isEnding && !isExpired && (
            <span className="sr-only text-xs font-medium sm:not-sr-only">Queda poco tiempo.</span>
          )}
          {!isClosed && (
              <button
                type="button"
                disabled={closing || closeUncertain || status === 'submitted' || status === 'streaming'}
                onClick={() => {
                  // A plain, voluntary close cannot be undone: ask first. Time-limit and
                  // unresolved-turn closes already carry their own explicit confirmation.
                  if (!isTimeExpired && !closeConfirmation && !closeUncertain && !closing) { setConfirmingEnd(true); return }
                  void finishSession()
                }}
                ref={endButtonRef}
                aria-expanded={confirmingEnd}
                aria-controls={confirmingEnd ? 'end-session-panel' : undefined}
                className="min-h-9 rounded-full border border-stone-300 bg-white px-3.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-60"
              >
                {closing ? 'Confirmando cierre…' : closeUncertain ? 'Cierre sin confirmar' : closeConfirmation ? 'Terminar sin respuesta' : isTimeExpired ? 'Confirmar cierre por tiempo' : 'Terminar sesión'}
              </button>
          )}
        </div>
      </div>

      {confirmingEnd && !isClosed && (
        <div id="end-session-panel" role="group" aria-labelledby="end-session-confirm" className="space-y-2.5 rounded-xl bg-muted p-3 text-sm text-stone-800">
          <p id="end-session-confirm" className="font-medium">¿Terminar la sesión? Después no podrás seguir escribiendo en ella.</p>
          {activeQuestionnaire && activeQuestionnaire.status !== 'scored' && <p>Tienes un cuestionario sin terminar: las respuestas que no hayas enviado no se guardarán.</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" autoFocus disabled={closing || status === 'submitted' || status === 'streaming'} onClick={() => { setConfirmingEnd(false); void finishSession() }} className={primaryActionClass}>Sí, terminar la sesión</button>
            <button type="button" onClick={() => { setConfirmingEnd(false); endButtonRef.current?.focus() }} className={secondaryActionClass}>Seguir en la sesión</button>
          </div>
        </div>
      )}
      {closeNotice && <p role="status" className="rounded-xl bg-muted px-3 py-2 text-sm text-stone-800">{closeNotice}</p>}
      {retrying && <p role="status" className="rounded-xl bg-muted px-3 py-2 text-sm text-stone-800">Reintentando el mismo turno guardado. Puedes seguir escribiendo mientras esperamos.</p>}

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-1 py-2">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 px-4 text-center">
            <BrandOrb className="size-14" />
            <div>
              <p className="landing-serif text-[1.75rem] leading-tight text-stone-900">Empieza cuando quieras.</p>
              <p className="mx-auto mt-2 max-w-sm text-[15px] text-muted-foreground">
                Escribe abajo lo que tengas en mente. Si antes prefieres bajar el ritmo, puedes respirar un minuto.
              </p>
            </div>
            <BreathingExercise />
          </div>
        ) : (
          messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              showAvatar={index === 0 || messages[index - 1].role !== message.role}
              animate={!initialMessageIds.has(message.id)}
            />
          ))
        )}
        {showTyping && <TypingBubble />}
      </div>

      {localSubmissions.filter(submission => submission.state !== 'sending' || isClosed).map((submission, index) => (
        <section key={submission.requestId} role="status" aria-live="polite" className="rounded-xl bg-muted p-3 text-sm text-stone-800">
          <p className="font-medium">
            {submission.state === 'sending'
              ? `Envío pendiente. ${LOCAL_TEXT_COPY_WARNING}`
              : submission.state === 'interrupted'
                ? `El turno se interrumpió. ${LOCAL_TEXT_COPY_WARNING} Comprueba el estado antes de continuar.`
              : `No hemos podido confirmar el envío. ${LOCAL_TEXT_COPY_WARNING} Comprueba el estado antes de volver a enviarlo.`}
          </p>
          {isClosed
            ? <textarea aria-label={`Mensaje pendiente ${index + 1}`} value={submission.text} readOnly className="mt-2 block w-full rounded-lg border border-stone-300 bg-white p-2" />
            : <p className="mt-2 whitespace-pre-wrap">{submission.text}</p>}
          <button type="button" onClick={() => void copyLocalSubmission(submission)} className={`mt-2 ${secondaryActionClass}`}>
            Copiar texto
          </button>
          {copiedSubmissionIds.includes(submission.requestId) && <p role="status" className="mt-1">Texto copiado al portapapeles.</p>}
          {submission.state === 'uncertain' && !isClosed && (
            <button type="button" disabled={closing || retrying || resolvingTurn || recoveryChecking || status === 'submitted' || status === 'streaming'} onClick={() => void send(submission.text, submission)} className={`mt-2 ml-2 ${primaryActionClass}`}>
              Reintentar la misma señal guardada
            </button>
          )}
        </section>
      ))}

      {isClosed ? (
        <div className="rounded-2xl border border-stone-200/80 bg-white p-4 text-center text-[15px] text-stone-700">
          <p>La sesión ha terminado.{' '}
            <Link href="/app" className="font-medium text-primary underline underline-offset-4">
              Vuelve al inicio.
            </Link>
          </p>
          {draft.trim() && <div className="mt-3 text-left">
            <label htmlFor={`unsent-${sessionId}`} className="text-sm font-medium">Borrador sin enviar</label>
            <textarea id={`unsent-${sessionId}`} value={draft} readOnly className="mt-1 block w-full rounded-lg border border-stone-300 p-2" />
            <p className="mt-2 text-sm text-muted-foreground">Este texto no se ha enviado. Puedes copiarlo antes de salir. Si necesitas ayuda inmediata, los recursos de seguridad siguen disponibles abajo.</p>
          </div>}
        </div>
      ) : (
        <>
          {isTimeExpired && <p role="status" className="rounded-xl bg-muted p-3 text-sm text-stone-800">Tiempo agotado para mensajes nuevos ordinarios. El borrador pendiente solo sigue en esta pantalla; cópialo antes de recargar o salir. Una respuesta ya aceptada puede terminar y puedes reintentar el mismo turno. Confirma el cierre cuando termine. Si necesitas comunicar una señal urgente nueva, activa el envío urgente. <UrgentHelpText lead={false} linkClassName="font-semibold underline underline-offset-2" /></p>}
          {!isTimeExpired && activeQuestionnaire &&
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
          {(isTimeExpired || closeUncertain || closeConfirmation || closeNotice || recovery || recoveryChecking || status === 'error' || status === 'submitted' || status === 'streaming' || localSubmissions.some(submission => submission.state !== 'sending')) && <div role="group" aria-label="Estado del envío" className={`space-y-2.5 rounded-xl text-sm text-stone-800 ${onlyWaiting ? 'px-1' : 'bg-muted p-3'}`}>
            <p role="status" aria-live="polite" className={onlyWaiting ? 'text-muted-foreground' : 'font-medium'}>{recoveryStatus}</p>
            {recovery?.canRetry && !recoveryChecking && !urgentMode && <button type="button" disabled={closing || retrying || resolvingTurn || status === 'submitted' || status === 'streaming'} onClick={() => void retry()} className={primaryActionClass}>Reintentar el mismo mensaje</button>}
            {recovery?.attempt !== undefined && !urgentMode && <><p className="text-muted-foreground">Comprobar y resolver puede detener una respuesta pendiente que aún no se haya guardado.</p><button type="button" disabled={resolvingTurn || closing || retrying || status === 'submitted' || status === 'streaming'} onClick={() => void resolveTurn()} className={secondaryActionClass}>Comprobar y resolver turno pendiente</button></>}
            {resolutionNotice && <p role="status">{resolutionNotice}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={checkSavedState} className={secondaryActionClass}>Comprobar estado guardado</button>
            </div>
            <button type="button" onClick={interruptForUrgentSignal} className={`flex min-h-10 items-center justify-center rounded-lg border border-stone-400 bg-white px-3 font-medium text-stone-900 hover:bg-stone-50 ${onlyWaiting ? 'w-full sm:w-auto' : 'w-full'}`}>Interrumpir espera y enviar una señal urgente</button>
            {recoveryError && <p role="alert" className="text-red-800">No se pudo comprobar el estado. {LOCAL_TEXT_COPY_WARNING} Vuelve a comprobarlo cuando puedas.</p>}
          </div>}
          {urgentMode && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-stone-800">Escribe con claridad que necesitas ayuda ahora, por ejemplo «necesito ayuda inmediata» o «estoy en peligro». Solo un aviso urgente reconocido por el servidor puede sustituir el turno pendiente; un mensaje ordinario seguirá esperando. <UrgentHelpText lead={false} linkClassName="font-semibold underline underline-offset-2" /></p>}
          <ChatInput
            status={(recovery || recoveryChecking) && !urgentMode ? 'submitted' : status}
            disabled={closing || ((isTimeExpired || closeUncertain) && !urgentMode)}
            onSend={send}
            draft={{ value: draft, onChange: setDraft }}
          />
        </>
      )}

      <CrisisBanner />
    </div>
  )
}
