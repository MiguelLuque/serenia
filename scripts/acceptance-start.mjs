import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, openSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { createServer } from 'node:net'
import { localCredentials, acceptanceEnvironment, privateDirectory } from './acceptance-local.mjs'

// Run from the original checkout; the exact Next child runs inside the immutable
// isolated snapshot. No dotenv loader, inherited NODE_OPTIONS or provider keys.
const [buildDirectory, stateDirectory] = process.argv.slice(2)
if (!buildDirectory || !stateDirectory || process.argv.length !== 4) throw new Error('Usage: node scripts/acceptance-start.mjs ABS_BUILD_DIR ABS_PRIVATE_STATE_DIR')
const metadata = JSON.parse(readFileSync(resolve(buildDirectory, 'metadata.json'), 'utf8'))
const result = JSON.parse(readFileSync(resolve(buildDirectory, 'result.json'), 'utf8'))
if (!metadata.localAcceptance || result.exit !== 0) throw new Error('A successful local-acceptance build is required')
const snapshot = metadata.snapshot
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex')
if (hash(resolve(snapshot, 'package-lock.json')) !== metadata.lockSha256) throw new Error('Artifact lock mismatch')
for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) if (existsSync(resolve(snapshot, name))) throw new Error('Environment files forbidden in acceptance artifact')
// Fail before replacing runtime identity when an acceptance app is still live.
await new Promise((done, reject) => {
  const probe = createServer()
  probe.once('error', () => reject(new Error('Acceptance port 3000 is already in use; stop the recorded child before restarting')))
  probe.listen({ host: '127.0.0.1', port: 3000, exclusive: true }, () => probe.close(done))
})
const directory = privateDirectory(stateDirectory)
if (!existsSync(resolve(directory, 'control.json'))) writeFileSync(resolve(directory, 'control.json'), '{"structured":"success"}\n', { mode: 0o600 })
const buildId = readFileSync(resolve(snapshot, '.next/BUILD_ID'), 'utf8').trim()
const logfile = resolve(directory, `next-${Date.now()}.log`)
const fd = openSync(logfile, 'w', 0o600)
const child = spawn(process.execPath, ['--import', resolve(snapshot, 'scripts/acceptance-provider.mjs'), resolve(snapshot, 'node_modules/next/dist/bin/next'), 'start', snapshot, '--hostname', '127.0.0.1', '--port', '3000'], { cwd: snapshot, env: acceptanceEnvironment(process.env, localCredentials(), directory), stdio: ['ignore', fd, fd] })
const identity = { sourceCommit: metadata.sourceCommit, lockSha256: metadata.lockSha256, buildId, snapshot, stateDirectory: directory, url: 'http://127.0.0.1:3000', pid: child.pid, logfile }
writeFileSync(resolve(directory, 'runtime.json'), JSON.stringify(identity, null, 2) + '\n', { mode: 0o600 })
console.log(JSON.stringify(identity))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('exit', (code, signal) => { console.log(JSON.stringify({ exit: code, signal, logfile })); process.exitCode = code ?? 1 })
