import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/shared/supabase/types'
import { AnswerSchema } from '@/lib/shared/questionnaires/schema'

const Identifier = z.string().min(1).max(128)
const Instances = z.array(z.object({
  id: Identifier,
  questionnaire_id: Identifier,
  status: z.literal('scored'),
})).max(100)
const Definition = z.object({ code: z.string().min(1).max(64), name: z.string().min(1).max(256) })
const Result = z.object({
  // Operational bounds from 50 items with numeric answers <= 10. These are
  // decoding limits, not a new scoring algorithm or clinical interpretation.
  total_score: z.number().finite().min(0).max(500),
  severity_band: z.string().min(1).max(64),
  flags_json: z.array(z.object({
    itemOrder: AnswerSchema.shape.itemOrder,
    // Exact persisted QuestionnaireFlag contract; the chat parser deliberately
    // tolerates malformed flags and cannot serve this fail-closed boundary.
    reason: z.enum(['suicidality', 'acute_risk']),
  }).strict()).max(50),
})

function decode<T>(schema: z.ZodType<T>, value: unknown, source: string): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new Error(`Invalid persisted questionnaire ${source}`)
  return parsed.data
}

/** Authoritative scored facts, ordered by instance ID; repeated codes retain
 * their separate results. Successful empty reads yield [], failed/partial reads
 * throw so writers cannot turn unavailable scoring data into a successful draft.
 */
export async function loadQuestionnaireFacts(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  userId: string,
) {
  const { data, error } = await supabase.from('questionnaire_instances')
    .select('id, questionnaire_id, status')
    .eq('session_id', sessionId).eq('user_id', userId).eq('status', 'scored')
    .order('id', { ascending: true })
  if (error) throw error
  const instances = decode(Instances, data, 'instances').sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const facts = []
  for (const instance of instances) {
    const [definitionRead, resultRead] = await Promise.all([
      supabase.from('questionnaire_definitions').select('code, name').eq('id', instance.questionnaire_id).single(),
      supabase.from('questionnaire_results').select('total_score, severity_band, flags_json').eq('instance_id', instance.id).single(),
    ])
    if (definitionRead.error) throw definitionRead.error
    if (resultRead.error) throw resultRead.error
    const definition = decode(Definition, definitionRead.data, 'definition')
    const result = decode(Result, resultRead.data, 'result')
    facts.push({
      instanceId: instance.id,
      name: definition.name,
      report: { code: definition.code, score: result.total_score, band: result.severity_band, flags: result.flags_json },
    })
  }
  return facts
}
