import { spawn } from 'node:child_process'
import { readFileSync, existsSync, openSync, readdirSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:net'
import { credentialsFromProject, hostedEnvironment, secureDirectory, privateFile, cronSecret } from './hosted-acceptance.mjs'
import { sha256, target } from './hosted-packet.mjs'

export function artifactIdentity(snapshot) {
  if(realpathSync(snapshot)!==snapshot)throw new Error('Artifact symlink forbidden')
  const files={}
  function scan(directory) {
    for(const entry of readdirSync(resolve(snapshot,directory),{withFileTypes:true})) {
      const path=directory+'/'+entry.name
      if(entry.isSymbolicLink())throw new Error('Artifact code symlink forbidden')
      if(path==='.next/cache')continue
      if(entry.isDirectory())scan(path)
      else if(entry.isFile())files[path]=sha256(readFileSync(resolve(snapshot,path)))
    }
  }
  for(const directory of ['.next','scripts','app','lib'])scan(directory)
  for(const path of ['package.json','package-lock.json','next.config.ts'])if(existsSync(resolve(snapshot,path)))files[path]=sha256(readFileSync(resolve(snapshot,path)))
  return {buildId:readFileSync(resolve(snapshot,'.next/BUILD_ID'),'utf8').trim(),files,aggregateSha256:sha256(JSON.stringify(files))}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [buildDirectory,stateDirectory]=process.argv.slice(2)
  if(!buildDirectory||!stateDirectory||process.argv.length!==4)throw new Error('Usage: hosted-start.mjs ABS_BUILD_DIR ABS_PRIVATE_STATE_DIR')
  secureDirectory(buildDirectory);const directory=secureDirectory(stateDirectory)
  for(const file of ['metadata.json','result.json','artifact.json'])privateFile(resolve(buildDirectory,file))
  const metadata=JSON.parse(readFileSync(resolve(buildDirectory,'metadata.json'),'utf8'))
  const result=JSON.parse(readFileSync(resolve(buildDirectory,'result.json'),'utf8'))
  const artifact=JSON.parse(readFileSync(resolve(buildDirectory,'artifact.json'),'utf8'))
  const credentials=credentialsFromProject()
  if(!metadata.hostedAcceptance||metadata.targetOrigin!==target.apiOrigin||result.exit!==0||sha256(credentials.publicKey)!==metadata.publicKeySha256)throw new Error('Hosted build/config identity mismatch')
  const snapshot=metadata.snapshot
  if(sha256(readFileSync(resolve(snapshot,'package-lock.json')))!==metadata.lockSha256||artifactIdentity(snapshot).aggregateSha256!==artifact.aggregateSha256)throw new Error('Immutable artifact identity mismatch')
  for(const name of ['.env','.env.local','.env.production','.env.production.local'])if(existsSync(resolve(snapshot,name)))throw new Error('Environment files forbidden in immutable snapshot')
  await new Promise((done,reject)=>{
    const probe=createServer();probe.once('error',()=>reject(new Error('Port 3000 busy; coordinate the recorded task-owned process first')))
    probe.listen({host:'127.0.0.1',port:3000,exclusive:true},()=>probe.close(done))
  })
  const control=resolve(directory,'control.json');privateFile(control)
  if(!existsSync(control))privateFile(control,'{"structured":"success"}\n')
  const logfile=privateFile(resolve(directory,`next-${Date.now()}.log`));const fd=openSync(logfile,'w',0o600)
  const child=spawn(process.execPath,['--import',resolve(snapshot,'scripts/hosted-provider.mjs'),resolve(snapshot,'node_modules/next/dist/bin/next'),'start',snapshot,'--hostname','127.0.0.1','--port','3000'],{cwd:snapshot,env:hostedEnvironment(process.env,credentials,directory,cronSecret(directory)),stdio:['ignore',fd,fd]})
  const identity={sourceCommit:metadata.sourceCommit,lockSha256:metadata.lockSha256,buildId:artifact.buildId,artifactSha256:artifact.aggregateSha256,snapshot,stateDirectory:directory,url:target.appOrigin,targetOrigin:target.apiOrigin,pid:child.pid,logfile}
  privateFile(resolve(directory,'runtime.json'),JSON.stringify(identity,null,2)+'\n');console.log(JSON.stringify(identity))
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal))
  child.on('exit',(code,signal)=>{console.log(JSON.stringify({exit:code,signal,logfile}));process.exitCode=code??1})
}
