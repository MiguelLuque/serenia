import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

describe('isolated local tooling contracts', () => {
  it('has a local-only Supabase wrapper with an explicit child environment', async () => {
    expect(existsSync(resolve('scripts/supabase-local.mjs'))).toBe(true)
    const { supabaseEnvironment, validateArguments } = await import('../../scripts/supabase-local.mjs')
    const env = supabaseEnvironment({ PATH: '/bin', HOME: '/synthetic', SUPABASE_ACCESS_TOKEN: 'must-not-leak', SUPABASE_TRACE_FILE: '/secret', SUPABASE_OTLP_ENDPOINT: 'https://external.invalid', SUPABASE_OTLP_HEADERS: 'secret', OPENAI_API_KEY: 'secret' }, '/synthetic/project')
    expect(env.SUPABASE_HOME).toBe('/synthetic/project/.cache/supabase')
    expect(env.SUPABASE_TELEMETRY_DISABLED).toBe('1')
    expect(env.DO_NOT_TRACK).toBe('1')
    expect(env).not.toHaveProperty('SUPABASE_ACCESS_TOKEN')
    expect(env).not.toHaveProperty('SUPABASE_TRACE_FILE')
    expect(env).not.toHaveProperty('SUPABASE_OTLP_ENDPOINT')
    expect(env).not.toHaveProperty('SUPABASE_OTLP_HEADERS')
    expect(env).not.toHaveProperty('OPENAI_API_KEY')
    for (const args of [['link'], ['db', 'push'], ['login'], ['db', 'lint', '--linked'], ['db', 'reset', '--db-url', 'postgres://remote.invalid']]) expect(() => validateArguments(args)).toThrow()
    for (const args of [['--version'], ['start', '--help'], ['db', 'reset', '--local'], ['gen', 'types', '--local', '--lang', 'typescript', '--schema', 'public']]) expect(() => validateArguments(args)).not.toThrow()
  })
  it('isolated build never inherits application, tracing or provider credentials', async () => {
    expect(existsSync(resolve('scripts/build-isolated.mjs'))).toBe(true)
    const { buildEnvironment } = await import('../../scripts/build-isolated.mjs')
    const env = buildEnvironment({ PATH: '/bin', OPENAI_API_KEY: 'secret', VERCEL_OIDC_TOKEN: 'secret', DATABASE_URL: 'postgres://remote.invalid', NODE_OPTIONS: '--require /outside.js', HTTP_PROXY: 'http://external.invalid', SUPABASE_ACCESS_TOKEN: 'secret' })
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:54321')
    expect(env.NEXT_TELEMETRY_DISABLED).toBe('1')
    for (const name of ['OPENAI_API_KEY', 'VERCEL_OIDC_TOKEN', 'DATABASE_URL', 'NODE_OPTIONS', 'HTTP_PROXY', 'SUPABASE_ACCESS_TOKEN']) expect(env).not.toHaveProperty(name)
  })
  it('rejects malformed audit reports and remaining high/critical advisories', async () => {
    expect(existsSync(resolve('scripts/audit-dependencies.mjs'))).toBe(true)
    const { assertAuditGate } = await import('../../scripts/audit-dependencies.mjs')
    expect(() => assertAuditGate({})).toThrow()
    expect(() => assertAuditGate({ metadata: { vulnerabilities: { high: 1, critical: 0 } }, vulnerabilities: { next: { severity: 'high' } } })).toThrow()
    expect(() => assertAuditGate({ metadata: { vulnerabilities: { high: 0, critical: 0 } }, vulnerabilities: { example: { severity: 'moderate' } } })).toThrow()
  })
})

describe('reviewed CLI argument boundaries', () => {
  it.each([
    ['status', '--create-ticket'], ['start', '--ignore-health-check'],
    ['db', 'reset', '--local', '--profile', 'synthetic-profile'],
    ['db', 'reset', '--local', '--local=false'], ['db', 'reset', '--local=true'], ['db', 'reset', '--local', '--local'],
    ['status', '--output=json', '--output=env'], ['status', '--output', 'json', '--output=json'], ['status', '--help', '--create-ticket'],
    ['start', '--exclude', 'gotrue'], ['db', 'reset', '--local', '--sql-paths', '../outside.sql'],
    ['gen', 'types', '--local', '--lang', 'typescript', '--profile=synthetic'],
    ['db', 'lint', '--local', '--fail-on', 'none'], ['status', 'unexpected-positional'],
  ])('rejects scope expansion or ambiguity: %j', async (...args) => {
    const { validateArguments } = await import('../../scripts/supabase-local.mjs')
    expect(() => validateArguments(args)).toThrow()
  })
  it.each([
    ['telemetry', 'disable'], ['telemetry', 'status'], ['start'], ['stop'],
    ['status', '--output=json'], ['db', 'lint', '--local', '--schema', 'public', '--level', 'warning', '--fail-on', 'warning'],
    ['db', 'advisors', '--local', '--type', 'all', '--level', 'warn', '--fail-on', 'warn'],
    ['gen', 'types', '--local', '--lang=typescript', '--schema=public'], ['migration', 'new', 'synthetic_change'],
  ])('retains reviewed local usage: %j', async (...args) => {
    const { validateArguments } = await import('../../scripts/supabase-local.mjs')
    expect(() => validateArguments(args)).not.toThrow()
  })
})
