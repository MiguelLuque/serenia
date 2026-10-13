import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { credentialsFromProject, hostedEnvironment, secureDirectory, cronSecret } from './hosted-acceptance.mjs'
const [mode,directory]=process.argv.slice(2)
if(!['fixtures','http','review','restart-checkpoint','restart-verify','cron','browser-fixtures','cleanup'].includes(mode)||!directory||process.argv.length!==4)throw new Error('Usage: hosted-run.mjs MODE ABS_PRIVATE_STATE_DIR')
const env=hostedEnvironment(process.env,credentialsFromProject(),secureDirectory(directory),cronSecret(directory))
const result=spawnSync(process.execPath,[resolve('scripts/hosted-scenarios.mjs'),mode],{cwd:process.cwd(),env,stdio:'inherit'})
process.exitCode=result.status??1
