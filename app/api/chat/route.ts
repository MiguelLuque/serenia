import { convertToModelMessages, createUIMessageStreamResponse, stepCountIs, streamText, tool, type UIMessage, type UIMessageChunk } from 'ai'
import { z } from 'zod'
import { createAuthenticatedClient } from '@/lib/server/supabase/server'
import { requireOwnedSession } from '@/lib/server/sessions/authorization'
import { llm } from '@/lib/shared/llm/models'
import { getSessionTherapistPrompt } from '@/lib/server/llm/prompts'
import { getOrResolveActiveSession, isSessionExpired } from '@/lib/server/sessions/service'
import { isSessionInactive } from '@/lib/shared/chat/session-time'
import { buildSessionTimeNotice } from '@/lib/server/chat/session-time-notice'
import { detectCrisis } from '@/lib/shared/chat/crisis-detector'
import { getSessionSafetyState } from '@/lib/server/chat/safety-state'
import { buildCrisisNotice, hasHighSignalTerm } from '@/lib/shared/chat/crisis-notice'
import { createInstance, getActiveInstanceForSession } from '@/lib/server/questionnaires/service'
import { listPatientCodes, type QuestionnaireCode } from '@/lib/shared/questionnaires/registry'
import { buildPatientContext } from '@/lib/server/patient-context/builder'
import { assemblePlan6ContextPieces } from '@/lib/server/chat/assemble-plan6-prompt'
import { buildChatSystemPrompt } from '@/lib/server/chat/system-prompt'
import { logContextInjection } from '@/lib/server/patient-context/telemetry'
import { enqueueAssessmentGeneration } from '@/lib/server/workflows'
import { ChatRequestSchema, acceptsClosure, checkContextBudget, readBoundedJson } from '@/lib/server/chat/request-boundary'
import type { Json } from '@/lib/shared/supabase/types'
import type { ProtocolPhase } from '@/lib/shared/protocol/render-phase'
import { SAFETY_RESOURCES } from '@/lib/shared/safety-resources'
import { clinicalPilotEnabled } from '@/lib/server/llm/clinical-pilot'
import { buildPilotSafetyNotice } from '@/lib/shared/chat/pilot-safety-notice'
import { loadQuestionnaireFacts } from '@/lib/server/assessments/questionnaire-facts'
import { renderPilotQuestionnaireFacts } from '@/lib/server/chat/pilot-questionnaire-context'
import { modelHistoryParts } from '@/lib/server/chat/tool-feedback'

export const maxDuration = 60
const MAX_OUTPUT_TOKENS = 2500

function replay(chunks: UIMessageChunk[]) {
  return createUIMessageStreamResponse({ stream: new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close() } }), headers: { 'Cache-Control': 'no-store' } })
}
function staticReply(id: string, text: string): { parts: UIMessage['parts']; chunks: UIMessageChunk[] } {
  return { parts: [{ type: 'text', text }], chunks: [{ type: 'start', messageId: id }, { type: 'text-start', id: 'text' }, { type: 'text-delta', id: 'text', delta: text }, { type: 'text-end', id: 'text' }, { type: 'finish', finishReason: 'stop' }] }
}

