import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, mkdtempSync, mkdirSync, openSync, closeSync, rmSync, writeFileSync, existsSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname, basename, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

export function buildEnvironment(source) {
  return {
    PATH: source.PATH, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1',
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-local-build-public-placeholder',
    SUPABASE_SECRET_KEY: 'synthetic-local-build-server-placeholder',
    NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3000',
    LLM_CONVERSATIONAL_PROVIDER: 'synthetic', LLM_CONVERSATIONAL_MODEL: 'conversational',
    LLM_FAST_PROVIDER: 'synthetic', LLM_FAST_MODEL: 'fast',
    LLM_STRUCTURED_PROVIDER: 'synthetic', LLM_STRUCTURED_MODEL: 'structured',
    WORKFLOW_TARGET_WORLD: 'local', FEATURE_CROSS_SESSION_CONTEXT: 'off',
  }
}
function checked(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', env: { PATH: process.env.PATH }, ...options })
  if (result.error || result.status !== 0) throw new Error(`${command} failed (exit ${result.status}): ${result.error?.message || result.stderr || ''}`)
  return result.stdout
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const runDirectory = mkdtempSync(resolve(tmpdir(), 'serenia-build-'))
  let log
  try {
    const env = buildEnvironment(process.env)
    const gitOptions = { cwd: root, env: { PATH: process.env.PATH } }
    const sourceCommit = checked('git', ['rev-parse', 'HEAD'], gitOptions).trim()
    const dirty = checked('git', ['diff', 'HEAD', '--name-only'], gitOptions).trim()
    if (dirty) throw new Error('Commit all tracked source changes before an isolated HEAD build')
    const tree = checked('git', ['ls-tree', '-r', 'HEAD'], gitOptions).trim().split('\n')
    for (const entry of tree) {
      const name = entry.split('\t')[1]
      if (/^\.env(?:\.|$)/.test(basename(name)) && name !== '.env.example') throw new Error(`Tracked environment file is forbidden: ${name}`)
      if (entry.startsWith('120000')) {
        const target = checked('git', ['show', `HEAD:${name}`], gitOptions).trim()
        if (isAbsolute(target) || !resolve(root, dirname(name), target).startsWith(root + '/')) throw new Error(`Tracked symlink escapes source: ${name}`)
      }
    }
    const snapshot = resolve(runDirectory, 'project')
    mkdirSync(snapshot)
    checked('git', ['archive', '--format=tar', 'HEAD', '--output=' + resolve(runDirectory, 'source.tar')], gitOptions)
    checked('tar', ['-xf', resolve(runDirectory, 'source.tar'), '-C', snapshot], { env: { PATH: process.env.PATH } })
    if (!existsSync(resolve(root, 'node_modules'))) throw new Error('Install pinned dependencies before building')
    const destination = resolve(snapshot, 'node_modules')
    const clone = spawnSync('cp', ['-cR', resolve(root, 'node_modules'), destination], { encoding: 'utf8', env: { PATH: process.env.PATH } })
    if (clone.status !== 0) {
      rmSync(destination, { recursive: true, force: true })
      checked('cp', ['-R', resolve(root, 'node_modules'), destination])
    }
    if (!realpathSync(destination).startsWith(realpathSync(snapshot) + '/')) throw new Error('Dependencies must be copied inside the snapshot')
    const hash = bytes => createHash('sha256').update(bytes).digest('hex')
    const lock = JSON.parse(readFileSync(resolve(snapshot, 'package-lock.json'), 'utf8'))
    if (hash(readFileSync(resolve(snapshot, 'package-lock.json'))) !== hash(readFileSync(resolve(root, 'package-lock.json')))) throw new Error('Installed/source lock mismatch')
    const packageNames = ['next', 'react', 'react-dom', 'ai', '@ai-sdk/react', 'workflow', '@workflow/core', '@workflow/next', '@supabase/supabase-js', '@supabase/ssr', 'supabase', 'vitest', 'vite']
    const versions = Object.fromEntries(packageNames.map(name => {
      const installed = JSON.parse(readFileSync(resolve(destination, name, 'package.json'), 'utf8')).version
      if (installed !== lock.packages[`node_modules/${name}`].version) throw new Error(`Installed version differs from lock: ${name}`)
      return [name, installed]
    }))
    const metadata = { sourceCommit, lockSha256: hash(readFileSync(resolve(snapshot, 'package-lock.json'))), node: process.version, versions, snapshot, copiedDependencies: true, environmentFiles: ['.env.example'], limits: 'Build only. No Auth/JWT/PostgREST/browser/generated workflow restart acceptance.' }
    writeFileSync(resolve(runDirectory, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n')
    const logfile = resolve(runDirectory, 'build.log')
    log = openSync(logfile, 'w', 0o600)
    const result = spawnSync(process.execPath, [resolve(destination, 'next/dist/bin/next'), 'build', snapshot], { cwd: snapshot, env, stdio: ['ignore', log, log] })
    closeSync(log); log = undefined
    writeFileSync(resolve(runDirectory, 'result.json'), JSON.stringify({ exit: result.status, error: result.error?.message }) + '\n')
    console.log(JSON.stringify({ ...metadata, exit: result.status, logfile }))
    if (result.error || result.status !== 0) throw new Error(`Isolated build failed; full evidence: ${logfile}`)
  } catch (error) {
    if (log !== undefined) closeSync(log)
    console.error(`${error.message}; evidence directory: ${runDirectory}`)
    process.exitCode = 1
  }
}
