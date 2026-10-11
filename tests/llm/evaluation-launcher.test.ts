import { expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

it('isolates the actual evaluator child before dependency imports, allowing an inherited initial launcher', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'serenia-evaluation-env-'))
  try {
    const probe = join(temporary, 'synthetic-probe.cjs')
    const records = join(temporary, 'probe.jsonl')
    // Fictitious NODE_OPTIONS preload observes only booleans. The initial
    // shell/npm/launcher is allowed to inherit; the evaluator child is not.
    writeFileSync(probe, `const fs = require('node:fs'); process.on('exit', () => fs.appendFileSync(${JSON.stringify(records)}, JSON.stringify({ evaluatorImported: Object.keys(require.cache).some(p => p.endsWith('/scripts/evaluate-ai.ts')), openaiInherited: process.env.OPENAI_API_KEY === 'synthetic-openai-sentinel', supabaseInherited: process.env.SUPABASE_SERVICE_ROLE_KEY === 'synthetic-supabase-sentinel' }) + '\\n'));`)
    const script = JSON.parse(readFileSync('package.json', 'utf8')).scripts['ai:evaluate:offline'] as string
    const result = spawnSync(process.execPath, script.split(' ').slice(1), {
      cwd: resolve('.'), encoding: 'utf8', timeout: 15000,
      env: { PATH: process.env.PATH, NODE_ENV: 'test', OPENAI_API_KEY: 'synthetic-openai-sentinel', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-supabase-sentinel', NODE_OPTIONS: `--require=${probe}` },
    })
    expect(result.status, result.stderr).toBe(0)
    const observations = readFileSync(records, 'utf8').trim().split('\n').map(line => JSON.parse(line))
    expect(observations.some(r => r.openaiInherited && r.supabaseInherited)).toBe(true)
    expect(observations.some(r => r.evaluatorImported && (r.openaiInherited || r.supabaseInherited))).toBe(false)
    const report = JSON.parse(result.stdout)
    expect(report.onlineBudgetUsd).toBe(0)
    expect(report.source.evaluatorEnvironment).toMatchObject({ policy: 'positive-v1', scope: 'evaluator_child_before_dependency_imports', effectiveKeys: ['DO_NOT_TRACK', 'FEATURE_AUXILIARY_DECISIONS', 'NEXT_TELEMETRY_DISABLED', 'NODE_ENV', 'PATH', 'SERENIA_AI_EVALUATOR_ENV_POLICY'], nodeOptionsInherited: false, auxiliaryMode: 'off' })
    expect([[], ...(process.platform === 'darwin' ? [['__CF_USER_TEXT_ENCODING']] : [])]).toContainEqual(report.source.evaluatorEnvironment.osAddedKeys)
    expect(result.stdout).not.toContain('synthetic-openai-sentinel')
    expect(result.stdout).not.toContain('synthetic-supabase-sentinel')
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
})

it('retains only the PATH input and fixed offline settings from arbitrary fake inherited values', async () => {
  const { evaluationEnvironment } = await import('../../scripts/evaluate-ai-launcher.mjs')
  expect(evaluationEnvironment({ PATH: '/synthetic/bin', NODE_ENV: 'production', OPENAI_API_KEY: 'synthetic', ANTHROPIC_API_KEY: 'synthetic', AI_GATEWAY_API_KEY: 'synthetic', VERCEL_OIDC_TOKEN: 'synthetic', SUPABASE_SECRET_KEY: 'synthetic', SUPABASE_SERVICE_ROLE_KEY: 'synthetic', DATABASE_URL: 'synthetic', NODE_OPTIONS: '--require=synthetic', HTTP_PROXY: 'synthetic', HTTPS_PROXY: 'synthetic', OTEL_EXPORTER_OTLP_HEADERS: 'synthetic', FEATURE_AUXILIARY_DECISIONS: 'shadow', HOME: '/synthetic', __CF_USER_TEXT_ENCODING: 'synthetic-do-not-inherit' })).toEqual({ PATH: '/synthetic/bin', NODE_ENV: 'test', NEXT_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1', FEATURE_AUXILIARY_DECISIONS: 'off', SERENIA_AI_EVALUATOR_ENV_POLICY: 'positive-v1' })
})

it('fails closed on an unknown effective evaluator key and rejects launcher arguments', async () => {
  const { evaluationEnvironment } = await import('../../scripts/evaluate-ai-launcher.mjs')
  const result = spawnSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', 'scripts/evaluate-ai.ts'], { cwd: resolve('.'), encoding: 'utf8', timeout: 15000, env: { ...evaluationEnvironment({ PATH: process.env.PATH }), UNREVIEWED_SYNTHETIC_KEY: 'synthetic-only' } })
  expect(result.status).toBe(1)
  expect(result.stdout).toBe('')
  expect(result.stderr).not.toContain('synthetic-only')
  const unsupported = spawnSync(process.execPath, ['scripts/evaluate-ai-launcher.mjs', '--online'], { cwd: resolve('.'), encoding: 'utf8', timeout: 15000, env: { PATH: process.env.PATH, NODE_ENV: 'test' } })
  expect(unsupported.status).toBe(1)
  expect(unsupported.stdout).toBe('')
  expect(unsupported.stderr).toContain('Only the offline evaluator')
})
