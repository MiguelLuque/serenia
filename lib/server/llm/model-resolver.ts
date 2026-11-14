import 'server-only'
import { createOpenAI } from '@ai-sdk/openai'
import { wrapLanguageModel, type LanguageModel } from 'ai'
import type { TaskPolicy } from '@/lib/shared/llm/task-policy'

/** Resolve the connection at the generation boundary, never in durable job data. */
export function resolveTaskModel(policy: TaskPolicy, env: Record<string, string | undefined> = process.env): LanguageModel {
  const transport = env.LLM_TRANSPORT
  if (!transport || transport === 'gateway') return policy.modelId
  if (transport !== 'openai') throw new Error('Invalid LLM_TRANSPORT')

  const match = /^openai\/([a-zA-Z0-9][a-zA-Z0-9._:-]*)$/.exec(policy.modelId)
  if (!match) throw new Error('Direct OpenAI transport requires an OpenAI model')
  const region = env.OPENAI_API_REGION ?? 'global'
  const baseURL = region === 'global'
    ? 'https://api.openai.com/v1'
    : region === 'eu'
      ? 'https://eu.api.openai.com/v1'
      : null
  if (!baseURL) throw new Error('Invalid OPENAI_API_REGION')
  const apiKey = env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY')

  const provider = createOpenAI({ apiKey, baseURL })
  return wrapLanguageModel({
    model: provider.responses(match[1]),
    middleware: {
      specificationVersion: 'v3',
      transformParams: async ({ params }) => ({
        ...params,
        providerOptions: {
          ...params.providerOptions,
          openai: { ...params.providerOptions?.openai, store: false },
        },
      }),
    },
  })
}
