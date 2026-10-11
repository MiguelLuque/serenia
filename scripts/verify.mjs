import { spawnSync } from 'node:child_process'
import { mkdtempSync, openSync, closeSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

const directory = mkdtempSync(resolve(tmpdir(), 'serenia-verify-'))
const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, NEXT_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1', SUPABASE_TELEMETRY_DISABLED: '1', SERENIA_CHECK_LOG_DIR: directory }
const results = []
// Explicit gates; a missing executable, failed command or absent evidence fails.
for (const gate of ['test', 'lint', 'typecheck', 'workflow:wire', 'db:test', 'audit:dependencies', 'build:isolated']) {
  const logfile = resolve(directory, gate.replaceAll(':', '-') + '.log')
  const fd = openSync(logfile, 'w', 0o600)
  const result = spawnSync('npm', ['run', gate], { env, stdio: ['ignore', fd, fd] })
  closeSync(fd)
  results.push({ gate, exit: result.status, error: result.error?.message, logfile })
  console.log(`${result.status === 0 ? 'PASS' : 'FAIL'} ${gate}; full log: ${logfile}`)
  if (result.error || result.status !== 0) process.exitCode = 1
}
writeFileSync(resolve(directory, 'results.json'), JSON.stringify(results, null, 2) + '\n')
console.log(`Verification evidence: ${directory}. Supabase runtime acceptance additionally requires npm run db:verify with a healthy local stack.`)
