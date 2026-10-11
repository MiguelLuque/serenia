import { spawnSync } from 'node:child_process'
import { mkdirSync, existsSync, lstatSync, realpathSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export function supabaseEnvironment(source, root) {
  return {
    PATH: source.PATH, HOME: source.HOME, TMPDIR: source.TMPDIR,
    SUPABASE_HOME: resolve(root, '.cache/supabase'),
    SUPABASE_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1',
    NEXT_TELEMETRY_DISABLED: '1',
  }
}
export function validateArguments(args) {
  const forbidden = /^--(?:linked|db-url|project-ref|project-id|password|workdir|config|experimental)(?:=|$)/
  if (args.some(value => forbidden.test(value))) throw new Error('Remote targets and alternate configuration are forbidden')
  const pair = args.slice(0, 2).join(' ')
  const safe = ['--help', '--version', 'start', 'stop', 'status'].includes(args[0]) ||
    ['telemetry disable', 'telemetry status', 'db reset', 'db lint', 'db advisors', 'gen types', 'migration new', 'migration list'].includes(pair)
  if (!safe) throw new Error('Only reviewed local Supabase commands are allowed')
  if (!args.includes('--help') && ['db reset', 'db lint', 'db advisors', 'gen types', 'migration list'].includes(pair) && !args.includes('--local')) {
    throw new Error('This command requires --local')
  }
}
export function runSupabase(args, options = {}) {
  validateArguments(args)
  const env = supabaseEnvironment(process.env, projectRoot)
  // A symlink must never redirect isolated CLI state to the user's global home.
  for (const directory of [resolve(projectRoot, '.cache'), env.SUPABASE_HOME]) {
    if (existsSync(directory) && lstatSync(directory).isSymbolicLink()) throw new Error('CLI state directory must not be a symlink')
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    if (realpathSync(directory) !== directory) throw new Error('CLI state escaped the project')
  }
  return spawnSync(resolve(projectRoot, 'node_modules/.bin/supabase'), args, {
    encoding: 'utf8', ...options, cwd: projectRoot, env,
  })
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = runSupabase(process.argv.slice(2), { stdio: 'inherit' })
    if (result.error) throw result.error
    process.exitCode = result.status ?? 1
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
