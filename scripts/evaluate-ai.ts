import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { runOfflineEvaluation } from '../lib/server/llm/evaluation'

// Offline is the only mode. No keys, provider clients or online override.
if (process.argv.length > 2) throw Error('Only the offline evaluator is available; no online calls authorized')
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
const corpus = JSON.parse(readFileSync('tests/fixtures/ai-evaluation.json', 'utf8'))
async function main() {
  const effectiveKeys = Object.keys(process.env).sort()
  // Darwin may add this OS metadata key after spawn. Never inherit or read its
  // value; only distinguish its observed presence from launcher-specified keys.
  const osAddedKeys = process.platform === 'darwin' && effectiveKeys.includes('__CF_USER_TEXT_ENCODING') ? ['__CF_USER_TEXT_ENCODING'] : []
  const launcherSpecifiedKeys = effectiveKeys.filter(key => !osAddedKeys.includes(key))
  const allowedKeys = ['DO_NOT_TRACK', 'FEATURE_AUXILIARY_DECISIONS', 'NEXT_TELEMETRY_DISABLED', 'NODE_ENV', 'PATH', 'SERENIA_AI_EVALUATOR_ENV_POLICY']
  if (process.env.SERENIA_AI_EVALUATOR_ENV_POLICY !== 'positive-v1' || JSON.stringify(launcherSpecifiedKeys) !== JSON.stringify(allowedKeys) || process.env.FEATURE_AUXILIARY_DECISIONS !== 'off' || process.env.NODE_ENV !== 'test' || process.env.NEXT_TELEMETRY_DISABLED !== '1' || process.env.DO_NOT_TRACK !== '1') throw Error('Invalid evaluator environment policy')
  const result = await runOfflineEvaluation(corpus)
  const gitOptions = { env: { PATH: process.env.PATH, NODE_ENV: 'test' as const }, encoding: 'utf8' as const }
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], gitOptions).trim()
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], gitOptions).trim().length > 0
  console.log(JSON.stringify({ ...result, source: { commit, trackedSourceDirty: dirty, node: process.version, lockSha256: hash('package-lock.json'), corpusFileSha256: hash('tests/fixtures/ai-evaluation.json'), evaluatorSha256: hash('lib/server/llm/evaluation.ts'), launcherSha256: hash('scripts/evaluate-ai-launcher.mjs'), evaluatorEnvironment: { policy: 'positive-v1', scope: 'evaluator_child_before_dependency_imports', effectiveKeys: launcherSpecifiedKeys, osAddedKeys, nodeOptionsInherited: false, auxiliaryMode: 'off' }, zod: JSON.parse(readFileSync('node_modules/zod/package.json', 'utf8')).version, ai: JSON.parse(readFileSync('node_modules/ai/package.json', 'utf8')).version } }, null, 2))
}
main().catch(() => { console.error('Offline evaluation failed; no provider calls made. Run focused evaluation tests for diagnostic evidence.'); process.exitCode = 1 })
