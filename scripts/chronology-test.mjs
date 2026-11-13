import { spawnSync } from 'node:child_process'

// Synthetic data and a disposable local PostgreSQL container only.
const env = Object.fromEntries(Object.entries({
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR,
  CI: process.env.CI,
  NODE_ENV: 'test',
  DO_NOT_TRACK: '1',
  SUPABASE_TELEMETRY_DISABLED: '1',
}).filter(([, value]) => value !== undefined))
const checks = [
  ['generator', 'python3', ['tests/tooling/chronology-generator.test.py']],
  ['readback', process.execPath, ['--test', 'tests/tooling/chronology-hosted-readback.test.mjs']],
  ['docker lifecycle', 'python3', ['tests/tooling/chronology-docker-lifecycle.test.py']],
  ['postgres', 'python3', ['tests/tooling/chronology-integration.test.py']],
]
for (const [name, command, args] of checks) {
  const result = spawnSync(command, args, { env, stdio: 'inherit', timeout: 600_000 })
  const ok = result.status === 0 && !result.error
  console.log(`${ok ? 'PASS' : 'FAIL'} chronology ${name}`)
  if (!ok) process.exitCode = 1
}
