import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, chmodSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const socket = [join(homedir(), '.docker/run/docker.sock'), '/var/run/docker.sock'].find(path => {
  try { return statSync(path).isSocket() } catch { return false }
})
const root = import.meta.dirname
const id = 'a'.repeat(64), nonce = '1'.repeat(32)

test('direct invocation with forged variables never executes SQL against a foreign container', t => {
  if (!socket) return t.skip('No local Unix socket to use for the identity-only fake')
  const directory = mkdtempSync(join(tmpdir(), 'serenia-probe-forged-'))
  const logfile = join(directory, 'docker-invocations.jsonl')
  try {
    const executable = join(directory, 'docker')
    const fake = `#!/usr/bin/python3\nimport json,sys\nwith open(${JSON.stringify(logfile)},'a') as f: f.write(json.dumps(sys.argv[1:])+'\\n')\nprint('"${id}"|"/foreign-container"|"postgres:17.6-bookworm"|"none"|"${nonce}"')\n`
    writeFileSync(executable, fake); chmodSync(executable, 0o700)
    const env = { NODE_ENV: 'test' as const, PATH: directory, HOME: directory, PROBE_DOCKER_ENDPOINT: 'unix://' + socket, PROBE_CONTAINER_ID: id, PROBE_CONTAINER_NONCE: nonce }
    const run = (overrides: Partial<typeof env>) => spawnSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--test', 'postgres-concurrency.test.ts'], { cwd: root, env: { ...env, ...overrides }, timeout: 20_000, encoding: 'utf8' })
    for (const overrides of [
      { PROBE_DOCKER_ENDPOINT: 'tcp://attacker.invalid:2375' },
      { PROBE_CONTAINER_ID: 'a'.repeat(63) + ';' },
      { PROBE_CONTAINER_NONCE: '../public' },
    ]) {
      const out = run(overrides)
      assert.notEqual(out.status, 0); assert.equal(existsSync(logfile), false)
    }
    const out = run({})
    assert.notEqual(out.status, 0)
    const calls = readFileSync(logfile, 'utf8').trim().split('\n').map(row => JSON.parse(row) as string[])
    assert.ok(calls.length > 0)
    assert.ok(calls.every(args => args.includes('inspect') && !args.includes('exec')))
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
