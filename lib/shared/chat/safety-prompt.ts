type PromptPart = { type?: unknown; data?: unknown }
type PromptMessage = { role?: unknown; parts?: readonly PromptPart[] }

/** Return only the prompt reference attached to the latest assistant response. */
export function latestSafetyPromptRequestId(messages: readonly PromptMessage[]): string | undefined {
  const assistant = [...messages].reverse().find(message => message.role === 'assistant')
  const marker = assistant?.parts?.find(part => part.type === 'data-safety-prompt')
  if (!marker || typeof marker.data !== 'object' || marker.data === null || Array.isArray(marker.data)) return undefined
  const data = marker.data as Record<string, unknown>
  return data.version === '1' && typeof data.requestId === 'string' && data.requestId.length > 0 ? data.requestId : undefined
}
