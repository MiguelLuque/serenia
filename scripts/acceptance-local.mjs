import { runSupabase } from './supabase-local.mjs'
import { resolve, isAbsolute } from 'node:path'
import { readFileSync, mkdirSync, lstatSync, realpathSync } from 'node:fs'

export function localOrigin(value, port) {
  const url = new URL(value)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.port !== String(port) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Only the explicit loopback origin is allowed')
  return url.origin
}
export function localCredentials() {
  const result = runSupabase(['status', '--output', 'json'])
  if (result.status !== 0) throw new Error('Local Supabase is not ready (status failed)')
  const status = JSON.parse(result.stdout)
  const url = localOrigin(status.API_URL, 54321)
  const publicKey = status.PUBLISHABLE_KEY || status.ANON_KEY
  const secretKey = status.SECRET_KEY || status.SERVICE_ROLE_KEY
  if (!publicKey || !secretKey) throw new Error('Local status omitted required credentials')
  return { url, publicKey, secretKey }
}
/** @returns {NodeJS.ProcessEnv} */
export function acceptanceEnvironment(source, credentials, directory) {
  localOrigin(credentials.url, 54321)
  if (!isAbsolute(directory)) throw new Error('Acceptance state requires an absolute private directory')
  return {
    PATH: source.PATH, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1',
    NEXT_PUBLIC_SUPABASE_URL: credentials.url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: credentials.publicKey,
    SUPABASE_SECRET_KEY: credentials.secretKey, NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3000',
    LLM_CONVERSATIONAL_PROVIDER: 'synthetic', LLM_CONVERSATIONAL_MODEL: 'conversational',
    LLM_FAST_PROVIDER: 'synthetic', LLM_FAST_MODEL: 'fast',
    LLM_STRUCTURED_PROVIDER: 'synthetic', LLM_STRUCTURED_MODEL: 'structured',
    WORKFLOW_TARGET_WORLD: 'local', WORKFLOW_LOCAL_BASE_URL: 'http://127.0.0.1:3000',
    WORKFLOW_LOCAL_DATA_DIR: resolve(directory, 'workflow'),
    SERENIA_ACCEPTANCE_DIR: directory, FEATURE_CROSS_SESSION_CONTEXT: 'off', FEATURE_AUXILIARY_DECISIONS: 'off',
  }
}
export function privateDirectory(directory) {
  if (!isAbsolute(directory)) throw new Error('Absolute directory required')
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  if (lstatSync(directory).isSymbolicLink() || realpathSync(directory) !== directory || (lstatSync(directory).mode & 0o077)) throw new Error('Private non-symlink directory required')
  return directory
}
export function readControl(directory) {
  return JSON.parse(readFileSync(resolve(directory, 'control.json'), 'utf8'))
}
