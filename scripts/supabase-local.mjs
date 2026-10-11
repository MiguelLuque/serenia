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
// Deliberately narrower than the CLI: new options require a reviewed contract.
const commandOptions = {
  start: {}, stop: {}, status: { '--output': ['json'] },
  'telemetry disable': {}, 'telemetry status': {},
  'db reset': { '--local': true },
  'db lint': { '--local': true, '--schema': ['public'], '--level': ['warning', 'error'], '--fail-on': ['warning'] },
  'db advisors': { '--local': true, '--type': ['all'], '--level': ['info', 'warn', 'error'], '--fail-on': ['warn'] },
  'gen types': { '--local': true, '--lang': ['typescript'], '--schema': ['public'] },
  'migration new': {}, 'migration list': { '--local': true },
}
export function validateArguments(args) {
  if (!Array.isArray(args) || args.some(value => typeof value !== 'string')) throw new Error('Invalid CLI arguments')
  if (args.length === 1 && ['--help', '-h', '--version', '-v'].includes(args[0])) return
  const pair = args.slice(0, 2).join(' ')
  const command = Object.hasOwn(commandOptions, pair) ? pair : args[0]
  if (!Object.hasOwn(commandOptions, command)) throw new Error('Only reviewed local Supabase commands are allowed')
  const allowed = { ...commandOptions[command], '--help': true }
  const seen = new Set()
  const positionals = []
  for (let index = command.split(' ').length; index < args.length; index++) {
    const argument = args[index]
    if (!argument.startsWith('-')) { positionals.push(argument); continue }
    const separator = argument.indexOf('=')
    const rawFlag = separator < 0 ? argument : argument.slice(0, separator)
    const flag = rawFlag === '-h' ? '--help' : rawFlag
    if (!Object.hasOwn(allowed, flag) || seen.has(flag)) throw new Error('Unknown or duplicated CLI option')
    seen.add(flag)
    const choices = allowed[flag]
    if (choices === true) {
      if (separator >= 0) throw new Error('Boolean local/help flags must be bare and unique')
    } else {
      const value = separator >= 0 ? argument.slice(separator + 1) : args[++index]
      if (!choices.includes(value)) throw new Error('Unreviewed CLI option value')
    }
  }
  if (command === 'migration new') {
    if (positionals.length !== (seen.has('--help') ? 0 : 1) || positionals.some(value => !/^[a-z][a-z0-9_]{0,79}$/.test(value))) throw new Error('Expected one local migration name')
  } else if (positionals.length) throw new Error('Unexpected CLI positional argument')
  if (!seen.has('--help') && ['db reset', 'db lint', 'db advisors', 'gen types', 'migration list'].includes(command) && !seen.has('--local')) throw new Error('This command requires --local')
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
