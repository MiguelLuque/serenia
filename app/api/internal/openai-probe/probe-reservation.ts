import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/shared/supabase/types'

/** One INSERT without retry. A lost response is uncertain and must never win. */
export async function reserveOnce(client: SupabaseClient<Database>): Promise<boolean> {
  const { error } = await client.from('audit_log').insert({
    id: 'f7c9c98c-bc13-48af-9808-bad1f0daaa7f',
    actor_type: 'system', entity_type: 'ai_transport_probe', action: 'reserved',
  }).retry(false).abortSignal(AbortSignal.timeout(10_000))
  return error === null
}
