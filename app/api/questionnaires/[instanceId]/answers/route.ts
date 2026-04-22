import { createAuthenticatedClient } from '@/lib/supabase/server'
import { submitAnswers } from '@/lib/questionnaires/service'
import type { AnswerInput } from '@/lib/questionnaires/types'

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

  const body = (await req.json()) as { answers?: AnswerInput[] }
  if (!body.answers || !Array.isArray(body.answers) || body.answers.length === 0) {
    return new Response('Invalid answers', { status: 400 })
  }

  try {
    const result = await submitAnswers(supabase, {
      instanceId,
      answers: body.answers,
    })
    return Response.json({ result })
  } catch (err) {
    console.error('[answers POST] failed', { instanceId, err })
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Unknown error'
    return new Response(message, { status: 400 })
  }
}
