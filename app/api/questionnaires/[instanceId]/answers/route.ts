import { createAuthenticatedClient } from '@/lib/supabase/server'
import { submitAnswers } from '@/lib/questionnaires/service'
import { SubmitAnswersSchema } from '@/lib/questionnaires/schema'

// Plan 8 Bloque 2 Fix 4 — validación zod + no-leak de errores técnicos.
// El handler antes:
//   - solo chequeaba Array.isArray(body.answers): un cliente podía enviar
//     answers con shape inválido (itemOrder string, valueNumeric null) y el
//     payload llegaba sin filtrado al insert.
//   - el catch devolvía err.message crudo al cliente, filtrando texto
//     interno como "ASQ item 5 value must be 0 or 1".
// Ahora:
//   - safeParse con SubmitAnswersSchema (lib/questionnaires/schema.ts).
//   - mensaje de error genérico "No se pudo procesar el cuestionario";
//     detalle técnico se loggea server-side para ops.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ instanceId: string }> },
) {
  const { instanceId } = await params
  const supabase = await createAuthenticatedClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: instance, error: instanceError } = await supabase
    .from('questionnaire_instances')
    .select('id, user_id, status')
    .eq('id', instanceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (instanceError || !instance) {
    return new Response('Not found', { status: 404 })
  }

  if (instance.status === 'scored' || instance.status === 'cancelled') {
    return new Response('Instance already closed', { status: 409 })
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch (err) {
    console.warn('[answers POST] invalid JSON body', {
      instanceId,
      error: err instanceof Error ? err.message : String(err),
    })
    return Response.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const parsed = SubmitAnswersSchema.safeParse(rawBody)
  if (!parsed.success) {
    console.warn('[answers POST] schema validation failed', {
      instanceId,
      issues: parsed.error.issues,
    })
    return Response.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  try {
    const result = await submitAnswers(supabase, {
      instanceId,
      answers: parsed.data.answers,
    })
    return Response.json({ result })
  } catch (err) {
    // No filtrar el mensaje técnico al cliente — el detalle (ej. "ASQ item 5
    // value must be 0 or 1") es información de implementación útil sólo
    // para ops/observabilidad. El cliente recibe un mensaje genérico.
    console.error('[answers POST] failed', {
      instanceId,
      error: err instanceof Error ? err.message : String(err),
    })
    return Response.json(
      { error: 'No se pudo procesar el cuestionario' },
      { status: 400 },
    )
  }
}
