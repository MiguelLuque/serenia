'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAuthenticatedClient } from '@/lib/server/supabase/server'
import { progressiveProfileAvailable, progressiveProfileEnabled } from '@/lib/server/profile/config'

export type ProfileActionResult = { ok: true } | { ok: false; error: string; conflict?: true }
const reviewSchema = z.strictObject({
  observationId: z.uuid(),
  action: z.enum(['confirm', 'reject']),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
})
const unavailable = { ok: false, error: 'No se pudo guardar el cambio. Inténtalo de nuevo.' } as const

async function ownerClient() {
  const client = await createAuthenticatedClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user || !progressiveProfileEnabled(process.env, user.id)) return null
  const { data: ready, error: readinessError } = await client.rpc('get_onboarding_ready')
  return !readinessError && ready === true ? client : null
}

export async function setProfileEnabledAction(input: unknown): Promise<ProfileActionResult> {
  if (!progressiveProfileAvailable()) return unavailable
  if (typeof input !== 'boolean') return unavailable
  try {
    const client = await ownerClient()
    if (!client) return unavailable
    const { error } = await client.rpc('set_profile_enabled', { p_enabled: input })
    if (error) return unavailable
    revalidatePath('/app/perfil')
    return { ok: true }
  } catch { return unavailable }
}

export async function reviewProfileObservationAction(input: unknown): Promise<ProfileActionResult> {
  if (!progressiveProfileAvailable()) return unavailable
  const parsed = reviewSchema.safeParse(input)
  if (!parsed.success) return unavailable
  try {
    const client = await ownerClient()
    if (!client) return unavailable
    const { error } = await client.rpc('review_profile_observation', {
      p_observation_id: parsed.data.observationId,
      p_action: parsed.data.action,
      // Preserve PostgreSQL microseconds and offset; never round-trip via Date.
      p_expected_updated_at: parsed.data.expectedUpdatedAt,
    })
    if (error?.code === 'PT409' || error?.code === '40001') return { ok: false, conflict: true, error: 'Este dato ha cambiado. Recarga el perfil antes de revisarlo.' }
    if (error) return unavailable
    revalidatePath('/app/perfil')
    return { ok: true }
  } catch { return unavailable }
}
