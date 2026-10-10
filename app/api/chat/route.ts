import { convertToModelMessages, createUIMessageStreamResponse, streamText, tool, type UIMessage, type UIMessageChunk } from 'ai'
import { z } from 'zod'
import { createAuthenticatedClient } from '@/lib/server/supabase/server'
import { requireOwnedSession } from '@/lib/server/sessions/authorization'
import { llm } from '@/lib/shared/llm/models'
import { getSessionTherapistPrompt } from '@/lib/server/llm/prompts'
import { isSessionExpired } from '@/lib/server/sessions/service'
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

export const maxDuration = 60

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
  const crisis = detectCrisis(lastUserText)
  const { data: claim, error: claimError } = await service.rpc('begin_chat_turn', { p_session_id: sessionId, p_user_id: user.id, p_request_id: requestId, p_text: lastUserText, p_crisis: crisis.detected, p_urgent: crisis.detected && hasHighSignalTerm(crisis.matchedTerms) })
  if (claimError) return Response.json({ error: 'El turno no está disponible. Reintenta el mismo mensaje o recarga.', requestId }, { status: claimError.code === '55P03' ? 409 : 422 })
  const turn = claim as { replay: boolean; token: string; chunks?: UIMessageChunk[]; urgent?: boolean; userMessageId: string }
  if (turn.replay) return replay(turn.chunks ?? [])
  const token = turn.token
  const expired = isSessionExpired(session)
  const finishStaticReply = async (closeReason: 'crisis_detected' | 'time_limit' | null) => {
    const text = crisis.detected
      ? `Lo que cuentas necesita apoyo inmediato. Puedes llamar a la ${SAFETY_RESOURCES.suicide.name} (${SAFETY_RESOURCES.suicide.description}). Si estás en peligro inmediato, llama al ${SAFETY_RESOURCES.emergency.phone}. No esperes a completar un cuestionario para pedir ayuda. La señal queda registrada para revisión clínica.`
      : 'Se ha alcanzado el límite de tiempo de la sesión. La sesión se cerrará y el informe quedará pendiente de revisión clínica.'
    const response = staticReply(`assistant-${requestId}`, text)
    const { error } = await service.rpc('finish_chat_turn', { p_session_id: sessionId, p_request_id: requestId, p_token: token, p_parts: response.parts as Json, p_chunks: response.chunks as unknown as Json, p_close_reason: closeReason })
    if (error) throw error
    if (closeReason) void enqueueAssessmentGeneration({ sessionId }).catch(() => console.error('[chat] outbox recovery pending'))
    return replay(response.chunks)
  }
  const prepareContext = async () => {
    const { data: rows, error: historyError } = await service.from('messages').select('id, role, parts, created_at').eq('session_id', sessionId).eq('conversation_id', session.conversation_id).order('created_at', { ascending: true }).order('id', { ascending: true }).limit(161)
    if (historyError) throw historyError
    if (!rows || rows.length >= 161 || !rows.some(row => row.id === turn.userMessageId)) throw new Error('context_limit')
    // Only persisted server data contributes history. Full tool parts are
    // retained for UI rehydration; model history contains conversational text.
    const messages: UIMessage[] = (rows ?? []).filter(row => row.role === 'user' || row.role === 'assistant').map(row => ({ id: row.id, role: row.role as 'user' | 'assistant', parts: (Array.isArray(row.parts) ? row.parts : []).flatMap(part => part && typeof part === 'object' && !Array.isArray(part) && part.type === 'text' && typeof part.text === 'string' ? [{ type: 'text' as const, text: part.text }] : []) })).filter(message => message.parts.length > 0)
    checkContextBudget(messages)
    const safetyState = await getSessionSafetyState(supabase, sessionId, session.opened_at)
    const crisisNotice = buildCrisisNotice({ safetyState, crisis })
    const questionnaireNotice = await buildQuestionnaireResultNotice(supabase, sessionId, session.opened_at, session.conversation_id)
    const minutesRemaining = Math.max(0, Math.ceil((60*60*1000 - (Date.now()-new Date(session.opened_at).getTime()))/60_000))
    const timeNotice = minutesRemaining <= 10 ? `[AVISO DE TIEMPO] Quedan ${minutesRemaining} minutos. Propón un cierre tranquilo y espera aceptación explícita en el siguiente turno. El backend aplica el límite duro después de registrar cualquier señal nueva.\n` : ''
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
    const systemPrompt = buildChatSystemPrompt({ basePrompt: getSessionTherapistPrompt(), riskOpeningNotice, crisisNotice, questionnaireNotice, timeNotice, intakeBlock, patientContextBlock, protocolPhaseBlock })
    checkContextBudget([systemPrompt, ...messages])
    return { messages, systemPrompt }
  }
  try {
    // Accepted text/risk already committed. Urgent/time-limit responses do
    // not depend on history, prompt loading or optional context availability.
    if (expired || turn.urgent) return await finishStaticReply(expired ? crisis.detected ? 'crisis_detected' : 'time_limit' : null)
    let context: Awaited<ReturnType<typeof prepareContext>>
    try { context = await prepareContext() }
    catch (error) {
      if (!crisis.detected) throw error
      // Preserve the existing budget fallback closure criterion. A context
      // outage alone does not introduce a new reason to close the session.
      return await finishStaticReply(error instanceof Error && error.message === 'context_limit' ? 'crisis_detected' : null)
    }
    const { messages, systemPrompt } = context
    const patientCodes = listPatientCodes()
    let proposal: string | null = null
    let closeReason: string | null = null
    const close = async (reason: string) => {
      const { data, error } = await service.rpc('close_chat_turn', { p_session_id: sessionId, p_request_id: requestId, p_token: token, p_reason: reason })
      if (error) throw error
      if (!data) return { closed: false, reason: 'confirmation_required' }
      closeReason = reason
      return { closed: true, reason }
    }
    const result = streamText({
      model: llm.conversational(), system: systemPrompt,
      messages: await convertToModelMessages(messages),
      maxOutputTokens: 2500, maxRetries: 0, abortSignal: AbortSignal.timeout(45_000),
      tools: {
        propose_close_session: tool({ description: 'Propone cierre por user_request o time_limit. Espera aceptación explícita del siguiente turno antes de confirmar.', inputSchema: z.object({ reason: z.enum(['user_request','time_limit']) }), execute: async ({ reason }) => { proposal = reason; return { proposed: true, reason } } }),
        confirm_close_session: tool({ description: 'Confirma exclusivamente la propuesta anterior con el mismo motivo y aceptación explícita del turno siguiente.', inputSchema: z.object({ reason: z.enum(['user_request','time_limit']) }), execute: async ({ reason }) => acceptsClosure(lastUserText) ? close(reason) : { closed: false, reason: 'confirmation_required' } }),
        close_session_crisis: tool({ description: 'Cierra por señal de crisis registrada, sin pedir aceptación. Da primero los recursos de seguridad.', inputSchema: z.object({}), execute: async () => close('crisis_detected') }),
        propose_questionnaire: tool({ description: 'Propone PHQ9 o GAD7 para screening y BDI2/BAI para profundización tras primario moderado. C-SSRS (CSSRS) tiene prioridad ante señal suicida/autolesión. Los cuestionarios scored no bloquean otros; como máximo un cuestionario pendiente. Anuncia por texto y espera consentimiento, excepto la atención urgente a seguridad.', inputSchema: z.object({ code: z.enum(patientCodes as [QuestionnaireCode,...QuestionnaireCode[]]), reason: z.string().min(10).max(300) }), execute: async ({ code, reason }) => {
          if (code !== 'CSSRS' && await getActiveInstanceForSession(supabase, sessionId)) return { skipped: true, reason: 'already_active' }
          const instance = await createInstance(supabase, { userId: user.id, sessionId, conversationId: session.conversation_id, questionnaireCode: code, triggerReason: reason, requestId, turnToken: token })
          return { proposed: true, code, instanceId: instance.id }
        } }),
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
    if (!responseMessage?.parts.length) throw new Error('empty_response')
    const { error } = await service.rpc('finish_chat_turn', { p_session_id: sessionId, p_request_id: requestId, p_token: token, p_parts: responseMessage.parts as Json, p_chunks: chunks as unknown as Json, p_proposal: proposal, p_close_reason: closeReason })
    if (error) throw error
    if (closeReason) void enqueueAssessmentGeneration({ sessionId }).catch(() => console.error('[chat] outbox recovery pending'))
    return replay(chunks)
  } catch (error) {
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
