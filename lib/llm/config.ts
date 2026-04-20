type LLMRole = 'conversational' | 'fast' | 'structured'

interface RoleConfig {
  provider: string
  model: string
}

function getRoleConfig(role: LLMRole): RoleConfig {
  const prefix = `LLM_${role.toUpperCase()}`
  const provider = process.env[`${prefix}_PROVIDER`] ?? 'anthropic'
  const model = process.env[`${prefix}_MODEL`]
  if (!model) {
    throw new Error(`Missing env var ${prefix}_MODEL for LLM role "${role}"`)
  }
  return { provider, model }
}

export { getRoleConfig, type RoleConfig, type LLMRole }
