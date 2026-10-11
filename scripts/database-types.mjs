import { readFileSync, writeFileSync, renameSync } from 'node:fs'
import { resolve } from 'node:path'
import { projectRoot, runSupabase } from './supabase-local.mjs'

const mode = process.argv[2]
if (!['check', 'generate'].includes(mode)) throw new Error('Expected check or generate')
const result = runSupabase(['gen', 'types', '--local', '--lang', 'typescript', '--schema', 'public'], { maxBuffer: 16 * 1024 * 1024 })
if (result.error || result.status !== 0 || !result.stdout.includes('export type Database')) {
  console.error(result.stderr || 'Type generation failed or returned no Database type')
  process.exitCode = 1
} else {
  const target = resolve(projectRoot, 'lib/shared/supabase/types.ts')
  if (mode === 'check') {
    if (readFileSync(target, 'utf8') !== result.stdout) {
      console.error('Database types differ; review npm run db:types:generate output before committing')
      process.exitCode = 1
    }
  } else {
    const temporary = target + '.generated.tmp'
    writeFileSync(temporary, result.stdout, { flag: 'wx' })
    renameSync(temporary, target)
  }
}
