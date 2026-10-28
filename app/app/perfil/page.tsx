import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { ProfileMemoryView } from '@/components/profile/profile-memory'
import { progressiveProfileEnabled } from '@/lib/server/profile/config'
import { createAuthenticatedClient } from '@/lib/server/supabase/server'
import { ProfileMemorySchema, type ProfileMemory } from '@/lib/shared/profile/schema'

const sourceSchema = ProfileMemorySchema.shape.observations.element.pick({
  id: true, quote: true, source_created_at: true,
})

export default async function Page() {
  if (!progressiveProfileEnabled()) notFound()
  let client
  try { client = await createAuthenticatedClient() } catch { return <ProfileMemoryView memory={null} /> }
  const auth = await client.auth.getUser().catch(() => null)
  if (!auth || auth.error || !auth.data.user) redirect('/login')
  const { data: ready, error: readinessError } = await client.rpc('get_onboarding_ready')
    .then(result => result, () => ({ data: null, error: true }))
  if (readinessError) return <ProfileMemoryView memory={null} />
  if (ready !== true) redirect('/onboarding')

  let memory: ProfileMemory | null = null
  try {
    const { data, error } = await client.rpc('get_profile_memory')
    const parsed = ProfileMemorySchema.safeParse(data)
    if (!error && parsed.success) memory = parsed.data
  } catch { /* Keep profile loading failures separate from the conversation. */ }
  if (!memory) return <ProfileMemoryView memory={null} />
  const presentIds = new Set(memory.observations.map(observation => observation.id))
  const missingIds = [...new Set(memory.observations
    .filter(observation => observation.status === 'pending' && observation.supersedes_id && !presentIds.has(observation.supersedes_id))
    .map(observation => observation.supersedes_id!))]
  const replacementSources: Record<string, { quote: string; source_created_at: string }> = {}
  if (missingIds.length) {
    try {
      // The consistent projection is bounded; fetch only absent correction sources,
      // through the same authenticated client, explicit owner filter and existing RLS.
      const { data: sources, error: sourceError } = await client.from('profile_observations')
        .select('id,quote,source_created_at').eq('user_id', auth.data.user.id)
        .in('id', missingIds).limit(missingIds.length)
      const parsedSources = z.array(sourceSchema).max(missingIds.length).safeParse(sources)
      if (!sourceError && parsedSources.success) {
        for (const source of parsedSources.data) {
          if (missingIds.includes(source.id)) replacementSources[source.id] = { quote: source.quote, source_created_at: source.source_created_at }
        }
      }
    } catch { /* The view explicitly explains an unavailable earlier quote. */ }
  }
  return <ProfileMemoryView memory={memory} replacementSources={replacementSources} />
}
