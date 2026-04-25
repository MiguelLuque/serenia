import { z } from 'zod'

export const TextPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
})

export const MessagePartSchema = z.discriminatedUnion('type', [TextPartSchema])

export type MessagePart = z.infer<typeof MessagePartSchema>
export type TextPart = z.infer<typeof TextPartSchema>
