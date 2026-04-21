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

  const basePrompt = getSessionTherapistPrompt()
  const systemPrompt = crisis.detected
    ? `[AVISO DE SEGURIDAD — ALERTA ACTIVADA]
El último mensaje del paciente contiene señales de crisis (${crisis.matchedTerms.join(', ')}). Activa el protocolo de crisis AHORA: valida, mide riesgo con calma, ofrece la Línea 024 textualmente, marca la sesión para revisión del psicólogo, y considera llamar a close_session con reason='crisis_detected' si el riesgo es inmediato.

---

${basePrompt}`
    : basePrompt

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
    tools: { close_session: closeSessionTool },
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