export async function POST(req: Request) {
  const supabase = await createAuthenticatedClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new Response('Unauthorized', { status: 401 })
  let body: z.infer<typeof ChatRequestSchema>
  try { body = ChatRequestSchema.parse(await readBoundedJson(req)) }
  catch { return Response.json({ error: 'Solicitud inválida' }, { status: 400 }) }
  const { sessionId, requestId } = body
  const lastUserText = body.messages[0].parts[0].text
  let owned
  try { owned = await requireOwnedSession(supabase, sessionId) }
  catch { return new Response('Session not found', { status: 404 }) }
  const { session, service } = owned
  const { data: ready, error: readinessError } = await supabase.rpc('get_onboarding_ready')
  if (readinessError || ready !== true) return Response.json({ error: 'Completa los datos y la aceptación vigente', onboardingRequired: true }, { status: 403 })
  const pilot = clinicalPilotEnabled(process.env, user.id)
  const crisis = detectCrisis(lastUserText)
  const highSignalCrisis = crisis.detected && hasHighSignalTerm(crisis.matchedTerms)
  // Resolve only NEW ordinary idle turns. Existing IDs must retain replay and
  // recovery, and safety signals must be recorded before any temporal closure.
  if (session.status === 'open' && !crisis.detected && !isSessionExpired(session) && isSessionInactive(session)) {
    const { data: prior, error: priorError } = await service.from('chat_turns').select('request_id').eq('session_id', sessionId).eq('user_id', user.id).eq('request_id', requestId).maybeSingle()
    if (priorError) return Response.json({ error: 'No se pudo comprobar el turno. Conserva el texto y reintenta.' }, { status: 503 })
    if (!prior) {
      try {
        const active = await getOrResolveActiveSession(supabase, user.id)
        if (!active || active.id !== sessionId) return Response.json({ error: 'La sesión se cerró por inactividad. Tu texto no se ha enviado.', sessionClosed: true }, { status: 422 })
      } catch { return Response.json({ error: 'No se pudo comprobar la sesión. Conserva el texto y reintenta.' }, { status: 503 }) }
    }
  }
  const { data: claim, error: claimError } = await service.rpc('begin_chat_turn', { p_session_id: sessionId, p_user_id: user.id, p_request_id: requestId, p_text: lastUserText, p_crisis: crisis.detected, p_urgent: highSignalCrisis })
  if (claimError) return Response.json({ error: 'El turno no está disponible. Reintenta el mismo mensaje o recarga.', requestId }, { status: claimError.code === '55P03' ? 409 : 422 })
  const turn = claim as { replay: boolean; token: string; chunks?: UIMessageChunk[]; urgent?: boolean; userMessageId: string }
  if (turn.replay) return replay(turn.chunks ?? [])
  const token = turn.token
  let createdQuestionnaire: { code: QuestionnaireCode; reason: string; instanceId: string } | null = null
  let closureClarification: string | null = null
  let closeReason: string | null = null
  const crisisResourcesText = `Lo que cuentas necesita apoyo inmediato. Puedes llamar a la ${SAFETY_RESOURCES.suicide.name} (${SAFETY_RESOURCES.suicide.description}). Si estás en peligro inmediato, llama al ${SAFETY_RESOURCES.emergency.phone}. No esperes a completar un cuestionario para pedir ayuda. La señal queda registrada para revisión clínica.`
  const timeClosureText = 'Se ha alcanzado el límite de tiempo y la sesión ha terminado. El cierre queda registrado; cualquier informe que se genere requiere revisión clínica.'
  const markClosed = (parts: UIMessage['parts'], chunks: UIMessageChunk[], reason: string) => {
    const part = { type: 'data-session-closed' as const, data: { closed: true, reason } }
    parts.push(part)
    chunks.splice(chunks.length - 1, 0, part)
  }
  const finishStaticReply = async (closeReason: 'crisis_detected' | 'time_limit' | null) => {
    // Context/model failures can cross the deadline too. Revalidate at the
    // shared finalizer so fallback success cannot leave an expired turn open.
    if (!closeReason && isSessionExpired(session)) closeReason = crisis.detected ? 'crisis_detected' : 'time_limit'
    const text = crisis.detected ? crisisResourcesText : timeClosureText
    const response = staticReply(`assistant-${requestId}`, text)
    if (createdQuestionnaire) {
      // The RPC already committed this instance. Preserve that real tool
      // outcome even if the provider failed after executing it, so the client
      // refreshes its SSR card and replay retains the same durable outcome.
      const { code, reason, instanceId } = createdQuestionnaire
      const toolCallId = `persisted-questionnaire-${requestId}`
      const input = { code, reason }, output = { proposed: true, code, instanceId }
      response.parts.push({ type: 'tool-propose_questionnaire', toolCallId, state: 'output-available', input, output })
      response.chunks.splice(response.chunks.length - 1, 0,
        { type: 'tool-input-available', toolCallId, toolName: 'propose_questionnaire', input },
        { type: 'tool-output-available', toolCallId, output })
    }
    if (closeReason) markClosed(response.parts, response.chunks, closeReason)
    const { error } = await service.rpc('finish_chat_turn', { p_session_id: sessionId, p_request_id: requestId, p_token: token, p_parts: response.parts as Json, p_chunks: response.chunks as unknown as Json, p_close_reason: closeReason ?? undefined })
    if (error) throw error
    if (closeReason) void enqueueAssessmentGeneration({ sessionId }).catch(() => console.error('[chat] outbox recovery pending'))
    return replay(response.chunks)
  }
  const prepareContext = async () => {
    const { data: rows, error: historyError } = await service.from('messages').select('id, role, parts, created_at').eq('session_id', sessionId).eq('conversation_id', session.conversation_id).order('created_at', { ascending: true }).order('id', { ascending: true }).limit(161)
    if (historyError) throw historyError
    if (!rows || rows.length >= 161 || !rows.some(row => row.id === turn.userMessageId)) throw new Error('context_limit')
    // Full parts stay available for UI rehydration. The pilot additionally
    // projects confirmed known tool outcomes, never their free-form arguments.
    const messages: UIMessage[] = (rows ?? []).filter(row => row.role === 'user' || row.role === 'assistant').map(row => {
      const role = row.role as 'user' | 'assistant'
      return { id: row.id, role, parts: modelHistoryParts(role, row.parts, pilot) }
    }).filter(message => message.parts.length > 0)
    checkContextBudget(messages)
    const safetyState = await getSessionSafetyState(supabase, sessionId, session.opened_at, { strict: pilot })
    const crisisNotice = pilot ? buildPilotSafetyNotice({ safetyState, crisis }) : buildCrisisNotice({ safetyState, crisis })
    const questionnaireNotice = pilot
      ? renderPilotQuestionnaireFacts(await loadQuestionnaireFacts(supabase, sessionId, user.id))
      : await buildQuestionnaireResultNotice(supabase, sessionId, session.opened_at, session.conversation_id)
    let patientContextBlock = '', riskOpeningNotice = '', intakeBlock = '', protocolPhaseBlock = ''
    if (process.env.FEATURE_CROSS_SESSION_CONTEXT === 'on') {
      try {
        // Elevated private context only after getUser + session/conversation
        // ownership above. This internal snapshot never goes to the client.
        const ctx = await buildPatientContext({ supabase: service, userId: user.id, sessionId, protocolPhase: session.protocol_phase as ProtocolPhase })
        const pieces = assemblePlan6ContextPieces(ctx)
        ;({ patientContextBlock, riskOpeningNotice, intakeBlock, protocolPhaseBlock } = pieces)
        void logContextInjection({ userId: user.id, sessionId, ...pieces.telemetry }).catch(() => console.error('[context-telemetry] failed'))
      } catch (error) {
        console.error('[patient-context] unavailable')
        if (crisis.detected) throw error
      }
    }
    const timeNotice = buildSessionTimeNotice(session.opened_at)
    const systemPrompt = buildChatSystemPrompt({ basePrompt: getSessionTherapistPrompt(user.id), riskOpeningNotice, crisisNotice, questionnaireNotice, timeNotice, intakeBlock, patientContextBlock, protocolPhaseBlock })
    checkContextBudget([systemPrompt, ...messages])
    return { messages, systemPrompt, timeNotice }
  }
  let awaitingGeneration = false
  let generationTimeExpired = false
  try {
    // Accepted text/risk already committed. RPC interruptions/time limits never
    // depend on context. Only the supervised pilot contextualizes ordinary
    // lexical signals; the reference response remains deterministic.
    if (isSessionExpired(session) || turn.urgent || (!pilot && highSignalCrisis)) return await finishStaticReply(isSessionExpired(session) ? crisis.detected ? 'crisis_detected' : 'time_limit' : null)
    let context: Awaited<ReturnType<typeof prepareContext>>
    try { context = await prepareContext() }
    catch (error) {
      if (!crisis.detected) throw error
      // Preserve the existing budget fallback closure criterion. A context
      // outage alone does not introduce a new reason to close the session.
      return await finishStaticReply(error instanceof Error && error.message === 'context_limit' ? 'crisis_detected' : null)
    }
    if (isSessionExpired(session)) return await finishStaticReply(crisis.detected ? 'crisis_detected' : 'time_limit')
    const { messages, systemPrompt, timeNotice } = context
    const patientCodes = listPatientCodes()
    let proposal: string | null = null
    let modelStep = 0
    let toolContinuationRequired = false
    let validToolContinuation = false
    let actionQueue: Promise<unknown> = Promise.resolve()
    const runToolAction = <T,>(action: () => Promise<T>) => {
      if (!pilot) return action()
      const result = actionQueue.then(async () => {
        if (modelStep > 0) return { skipped: true as const, reason: 'tool_followup_read_only' as const }
        if (closeReason) return { skipped: true as const, reason: 'session_closing' as const }
        return action()
      })
      // Serialize operations even when the provider emits parallel calls.
      // A rejected action still reaches the SDK as an error result.
      actionQueue = result.catch(() => undefined)
      return result
    }
    const close = async (reason: string) => {
      const { data, error } = await service.rpc('close_chat_turn', { p_session_id: sessionId, p_request_id: requestId, p_token: token, p_reason: reason })
      if (error) throw error
      if (!data) return { closed: false, reason: 'confirmation_required' }
      closeReason = reason
      return { closed: true, reason }
    }
    awaitingGeneration = true
    const result = streamText({
      model: llm.conversational(), system: systemPrompt,
      messages: await convertToModelMessages(messages),
      maxOutputTokens: MAX_OUTPUT_TOKENS, maxRetries: 0, abortSignal: AbortSignal.timeout(45_000),
      stopWhen: stepCountIs(pilot ? 2 : 1),
      prepareStep: ({ stepNumber, messages: stepMessages, steps }) => {
        if (isSessionExpired(session)) { generationTimeExpired = true; throw new Error('session_time_limit') }
        const system = systemPrompt.replace(timeNotice, buildSessionTimeNotice(session.opened_at))
        checkContextBudget([system, ...stepMessages])
        if (!pilot) return { system }
        modelStep = stepNumber
        checkContextBudget([systemPrompt, ...stepMessages])
        if (stepNumber > 0) {
          let remaining = MAX_OUTPUT_TOKENS
          for (const step of steps) {
            const used = step.usage.outputTokens
            if (typeof used !== 'number' || !Number.isSafeInteger(used) || used < 0) throw new Error('response_limit')
            remaining -= used
          }
          if (remaining <= 0) throw new Error('response_limit')
          return { system, toolChoice: 'none', activeTools: [], maxOutputTokens: remaining }
        }
        return { system }
      },
      onStepFinish: step => {
        if (!pilot) return
        if (step.stepNumber === 0) toolContinuationRequired = step.toolCalls.length > 0
        else validToolContinuation = step.toolCalls.length === 0 && step.text.trim().length > 0
      },
      tools: {
        propose_close_session: tool({ description: 'Propone cierre anticipado por user_request o time_limit. Espera aceptación explícita del siguiente turno antes de confirmar. El límite duro se aplica en servidor.', inputSchema: z.object({ reason: z.enum(['user_request','time_limit']) }), execute: async ({ reason }) => runToolAction(async () => { if (isSessionExpired(session)) return { skipped: true, reason: 'time_limit' }; proposal = reason; return { proposed: true, reason } }) }),
        confirm_close_session: tool({ description: 'Confirma exclusivamente la propuesta anterior con el mismo motivo y aceptación explícita del turno siguiente.', inputSchema: z.object({ reason: z.enum(['user_request','time_limit']) }), execute: async ({ reason }) => runToolAction(async () => {
          if (acceptsClosure(lastUserText)) return close(reason)
          let proposalRenewed = false
          const normalized = lastUserText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
          if (pilot && /^(si|de acuerdo|vale|acepto)\b/.test(normalized) && !/[?¿]|\b(no|pero|quizas|duda)\b/.test(normalized)) {
            const { data: prior, error } = await service.from('session_close_proposals').select('reason').eq('session_id', sessionId).maybeSingle()
            if (error) throw error
            if (prior?.reason === reason) { proposal = reason; proposalRenewed = true }
          }
          if (pilot) closureClarification = proposalRenewed
            ? 'La sesión sigue abierta. Para confirmar el cierre pendiente, puedes responder «Sí, cerramos».'
            : 'La sesión sigue abierta. Si quieres terminar, podemos volver a proponer el cierre y confirmarlo en el siguiente turno.'
          return { closed: false, reason: 'confirmation_required', proposalRenewed }
        }) }),
        close_session_crisis: tool({ description: 'Cierra por señal de crisis registrada, sin pedir aceptación. Da primero los recursos de seguridad.', inputSchema: z.object({}), execute: async () => runToolAction(async () => close('crisis_detected')) }),
        propose_questionnaire: tool({ description: 'Propone PHQ9 o GAD7 para screening y BDI2/BAI para profundización tras primario moderado. C-SSRS (CSSRS) tiene prioridad ante señal suicida/autolesión. Los cuestionarios scored no bloquean otros; como máximo un cuestionario pendiente. Anuncia por texto y espera consentimiento, excepto la atención urgente a seguridad.', inputSchema: z.object({ code: z.enum(patientCodes as [QuestionnaireCode,...QuestionnaireCode[]]), reason: z.string().min(10).max(300) }), execute: async ({ code, reason }) => runToolAction(async () => {
          if (isSessionExpired(session)) return { skipped: true, reason: 'time_limit' }
          if (code !== 'CSSRS' && await getActiveInstanceForSession(supabase, sessionId)) return { skipped: true, reason: 'already_active' }
          if (isSessionExpired(session)) return { skipped: true, reason: 'time_limit' }
          const instance = await createInstance(supabase, { userId: user.id, sessionId, conversationId: session.conversation_id, questionnaireCode: code, triggerReason: reason, requestId, turnToken: token })
          createdQuestionnaire = { code, reason, instanceId: instance.id }
          return { proposed: true, code, instanceId: instance.id }
        }) }),
      },
    })
    let responseMessage: UIMessage | undefined
    const chunks: UIMessageChunk[] = []
    const reader = result.toUIMessageStream({ originalMessages: messages, onFinish: ({ responseMessage: message }) => { responseMessage = message }, onError: () => 'No se pudo generar una respuesta. Reintenta el mismo mensaje.' }).getReader()
    // Buffer the AI SDK stream until its final assistant message commits.
    // A disconnect does not cancel accepted server work. Failed persistence
    // produces an observable HTTP error, never a displayed ghost assistant.
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      if (value.type === 'error' || value.type === 'abort') throw new Error('generation_failed')
      chunks.push(value)
      if (JSON.stringify(chunks).length > 100_000) { await reader.cancel(); throw new Error('response_limit') }
    }
    if (!responseMessage?.parts.length || (toolContinuationRequired && !validToolContinuation)) throw new Error('empty_response')
    const expiredOnCompletion = isSessionExpired(session)
    if (!closeReason && expiredOnCompletion) { closeReason = crisis.detected ? 'crisis_detected' : 'time_limit'; proposal = null }
    if (closureClarification && !closeReason) {
      const text = `\n\n${closureClarification}`
      const id = `server-close-clarification-${requestId}`
      responseMessage.parts.push({ type: 'text', text })
      chunks.splice(chunks.length - 1, 0, { type: 'text-start', id }, { type: 'text-delta', id, delta: text }, { type: 'text-end', id })
    }
    if (closeReason) {
      if (closeReason === 'time_limit' || expiredOnCompletion) {
        const text = `\n\n${timeClosureText}${closeReason === 'crisis_detected' ? `\n\n${crisisResourcesText}` : ''}`, id = `server-time-close-${requestId}`
        responseMessage.parts.push({ type: 'text', text })
        chunks.splice(chunks.length - 1, 0, { type: 'text-start', id }, { type: 'text-delta', id, delta: text }, { type: 'text-end', id })
      }
      markClosed(responseMessage.parts, chunks, closeReason)
    }
    awaitingGeneration = false
    const { error } = await service.rpc('finish_chat_turn', { p_session_id: sessionId, p_request_id: requestId, p_token: token, p_parts: responseMessage.parts as Json, p_chunks: chunks as unknown as Json, p_proposal: proposal ?? undefined, p_close_reason: closeReason ?? undefined })
    if (error) throw error
    if (closeReason) void enqueueAssessmentGeneration({ sessionId }).catch(() => console.error('[chat] outbox recovery pending'))
    return replay(chunks)
  } catch (error) {
    if (awaitingGeneration && generationTimeExpired) {
      awaitingGeneration = false
      try { return await finishStaticReply(closeReason === 'crisis_detected' || crisis.detected ? 'crisis_detected' : 'time_limit') }
      catch { /* Ambiguous persistence follows the same fenced recovery path. */ }
    }
    // Only a model-generation failure may use this fallback. A failed/ambiguous
    // final write must keep the existing retry contract, never replace a
    // possibly committed contextual response with different text.
    if (pilot && crisis.detected && awaitingGeneration) {
      try { return await finishStaticReply(null) }
      catch { /* Record failed persistence using the normal fenced path below. */ }
    }
    const { error: persistenceError } = await service.rpc('fail_chat_turn', { p_session_id: sessionId, p_request_id: requestId, p_token: token, p_error: error instanceof Error && error.message === 'context_limit' ? 'context_limit' : 'turn_failed' })
    console.error('[chat] turn failed', { requestId, failureRecorded: !persistenceError })
    return Response.json({ error: 'No se pudo completar el turno. Reintenta el mismo mensaje o recarga.', requestId }, { status: 503 })
  }
}

