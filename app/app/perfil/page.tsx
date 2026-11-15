import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { ProfileMemoryView } from '@/components/profile/profile-memory'
import { progressiveProfileAvailable, progressiveProfileEnabled } from '@/lib/server/profile/config'
import { createAuthenticatedClient } from '@/lib/server/supabase/server'
import { ProfileMemorySchema, ProfileMemoryCursorSchema, ProfileMemoryPageSchema, type ProfileMemoryPage } from '@/lib/shared/profile/schema'

const sourceSchema = ProfileMemorySchema.shape.observations.element.pick({
  id: true, quote: true, source_created_at: true,
})

const searchSchema = z.union([
  z.strictObject({}),
  z.strictObject({ before_created_at: ProfileMemoryCursorSchema.shape.source_created_at, before_id: ProfileMemoryCursorSchema.shape.id }),
])

export default async function Page({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
} = {}) {
  if (!progressiveProfileAvailable()) notFound()
  let client
  try { client = await createAuthenticatedClient() } catch { return <ProfileMemoryView memory={null} /> }
  const auth = await client.auth.getUser().catch(() => null)
  if (!auth || auth.error || !auth.data.user) redirect('/login')
  if (!progressiveProfileEnabled(process.env, auth.data.user.id)) notFound()
  const { data: ready, error: readinessError } = await client.rpc('get_onboarding_ready')
    .then(result => result, () => ({ data: null, error: true }))
  if (readinessError) return <ProfileMemoryView memory={null} />
  if (ready !== true) redirect('/onboarding')

  const search = searchSchema.safeParse(await searchParams ?? {})
  if (!search.success) redirect('/app/perfil')
  const cursor = 'before_id' in search.data ? search.data : null
  const pageKey = cursor ? `${cursor.before_created_at}:${cursor.before_id}` : 'recent'
  let memory: ProfileMemoryPage | null = null
  try {
    const { data, error } = await client.rpc('get_profile_memory_page', cursor ? { p_before_created_at: cursor.before_created_at, p_before_id: cursor.before_id } : {})
    const parsed = ProfileMemoryPageSchema.safeParse(data)
    if (!error && parsed.success) memory = parsed.data
  } catch { /* Keep profile loading failures separate from the conversation. */ }
  if (!memory) return <ProfileMemoryView key={pageKey} memory={null} isOlderPage={cursor !== null} />
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
  return <ProfileMemoryView key={pageKey} memory={memory} replacementSources={replacementSources} isOlderPage={cursor !== null} />
}
