import { z } from 'zod'
import type { Database } from '@/lib/shared/supabase/types'

export const ProfileCategorySchema = z.enum(['concern', 'goal', 'context', 'functioning', 'resource', 'preference', 'history', 'agreement'])
export const ProfileTimeScopeSchema = z.enum(['current', 'historical', 'unspecified'])
const quoteSchema = z.string().refine(value => [...value].length >= 1 && [...value].length <= 400 && !value.includes('\u0000'))
export const ProfileExtractionSchema = z.strictObject({
  observations: z.array(z.strictObject({
    category: ProfileCategorySchema,
    quote: quoteSchema,
    time_scope: ProfileTimeScopeSchema,
    supersedes_id: z.uuid().nullable(),
  })).max(5),
})
export const ProfileMemorySchema = z.strictObject({
  enabled: z.boolean(),
  pending_jobs: z.number().int().nonnegative(),
  failed_jobs: z.number().int().nonnegative(),
  observations: z.array(z.strictObject({
    id: z.uuid(),
    category: ProfileCategorySchema,
    quote: quoteSchema,
    time_scope: ProfileTimeScopeSchema,
    status: z.enum(['pending', 'confirmed', 'rejected', 'superseded']),
    supersedes_id: z.uuid().nullable(),
    source_message_id: z.uuid(),
    session_id: z.uuid(),
    source_created_at: z.iso.datetime({ offset: true }),
    updated_at: z.iso.datetime({ offset: true }),
    disputed: z.boolean(),
  })).max(100),
})
export type ProfileMemory = z.infer<typeof ProfileMemorySchema>
export type ProfileExtraction = z.infer<typeof ProfileExtractionSchema>
export type KnownProfileTarget = Pick<Database['public']['Tables']['profile_observations']['Row'], 'id' | 'category' | 'quote' | 'time_scope' | 'status' | 'source_created_at'>
