import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { localCredentials, acceptanceEnvironment, privateDirectory } from './acceptance-local.mjs'
const [mode, directory] = process.argv.slice(2)
if (!['fixtures', 'http', 'closure', 'inspect', 'browser-fixtures'].includes(mode) || !directory || process.argv.length !== 4) throw new Error('Usage: acceptance-run.mjs fixtures|http|closure|inspect|browser-fixtures ABS_PRIVATE_STATE_DIR')
const env = acceptanceEnvironment(process.env, localCredentials(), privateDirectory(directory))
const result = spawnSync(process.execPath, [resolve('scripts/acceptance-scenarios.mjs'), mode], { cwd: process.cwd(), env, stdio: 'inherit' })
process.exitCode = result.status ?? 1
