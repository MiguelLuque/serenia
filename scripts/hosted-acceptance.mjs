import { readFileSync, mkdirSync, lstatSync, realpathSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, isAbsolute, dirname } from 'node:path'
import { randomBytes } from 'node:crypto'
import { target } from './hosted-packet.mjs'
const allowed = new Set(['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY'])
export function hostedOrigin(value) {
  if(value!==target.apiOrigin) throw new Error('Exact hosted target origin required')
  return value
}
export function selectedConnection(text) {
  const selected={}
  for(const line of text.split(/\r?\n/)) {
    const name=line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=/)?.[1]
    if(!allowed.has(name)) continue
    if(Object.hasOwn(selected,name)) throw new Error('Duplicate selected connection name')
    let value=line.slice(line.indexOf('=')+1).trim()
    if(value.startsWith('"')||value.startsWith("'")) {
      const quote=value[0];if(!value.endsWith(quote))throw new Error('Multiline connection values forbidden')
      value=value.slice(1,-1)
    }
    if(/[\s$`\\]/.test(value)) throw new Error('Connection expansion/escapes forbidden')
    selected[name]=value
  }
  const url=hostedOrigin(selected.NEXT_PUBLIC_SUPABASE_URL)
  const publicName=selected.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  const secretName=selected.SUPABASE_SECRET_KEY?'SUPABASE_SECRET_KEY':'SUPABASE_SERVICE_ROLE_KEY'
  const publicKey=selected[publicName],secretKey=selected[secretName]
  if(!publicKey||!secretKey) throw new Error('Missing connection names: '+[!publicKey?'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY':null,!secretKey?'SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY':null].filter(Boolean).join(', '))
  for(const [value,role,prefix]of [[publicKey,'anon','sb_publishable_'],[secretKey,'service_role','sb_secret_']]) {
    if(value.startsWith(prefix)&&/^sb_(?:publishable|secret)_[a-zA-Z0-9_-]+$/.test(value))continue
    try{
      const parts=value.split('.');const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString())
      if(parts.length!==3||payload.role!==role||payload.ref!==target.projectId||payload.iss!=='supabase')throw new Error()
    }catch{throw new Error('Connection key role/target validation failed')}
  }
  if(publicKey===secretKey)throw new Error('Public and secret keys must differ')
  return {url,publicKey,secretKey,provenance:{url:'NEXT_PUBLIC_SUPABASE_URL',publicKey:publicName,secretKey:secretName}}
}
export function credentialsFromProject(root=resolve('.')) {
  const path=resolve(root,'.env.local')
  if(!existsSync(path))throw new Error('Missing .env.local selected connection configuration')
  if(lstatSync(path).isSymbolicLink()||realpathSync(path)!==path)throw new Error('Connection file symlink forbidden')
  return selectedConnection(readFileSync(path,'utf8'))
}
export function secureDirectory(path) {
  if(!isAbsolute(path))throw new Error('Absolute private directory required')
  mkdirSync(path,{recursive:true,mode:0o700})
  if(lstatSync(path).isSymbolicLink()||realpathSync(path)!==path||(lstatSync(path).mode&0o077))throw new Error('Private non-symlink directory required')
  return path
}
export function privateFile(path,data) {
  secureDirectory(dirname(path))
  if(existsSync(path)&&(lstatSync(path).isSymbolicLink()||!lstatSync(path).isFile()||(lstatSync(path).mode&0o077)))throw new Error('Private regular file required')
  if(data!==undefined)writeFileSync(path,data,{mode:0o600})
  return path
}
export function cronSecret(directory) {
  const path=privateFile(resolve(secureDirectory(directory),'cron-secret'))
  if(!existsSync(path))privateFile(path,randomBytes(32).toString('base64url'))
  const secret=readFileSync(path,'utf8');if(!/^[A-Za-z0-9_-]{43}$/.test(secret))throw new Error('Invalid private cron secret')
  return secret
}
/** @returns {NodeJS.ProcessEnv} */
export function hostedEnvironment(source,credentials,directory,cron) {
  hostedOrigin(credentials.url);secureDirectory(directory)
  if(!credentials.publicKey||!credentials.secretKey||!cron)throw new Error('Hosted child credentials missing')
  return {PATH:source.PATH,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',DO_NOT_TRACK:'1',
    NEXT_PUBLIC_SUPABASE_URL:credentials.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:credentials.publicKey,SUPABASE_SECRET_KEY:credentials.secretKey,NEXT_PUBLIC_SITE_URL:target.appOrigin,
    LLM_CONVERSATIONAL_PROVIDER:'synthetic',LLM_CONVERSATIONAL_MODEL:'conversational',LLM_FAST_PROVIDER:'synthetic',LLM_FAST_MODEL:'fast',LLM_STRUCTURED_PROVIDER:'synthetic',LLM_STRUCTURED_MODEL:'structured',
    WORKFLOW_TARGET_WORLD:'local',WORKFLOW_LOCAL_BASE_URL:target.appOrigin,WORKFLOW_LOCAL_DATA_DIR:resolve(directory,'workflow'),SERENIA_ACCEPTANCE_DIR:directory,
    FEATURE_CROSS_SESSION_CONTEXT:'off',FEATURE_AUXILIARY_DECISIONS:'off',CRON_SECRET:cron}
}
export function assertFixture(manifest,name) {
  const actor=manifest.actors?.[name]
  if(!manifest.runId||!actor||!actor.email?.startsWith(`serenia-task7-${manifest.runId}-`)||!actor.email.endsWith('@example.test')||!actor.userId?.match(/^[0-9a-f-]{36}$/))throw new Error('Recorded generated fixture required')
  return actor
}
