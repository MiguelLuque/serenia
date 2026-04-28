import { convertToModelMessages, streamText, tool, type UIMessage } from 'ai'
import { z } from 'zod'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { llm } from '@/lib/llm/models'
import { getSessionTherapistPrompt } from '@/lib/llm/prompts'
import {
  touchSession,
  closeSession,
  isSessionExpired,
} from '@/lib/sessions/service'
import { saveUserMessage, saveAssistantMessage } from '@/lib/sessions/messages'
import { detectCrisis } from '@/lib/chat/crisis-detector'
import { hasPriorSafetyCheck } from '@/lib/chat/safety-check-history'
import { detectFarewellWithoutCloseTool } from '@/lib/chat/farewell-detector'
import {
  createInstance,
  getActiveInstanceForSession,
} from '@/lib/questionnaires/service'
import type { QuestionnaireCode } from '@/lib/questionnaires/types'
import { buildPatientContext } from '@/lib/patient-context/builder'
import { assemblePlan6ContextPieces } from '@/lib/chat/assemble-plan6-prompt'
import { buildChatSystemPrompt } from '@/lib/chat/system-prompt'
import { logContextInjection } from '@/lib/patient-context/telemetry'

export const maxDuration = 60

const BodySchema = z.object({
  sessionId: z.string().uuid(),
  messages: z.array(z.any()),
})

