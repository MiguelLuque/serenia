import { convertToModelMessages, streamText, tool, type UIMessage } from 'ai'
import { z } from 'zod'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { llm } from '@/lib/llm/models'
import { getSessionTherapistPrompt } from '@/lib/llm/prompts'
import {
  touchSession,
  closeSession,
  isSessionExpired,
  type CloseReason,
} from '@/lib/sessions/service'
import { saveUserMessage, saveAssistantMessage } from '@/lib/sessions/messages'
import { detectCrisis } from '@/lib/chat/crisis-detector'
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
      ? `[AVISO DE TIEMPO]
Quedan ${minutesRemaining} minutos de la sesión. Empieza a cerrar si procede: resume lo hablado, pregunta cómo se va el paciente, y despídete. Si llegas al límite, llama a close_session con reason='time_limit'.

---

`
      : ''

  const basePrompt = getSessionTherapistPrompt()
  const crisisNotice = crisis.detected
    ? `[AVISO DE SEGURIDAD — ALERTA ACTIVADA]
El último mensaje del paciente contiene señales de crisis (${crisis.matchedTerms.join(', ')}). Activa el protocolo de crisis AHORA: valida, mide riesgo con calma, ofrece la Línea 024 textualmente, marca la sesión para revisión del psicólogo, y considera llamar a close_session con reason='crisis_detected' si el riesgo es inmediato.

---

`
    : ''

  const questionnaireNotice = await buildQuestionnaireResultNotice(
    supabase,
    session.id,
    session.opened_at,
    session.conversation_id,
  )

  // ── Plan 6 T10: cross-session continuity (feature-flagged) ─────────────────
  // When FEATURE_CROSS_SESSION_CONTEXT === 'on', build a patient-context block
  // from prior-session data, derive a risk-state opening notice, and record a
  // telemetry row via the service role. The telemetry write is awaited with a
  // `.catch` so the handler never returns before the row lands, but a failed
  // insert never blocks the chat response.
  const featureOn = process.env.FEATURE_CROSS_SESSION_CONTEXT === 'on'
  let patientContextBlock = ''
  let riskOpeningNotice = ''
  if (featureOn) {
    const ctx = await buildPatientContext(supabase, user.id)
    const pieces = assemblePlan6ContextPieces(ctx)
    patientContextBlock = pieces.patientContextBlock
    riskOpeningNotice = pieces.riskOpeningNotice

    await logContextInjection({
      userId: user.id,
      sessionId: session.id,
      ...pieces.telemetry,
    }).catch((err) => {
      console.error('[context-telemetry]', err)
    })
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

  const closeSessionTool = tool({
    description:
      'Cierra la sesión actual. Usar solo cuando el paciente quiera terminar, se alcance el tiempo límite, o el protocolo de crisis lo requiera.',
    inputSchema: z.object({
      reason: z.enum(['user_request', 'time_limit', 'crisis_detected']),
    }),
    execute: async ({ reason }: { reason: CloseReason }) => {
      await closeSession(supabase, sessionId, reason)
      return { closed: true, reason }
    },
  })

  const result = streamText({
    model: llm.conversational(),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: {
      close_session: closeSessionTool,
      propose_questionnaire: proposeQuestionnaireTool,
    },
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ messages: finalMessages }) => {
      const lastAssistant = [...finalMessages]
        .reverse()
        .find((m) => m.role === 'assistant')
      const text = extractText(lastAssistant)
      if (text.trim()) {
        await saveAssistantMessage(supabase, {
          conversationId: session.conversation_id,
          sessionId,
          text,
        })
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
El item 5 del ASQ es positivo. Activa el protocolo de crisis AHORA: valida sin alarmismo, ofrece la Línea 024 textualmente, marca para revisión clínica inmediata, y considera llamar a close_session con reason='crisis_detected' si el riesgo es inmediato. NO propongas otros cuestionarios ni sigas la exploración normal.

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
