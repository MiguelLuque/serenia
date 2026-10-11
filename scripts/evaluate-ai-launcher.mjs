import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Builtins only: this initial process may inherit shell/npm environment and
// NODE_OPTIONS. Establish the evaluator CHILD boundary before its TS imports.
/** @returns {NodeJS.ProcessEnv} */
export function evaluationEnvironment(source) {
  return {
    PATH: source.PATH,
    NODE_ENV: 'test',
    NEXT_TELEMETRY_DISABLED: '1',
    DO_NOT_TRACK: '1',
    FEATURE_AUXILIARY_DECISIONS: 'off',
    SERENIA_AI_EVALUATOR_ENV_POLICY: 'positive-v1',
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2) {
    console.error('Only the offline evaluator is available; no online calls authorized')
    process.exitCode = 1
  } else {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
    const result = spawnSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', resolve(root, 'scripts/evaluate-ai.ts')], {
      cwd: root, env: evaluationEnvironment(process.env), stdio: 'inherit',
    })
    if (result.error || result.signal) console.error('Offline evaluator child failed to complete')
    process.exitCode = result.status ?? 1
  }
}
