import { describe,it,expect } from 'vitest'
import { mkdtempSync, writeFileSync, symlinkSync, rmSync, realpathSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { hostedOrigin, selectedConnection, hostedEnvironment, secureDirectory, assertFixture } from '../../scripts/hosted-acceptance.mjs'
import { makePacket, sourceFiles, sha256 } from '../../scripts/hosted-packet.mjs'
import { readFileSync } from 'node:fs'

describe('target-bound hosted acceptance',()=>{
  it('rejects every origin expansion before credentials are returned',()=>{
    for(const value of ['http://brpozobkoatabctjjadc.supabase.co','https://other.supabase.co','https://brpozobkoatabctjjadc.supabase.co/extra','https://secret@brpozobkoatabctjjadc.supabase.co','https://brpozobkoatabctjjadc.supabase.co?x=1','https://brpozobkoatabctjjadc.supabase.co:444']) expect(()=>hostedOrigin(value)).toThrow()
    expect(hostedOrigin('https://brpozobkoatabctjjadc.supabase.co')).toBe('https://brpozobkoatabctjjadc.supabase.co')
    expect(()=>selectedConnection('NEXT_PUBLIC_SUPABASE_URL=https://other.supabase.co\nSUPABASE_SECRET_KEY=sb_secret_test')).toThrow(/target/)
  })
  it('selects only approved connection names and never expands dotenv references',()=>{
    const text='NEXT_PUBLIC_SUPABASE_URL=https://brpozobkoatabctjjadc.supabase.co\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test\nSUPABASE_SECRET_KEY=sb_secret_test\nOPENAI_API_KEY=never-load\nNEXT_PUBLIC_SITE_URL=https://external.invalid\n'
    expect(selectedConnection(text)).toEqual({url:'https://brpozobkoatabctjjadc.supabase.co',publicKey:'sb_publishable_test',secretKey:'sb_secret_test',provenance:{url:'NEXT_PUBLIC_SUPABASE_URL',publicKey:'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',secretKey:'SUPABASE_SECRET_KEY'}})
    expect(()=>selectedConnection(text+'SUPABASE_SECRET_KEY=sb_secret_duplicate\n')).toThrow(/Duplicate/)
    expect(()=>selectedConnection(text.replace('sb_secret_test','$UNAPPROVED_KEY'))).toThrow()
    const jwt=(role:string,ref='brpozobkoatabctjjadc')=>'e30.'+Buffer.from(JSON.stringify({role,ref,iss:'supabase'})).toString('base64url')+'.test'
    expect(()=>selectedConnection(text.replace('sb_publishable_test',jwt('service_role')))).toThrow()
    expect(()=>selectedConnection(text.replace('sb_secret_test',jwt('service_role','other')))).toThrow()
  })
  it('strips all parent secrets and requires a private immutable fixture manifest',()=>{
    const directory=realpathSync(mkdtempSync(resolve(tmpdir(),'serenia-hosted-test-')))
    try {
      const env=hostedEnvironment({PATH:process.env.PATH,OPENAI_API_KEY:'bad',SUPABASE_ACCESS_TOKEN:'bad',NODE_OPTIONS:'bad',HTTPS_PROXY:'bad'},{url:'https://brpozobkoatabctjjadc.supabase.co',publicKey:'sb_publishable_test',secretKey:'sb_secret_test'},directory,'private-cron-test')
      for(const key of ['OPENAI_API_KEY','SUPABASE_ACCESS_TOKEN','NODE_OPTIONS','HTTPS_PROXY']) expect(env).not.toHaveProperty(key)
      expect(env.CRON_SECRET).toBe('private-cron-test'); expect(env.WORKFLOW_TARGET_WORLD).toBe('local')
      const manifest={runId:'run',actors:{patient:{userId:'00000000-0000-4000-8000-000000000001',sessionId:'00000000-0000-4000-8000-000000000002',email:'serenia-task7-run-patient@example.test'}}}
      expect(assertFixture(manifest,'patient')).toBe(manifest.actors.patient)
      expect(()=>assertFixture(manifest,'other')).toThrow()
      chmodSync(directory,0o755); expect(()=>secureDirectory(directory)).toThrow();chmodSync(directory,0o700)
      symlinkSync(directory,resolve(directory,'link'));expect(()=>secureDirectory(resolve(directory,'link'))).toThrow()
    }finally{rmSync(directory,{recursive:true,force:true})}
  })
  it('retains exact source bytes/dollar quotes and one history mapping',()=>{
    const {packet,manifest}=makePacket()
    for(const [index,section]of manifest.sections.entries()){
      const bytes=readFileSync(resolve('supabase/migrations',sourceFiles[index]))
      expect(packet.subarray(section.offset,section.offset+section.bytes)).toEqual(bytes)
      expect(section.sha256).toBe(sha256(bytes))
    }
    expect(manifest.history).toHaveLength(40);expect(manifest.sections).toHaveLength(6)
    expect(packet.toString()).not.toMatch(/^\s*(?:commit|begin|vacuum)\s*;/im)
  })
  it('preserves the rejected packet identity separately from its corrected successor',()=>{
    const rejected='724e9a374d1846e01fee1612bb4e687bf56e5959f9c1c32f512114cb904ec1ae'
    const archive=resolve('supabase/hosted/archive',rejected)
    const bytes=readFileSync(resolve(archive,'serenia-atomic.sql'))
    const prior=JSON.parse(readFileSync(resolve(archive,'manifest.json'),'utf8'))
    const outcome=JSON.parse(readFileSync(resolve(archive,'outcome.json'),'utf8'))
    expect(bytes.length).toBe(92971);expect(sha256(bytes)).toBe(rejected)
    expect(sha256(readFileSync(resolve(archive,'manifest.json')))).toBe('125c36195659add167cf569bed2feac7c9304e865572ad2ed0607dc4615254c0')
    expect(prior.packetSha256).toBe(rejected);expect(prior.packetBytes).toBe(bytes.length)
    expect(outcome.status).toBe('SQL_REJECTED_NOT_APPLIED');expect(outcome.sqlstate).toBe('P0001')
    expect(makePacket().manifest).toMatchObject({supersedes:{packetSha256:rejected,packetBytes:92971,status:'SQL_REJECTED_NOT_APPLIED'}})
  })
  it('runs the actual synthetic provider and denies external fetch/socket destinations',()=>{
    const directory=realpathSync(mkdtempSync(resolve(tmpdir(),'serenia-hosted-provider-')))
    writeFileSync(resolve(directory,'control.json'),'{"structured":"success"}',{mode:0o600})
    try{
      const result=spawnSync(process.execPath,['--import',resolve('scripts/hosted-provider.mjs'),'--input-type=module','-e',"import assert from 'node:assert/strict';import {generateText} from 'ai';import net from 'node:net';const r=await generateText({model:'synthetic/structured',prompt:'synthetic'});assert.ok(r.text.includes('patient_facing_summary'));await assert.rejects(fetch('https://other.supabase.co'));assert.throws(()=>net.connect({host:'external.invalid',port:443}));"],{encoding:'utf8',env:hostedEnvironment(process.env,{url:'https://brpozobkoatabctjjadc.supabase.co',publicKey:'sb_publishable_test',secretKey:'sb_secret_test'},directory,'test-cron')})
      expect(result.status,result.stderr).toBe(0)
    }finally{rmSync(directory,{recursive:true,force:true})}
  })
})