export async function POST(req: Request) {
  const supabase = await createAuthenticatedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = BodySchema.parse(await req.json())
  const { sessionId, messages } = body as { sessionId: string; messages: UIMessage[] }

  const { data: session, error } = await supabase
    .from('clinical_sessions')
    .select('id, user_id, conversation_id, status, opened_at, last_activity_at')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()
  if (error || !session) return new Response('Session not found', { status: 404 })
  if (session.status !== 'open') return new Response('Session not active', { status: 409 })

  if (isSessionExpired({ opened_at: session.opened_at })) {
    await closeSession(supabase, sessionId, 'time_limit')
    return Response.json(
      {
        closed: true,
        reason: 'time_limit',
        message:
          'Se ha alcanzado el límite de tiempo de la sesión. He preparado las notas para que tu psicólogo las revise. Nos vemos en la próxima sesión.',
      },
      { status: 200 },
    )
  }

  await touchSession(supabase, sessionId)

  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  const lastUserText = extractText(lastUser)
  if (lastUserText) {
    await saveUserMessage(supabase, {
      conversationId: session.conversation_id,
      sessionId,
      text: lastUserText,
    })
  }

  const crisis = lastUserText
    ? detectCrisis(lastUserText)
    : { detected: false, matchedTerms: [] }

  const elapsedMs = Date.now() - new Date(session.opened_at).getTime()
  const minutesRemaining = Math.max(
    0,
    Math.ceil((60 * 60 * 1000 - elapsedMs) / 60_000),
  )
  const timeNotice =
    minutesRemaining <= 10
      ? minutesRemaining >= 5
        ? `[AVISO DE TIEMPO]
Quedan ${minutesRemaining} minutos de la sesión. Empieza a cerrar con calma: resume lo hablado, pregunta cómo se va el paciente, y llama a propose_close_session con reason='time_limit' junto al texto de propuesta. No llames a confirm_close_session hasta que el paciente acepte.

---

`
        : `[AVISO DE TIEMPO]
Quedan ${minutesRemaining} minutos de la sesión. Avisa al paciente por texto ("nos quedan X min, ¿cerramos o aprovechas el rato?") pero NO llames a ningún tool de cierre todavía. Si llega el límite duro, el sistema cerrará automáticamente.

---

`
      : ''

  const basePrompt = getSessionTherapistPrompt()

  // Plan 7 T3a + T3d — anti-repetición + degradar el imperativo del notice.
  //
  // Si el detector léxico matchea, comprobamos si en los últimos N mensajes
  // de la sesión ya ha habido un check de seguridad por parte del asistente.
  // - Sin check previo  → notice contextual (no imperativo): el LLM decide
  //   si la verbalización justifica activar el protocolo, leyendo el
  //   contexto. Esto evita que palabras como "desbordado" disparen el
  //   protocolo de suicidio cuando el contexto es estrés laboral.
  // - Con check previo  → notice "ya hice check": prohíbe re-preguntar por
  //   reaparición de palabras emocionales; solo activar si hay señal NUEVA
  //   y específica (plan, intención, medios).
  //
  // El helper `hasPriorSafetyCheck` traga errores y devuelve false → si la
  // BD hipa, caemos al notice imperativo (failsafe seguro).
  let crisisNotice = ''
  if (crisis.detected) {
    const safetyCheckAlreadyDone = await hasPriorSafetyCheck(supabase, sessionId)
    if (safetyCheckAlreadyDone) {
      crisisNotice = `[CONTEXTO DE SEGURIDAD — CHECK YA REALIZADO]
Ya preguntaste por seguridad en esta sesión y tienes la respuesta del paciente en el historial. NO vuelvas a preguntar en este turno solo porque hayan reaparecido palabras como "desbordado", "desaparecer", o similares. Lee el chat para ver la respuesta del paciente y úsala. Si la respuesta fue "no riesgo", valida lo que cuenta y sigue con el tema actual. Solo vuelve a preguntar si aparece señal NUEVA Y específica de riesgo: verbalización clara de plan, intención o medios concretos. Reaparición de palabras emocionales no cuenta. (Términos detectados este turno: ${crisis.matchedTerms.join(', ')}.)

---

`
    } else {
      crisisNotice = `[AVISO DE SEGURIDAD — POSIBLE SEÑAL]
El último mensaje contiene palabras que pueden indicar riesgo emocional (${crisis.matchedTerms.join(', ')}). Lee el contexto antes de decidir si hace falta un check de seguridad: si el paciente las usa hablando de estrés laboral, conflicto relacional o sobrecarga emocional general, NO conviertas eso en check de suicidio. Solo activa el protocolo de seguridad (validar, ofrecer la Línea 024 textualmente, marcar la sesión para revisión del psicólogo, considerar close_session_crisis) si la verbalización del paciente sugiere ideación suicida directa, plan, intención o medios concretos. NUNCA confirmes un cierre por crisis: es single-step.

---

`
    }
  }

  const questionnaireNotice = await buildQuestionnaireResultNotice(
    supabase,
    session.id,
    session.opened_at,
    session.conversation_id,
  )

  // ── Plan 6 T10: cross-session continuity (feature-flagged) ─────────────────
  // When FEATURE_CROSS_SESSION_CONTEXT === 'on', build a patient-context block
  // from prior-session data, derive a risk-state opening notice, and record a
  // telemetry row via the service role.
  //
  // Degradation: if buildPatientContext (or the assembly that follows) throws
  // — e.g. a DB hiccup, query timeout, unexpected RLS error — we log and fall
  // back to flag-off behavior (empty block + empty notice) so /api/chat never
  // 500s on a telemetry/context regression. Pre-Plan-6 the same DB hiccup did
  // not break the chat; we preserve that contract.
  //
  // Telemetry: fire-and-forget — the handler never awaits the insert, so a
  // service-role lock or latency spike cannot slow down the user's turn.
  // Failures are logged to stderr; see docs/operations/feature-flags.md.
  const featureOn = process.env.FEATURE_CROSS_SESSION_CONTEXT === 'on'
  let patientContextBlock = ''
  let riskOpeningNotice = ''
  if (featureOn) {
    try {
      const ctx = await buildPatientContext(supabase, user.id)
      const pieces = assemblePlan6ContextPieces(ctx)
      patientContextBlock = pieces.patientContextBlock
      riskOpeningNotice = pieces.riskOpeningNotice

      void logContextInjection({
        userId: user.id,
        sessionId: session.id,
        ...pieces.telemetry,
      }).catch((err) => {
        console.error('[context-telemetry]', err)
      })
    } catch (err) {
      console.error('[patient-context]', err)
      patientContextBlock = ''
      riskOpeningNotice = ''
    }
  }

  const systemPrompt = buildChatSystemPrompt({
    basePrompt,
    riskOpeningNotice,
    crisisNotice,
    questionnaireNotice,
    timeNotice,
    patientContextBlock,
  })

  const proposeQuestionnaireTool = tool({
    description:
      'Propone un cuestionario clínico validado cuando la conversación lo justifica. Usa solo si hay señales claras: ánimo bajo sostenido => PHQ9, ansiedad sostenida => GAD7, ideación suicida (directa o indirecta) => ASQ. Nunca más de uno por sesión.',
    inputSchema: z.object({
      code: z.enum(['PHQ9', 'GAD7', 'ASQ']),
      reason: z.string().min(10).max(300),
    }),
    execute: async ({ code, reason }) => {
      const existing = await getActiveInstanceForSession(supabase, sessionId)
      if (existing) {
        return { skipped: true, reason: 'already_active' as const }
      }
      const inst = await createInstance(supabase, {
        userId: user.id,
        sessionId,
        conversationId: session.conversation_id,
        questionnaireCode: code as QuestionnaireCode,
        triggerReason: reason,
      })
      return { proposed: true, code, instanceId: inst.id }
    },
  })

  // ── Session-close tools: two-step for non-crisis, single-step for crisis ────
  //
  // `propose_close_session` has NO side-effects on the DB. The IA emits it
  // alongside a conversational proposal so the patient can accept or reject.
  // Only after explicit acceptance in the next turn does the IA call
  // `confirm_close_session`, which actually invokes closeSession() and
  // triggers the assessment generation.
  //
  // `close_session_crisis` is single-step by design: safety first, no
  // confirmation, closes immediately with reason='crisis_detected'.
  //
  // The reason for a confirmed close is passed again by the model (it must
  // match what it used in propose). We do not persist "pending proposal"
  // server-side — the argument round-trip is the whole contract.
  const proposeCloseSessionTool = tool({
    description:
      'Propone cerrar la sesión al paciente. NO cierra la sesión: solo señala que la IA ha sugerido el cierre en el texto del mismo turno. Tras llamar a este tool, espera la respuesta del paciente. Si acepta, en el siguiente turno llama a confirm_close_session con el mismo reason. Si rechaza, continúa la conversación sin más tool calls.',
    inputSchema: z.object({
      reason: z.enum(['user_request', 'time_limit']),
    }),
    execute: async ({ reason }) => {
      return { proposed: true, reason }
    },
  })

  const confirmCloseSessionTool = tool({
    description:
      'Cierra la sesión actual tras confirmación explícita del paciente. Solo se llama en el turno siguiente a un propose_close_session, si el paciente aceptó. Pasa el mismo reason que usaste en propose_close_session.',
    inputSchema: z.object({
      reason: z.enum(['user_request', 'time_limit']),
    }),
    execute: async ({ reason }) => {
      await closeSession(supabase, sessionId, reason)
      return { closed: true, reason }
    },
  })

  const closeSessionCrisisTool = tool({
    description:
      'Cierra la sesión inmediatamente por protocolo de crisis. Usar solo tras haber dado la copy de seguridad (Línea 024) y cuando el riesgo es inmediato. NUNCA confirma: safety first.',
    inputSchema: z.object({}),
    execute: async () => {
      await closeSession(supabase, sessionId, 'crisis_detected')
      return { closed: true, reason: 'crisis_detected' as const }
    },
  })

  const result = streamText({
    model: llm.conversational(),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: {
      propose_close_session: proposeCloseSessionTool,
      confirm_close_session: confirmCloseSessionTool,
      close_session_crisis: closeSessionCrisisTool,
      propose_questionnaire: proposeQuestionnaireTool,
    },
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ responseMessage }) => {
      // Persist the FULL UIMessage parts payload — text, tool calls, tool
      // results, reasoning, etc. Without this, reloads or rehydration drop
      // every tool part and `detectServerClose(messages)` (and any other
      // tool-call-aware logic) breaks. See plan-7 T1.
      if (
        responseMessage.role !== 'assistant' ||
        !Array.isArray(responseMessage.parts) ||
        responseMessage.parts.length === 0
      ) {
        return
      }
      try {
        await saveAssistantMessage(supabase, {
          conversationId: session.conversation_id,
          sessionId,
          parts: responseMessage.parts,
        })
      } catch (err) {
        // onFinish runs in the stream flush; throwing here swallows silently
        // and produces a "ghost" turn (cliente ve la respuesta, BD no la
        // tiene). Log loud so we notice in stderr / observability.
        console.error('[chat-onfinish-persist]', {
          sessionId,
          error: err instanceof Error ? err.message : String(err),
        })
      }

      // Plan 7 T3c — audit: si el asistente emitió frase de despedida
      // ("lo dejamos aquí", "cuídate", "hasta la próxima") sin haber
      // llamado a un tool de cierre en el mismo turno, dejamos rastro.
      // No bloquea; el primer fix es endurecer el prompt.
      try {
        if (detectFarewellWithoutCloseTool(responseMessage.parts)) {
          console.warn('[chat-onfinish] assistant emitió despedida sin tool de cierre', {
            sessionId,
          })
        }
      } catch {
        // Defensa: nunca dejar que la heurística rompa onFinish.
      }
    },
  })
}

function extractText(message: UIMessage | undefined): string {
  if (!message) return ''
  if (!Array.isArray(message.parts)) return ''
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p?.type === 'text')
    .map((p) => p.text ?? '')
    .join('')
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

  if (def.code === 'ASQ' && acute) {
    return `[RESULTADO DE CUESTIONARIO — ASQ — RIESGO AGUDO]
El item 5 del ASQ es positivo. Activa el protocolo de crisis AHORA: valida sin alarmismo, ofrece la Línea 024 textualmente, marca para revisión clínica inmediata, y considera llamar a close_session_crisis si el riesgo es inmediato. NO propongas otros cuestionarios ni sigas la exploración normal. NUNCA confirmes un cierre por crisis: es single-step.

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
