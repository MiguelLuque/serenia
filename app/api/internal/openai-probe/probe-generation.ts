import { generateText, Output, stepCountIs, type LanguageModel } from 'ai'
import { z } from 'zod'
import type { Generated } from './probe-core'

// Fixed, fictional inputs only: no request or user data reach the provider.
const conversationPrompt = 'Responde con la palabra OK.'
const reportPrompt = 'Devuelve el objeto con result igual a ok.'
const reportOutput = Output.object({ schema: z.object({ result: z.enum(['ok']) }) })

export async function generateOne(model: LanguageModel, task: 'conversation' | 'report'): Promise<Generated> {
  const result = await generateText({
    model,
    prompt: task === 'conversation' ? conversationPrompt : reportPrompt,
    ...(task === 'report' ? { output: reportOutput } : {}),
    maxOutputTokens: 1000,
    maxRetries: 0,
    stopWhen: stepCountIs(1),
    timeout: 45_000,
  })
  // Access structured output to force validation; only metadata leaves this function.
  const contentIsValid = task === 'report' ? result.output?.result === 'ok' : result.text.trim().length > 0
  const { inputTokens, outputTokens } = result.usage
  return {
    complete: result.finishReason === 'stop' && contentIsValid,
    usage: typeof inputTokens === 'number' && typeof outputTokens === 'number' ? { inputTokens, outputTokens } : null,
  }
}
