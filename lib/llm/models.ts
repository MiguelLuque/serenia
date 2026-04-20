import { getRoleConfig, type LLMRole } from './config'

// Returns a "provider/model" gateway string — Vercel AI SDK routes it through
// AI Gateway automatically. Auth via VERCEL_OIDC_TOKEN (vercel env pull).
function buildModel(role: LLMRole): string {
  const { provider, model } = getRoleConfig(role)
  return `${provider}/${model}`
}

export const llm = {
  conversational: (): string => buildModel('conversational'),
  fast: (): string => buildModel('fast'),
  structured: (): string => buildModel('structured'),
} as const