type SupabaseClient = Awaited<ReturnType<typeof createAuthenticatedClient>>

async function buildQuestionnaireResultNotice(
  supabase: SupabaseClient,
  sessionId: string,
  openedAt: string,
  conversationId: string,
): Promise<string> {
  const { data: instance } = await supabase
    .from('questionnaire_instances')
    .select('id, questionnaire_id, status, scored_at')
    .eq('session_id', sessionId)
    .eq('status', 'scored')
    .gte('scored_at', openedAt)
    .order('scored_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!instance || !instance.scored_at) return ''

  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('role', 'assistant')
    .gt('created_at', instance.scored_at)

  if (count && count > 0) return ''

  const [{ data: def }, { data: result }] = await Promise.all([
    supabase
      .from('questionnaire_definitions')
      .select('code')
      .eq('id', instance.questionnaire_id)
      .single(),
    supabase
      .from('questionnaire_results')
      .select('total_score, severity_band, flags_json')
      .eq('instance_id', instance.id)
      .single(),
  ])

  if (!def || !result) return ''

  const flags = Array.isArray(result.flags_json)
    ? (result.flags_json as Array<{ reason: string; itemOrder: number }>)
    : []
  const acute = flags.some((f) => f.reason === 'acute_risk')

  if (def.code === 'CSSRS' && acute) {
    return `[RESULTADO DE CUESTIONARIO — C-SSRS — RIESGO AGUDO]
El cribado C-SSRS registra una señal de riesgo agudo. Activa el protocolo de crisis AHORA: valida sin alarmismo, ofrece la Línea 024 textualmente, marca para revisión clínica inmediata, y considera llamar a close_session_crisis si el riesgo es inmediato. NO propongas otros cuestionarios ni sigas la exploración normal. NUNCA confirmes un cierre por crisis: es single-step.

---

`
  }

  const flagsLabel =
    flags.length === 0
      ? 'ninguno'
      : flags.map((f) => `${f.reason} (item ${f.itemOrder})`).join(', ')

  return `[RESULTADO DE CUESTIONARIO — ${def.code}]
Puntuación: ${result.total_score} (${result.severity_band}).
Flags: ${flagsLabel}.
El paciente ha completado el cuestionario. Acknowledge con tacto, valida el esfuerzo, explícale qué significa la puntuación en términos no clínicos (sin citar cifras), y continúa la sesión. NO diagnostiques. Menciona que tu psicólogo revisará el informe.

---

`
}
