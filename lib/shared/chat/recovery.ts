import { z } from 'zod'
export const ChatRecoverySchema = z.object({
  requestId: z.string(), userMessageId: z.string(), text: z.string(),
  status: z.enum(['generating', 'failed']), canRetry: z.boolean(), leaseUntil: z.string(),
})
export type ChatRecovery = z.infer<typeof ChatRecoverySchema>
