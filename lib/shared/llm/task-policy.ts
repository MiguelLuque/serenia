import { getRoleConfig, type LLMRole, type RoleConfig } from './config'

export type LLMTask = 'conversation' | 'profileExtraction' | 'closureReport'
export interface TaskPolicy<T extends LLMTask = LLMTask> {
  task: T
  modelId: string
  timeoutMs: number
  maxOutputTokens: number
  maxRetries: 0
}

const budgets = {
  conversation: { timeoutMs: 45_000, maxOutputTokens: 2500, maxRetries: 0 },
  profileExtraction: { timeoutMs: 20_000, maxOutputTokens: 1500, maxRetries: 0 },
  closureReport: { timeoutMs: 45_000, maxOutputTokens: 6000, maxRetries: 0 },
} as const

function validatePair(config: RoleConfig, prefix: string): RoleConfig {
  // Validate routing syntax, not a mutable provider/model catalogue. Never echo values.
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(config.provider) || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(config.model)) {
    throw new Error(`Invalid LLM configuration: ${prefix}_PROVIDER and ${prefix}_MODEL`)
  }
  return config
}

function legacyConfig(role: LLMRole, env: Record<string, string | undefined>): RoleConfig {
  return validatePair(getRoleConfig(role, env), `LLM_${role.toUpperCase()}`)
}

export function resolveTaskPolicy<T extends LLMTask>(task: T, env: Record<string, string | undefined> = process.env): TaskPolicy<T> {
  let config: RoleConfig
  if (task === 'conversation') {
    config = legacyConfig('conversational', env)
  } else {
    const prefix = task === 'profileExtraction' ? 'LLM_PROFILE_EXTRACTION' : 'LLM_CLOSURE_REPORT'
    const provider = env[`${prefix}_PROVIDER`]
    const model = env[`${prefix}_MODEL`]
    // Only an entirely unset/blank pair can use the legacy structured role.
    config = !provider?.trim() && !model?.trim()
      ? legacyConfig('structured', env)
      : validatePair({ provider: provider ?? '', model: model ?? '' }, prefix)
  }
  return { task, modelId: `${config.provider}/${config.model}`, ...budgets[task] }
}
