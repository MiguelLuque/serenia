import { createAuthenticatedClient } from '@/lib/supabase/server'
import { getActiveInstanceForSession } from '@/lib/questionnaires/service'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ instanceId: string }> },
) {
  const { instanceId } = await params
  const supabase = await createAuthenticatedClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: instance, error } = await supabase
    .from('questionnaire_instances')
    .select()
    .eq('id', instanceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !instance) return new Response('Not found', { status: 404 })

  const { data: definition, error: defError } = await supabase
    .from('questionnaire_definitions')
    .select()
    .eq('id', instance.questionnaire_id)
    .single()

  if (defError) return new Response('Not found', { status: 404 })

  const { data: items, error: itemsError } = await supabase
    .from('questionnaire_items')
    .select()
    .eq('questionnaire_id', instance.questionnaire_id)
    .order('order_index', { ascending: true })

  if (itemsError) return new Response('Error', { status: 500 })

  const { data: result } = await supabase
    .from('questionnaire_results')
    .select()
    .eq('instance_id', instance.id)
    .maybeSingle()

  return Response.json({
    instance,
    definition,
    items: items ?? [],
    result,
  })
}

// Re-exported helper for tests and chat route
export { getActiveInstanceForSession }
