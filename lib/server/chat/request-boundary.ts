import { z } from 'zod'

export const MAX_REQUEST_BYTES = 24_000
export const MAX_TURN_CHARS = 6_000
export const MAX_CONTEXT_CHARS = 80_000
const identifier = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/)
export const ChatRequestSchema = z.object({
  sessionId: z.string().uuid(),
  requestId: identifier,
  messages: z.array(z.object({
    id: identifier,
    role: z.literal('user'),
    parts: z.array(z.object({ type: z.literal('text'), text: z.string().min(1).max(MAX_TURN_CHARS) }).strict()).length(1),
  }).strict()).length(1),
}).strict().refine(body => body.messages[0].id === body.requestId && body.messages[0].parts[0].text.trim().length > 0)

// Conservative, deterministic consent. A model tool call is never permission.
export function acceptsClosure(text: string): boolean {
  return /^(s[ií](?:,?\s+(?:cerramos|quiero cerrar(?: la sesi[oó]n)?))?|de acuerdo|vale|acepto|cerramos|quiero cerrar(?: la sesi[oó]n)?)[.!\s]*$/iu.test(text.trim())
}

export function checkContextBudget(messages: unknown[]): void {
  if (messages.length > 160 || JSON.stringify(messages).length > MAX_CONTEXT_CHARS) throw new Error('context_limit')
}

export async function readBoundedJson(request: Request, maxBytes = MAX_REQUEST_BYTES): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > maxBytes) throw new Error('request_limit')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('invalid_body')
  const chunks: Uint8Array[] = []
  let length = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > maxBytes) { await reader.cancel(); throw new Error('request_limit') }
    chunks.push(value)
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return JSON.parse(new TextDecoder().decode(bytes))
}
