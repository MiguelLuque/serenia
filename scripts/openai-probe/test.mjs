import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// This gate runs only synthetic inputs; no caller data or secrets are inherited.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const env = Object.fromEntries(Object.entries({
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR,
  CI: process.env.CI,
  NODE_ENV: 'test',
  DO_NOT_TRACK: '1',
  SUPABASE_TELEMETRY_DISABLED: '1',
}).filter(([, value]) => value !== undefined))
const base = 'scripts/openai-probe/'
const checks = [
  ['synthetic model and reservation', process.execPath, ['--conditions=react-server', '--import', 'tsx', '--test', ...['probe.test.ts', 'generation.test.ts', 'real-adapter.test.ts', 'reservation.test.ts', 'docker-command.test.ts'].map(name => base + name)]],
  ['adversarial container targeting', process.execPath, ['--import', 'tsx', '--test', ...['probe-container.test.ts', 'adversarial-target.test.ts'].map(name => base + name)]],
  ['Next handler', process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tests/api/openai-probe.test.ts']],
  ['ephemeral PostgreSQL', 'python3', [base + 'run-postgres-test.py']],
]
for (const [name, command, args] of checks) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit', timeout: 180_000 })
  const ok = result.status === 0 && !result.error
  console.log(`${ok ? 'PASS' : 'FAIL'} openai probe ${name}`)
  if (!ok) process.exitCode = 1
}
