import { z } from 'zod'
export const ChatRecoverySchema = z.object({
  requestId: z.string(), userMessageId: z.string(), text: z.string(),
  status: z.enum(['generating', 'failed']), attempt: z.number().int().min(1).max(3).optional(), canRetry: z.boolean(), leaseUntil: z.string(),
})
export type ChatRecovery = z.infer<typeof ChatRecoverySchema>
