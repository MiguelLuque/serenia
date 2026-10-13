import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { acceptanceEnvironment, localOrigin } from '../../scripts/acceptance-local.mjs'
import { findIntendedRetry, intendedEvents, readBoundRun } from '../../scripts/acceptance-checkpoint.mjs'
import { dehydrateWorkflowArguments } from '@workflow/core/serialization'

describe('synthetic acceptance boundary', () => {
  it('reads only finalized intended events and validates actual SDK arguments against the recorded job token',async()=>{
    const directory=realpathSync(mkdtempSync(resolve(tmpdir(),'serenia-checkpoint-test-')))
    mkdirSync(resolve(directory,'workflow/events'),{recursive:true});mkdirSync(resolve(directory,'workflow/runs'))
    const actor={sessionId:'fixture-session'},job={session_id:'fixture-session',token:'fixture-token',run_id:'wrun_intended'}
    try{
      const input=await dehydrateWorkflowArguments([{sessionId:actor.sessionId,jobToken:job.token}],job.run_id,undefined,[],globalThis)
      if(!(input instanceof Uint8Array))throw new Error('Expected actual SDK Uint8Array arguments')
      writeFileSync(resolve(directory,'workflow/runs/wrun_intended.json'),JSON.stringify({runId:job.run_id,workflowName:'generateAssessmentWorkflow',input:{__type:'Uint8Array',data:Buffer.from(input).toString('base64')}}))
      writeFileSync(resolve(directory,'workflow/events/wrun_unrelated-first.json'),JSON.stringify({runId:'wrun_unrelated',eventType:'step_retrying'}))
      writeFileSync(resolve(directory,'workflow/events/wrun_intended-partial.json.tmp'),'unfinished')
      const retry={runId:job.run_id,eventType:'step_retrying'}
      writeFileSync(resolve(directory,'workflow/events/wrun_intended-final.json'),JSON.stringify(retry))
      expect(intendedEvents(directory,job.run_id)).toEqual([{name:'wrun_intended-final.json',event:retry}])
      expect((await readBoundRun(directory,actor,job)).input).toEqual([{sessionId:'fixture-session',jobToken:'fixture-token'}])
      await expect(readBoundRun(directory,actor,{...job,token:'stale-token'})).rejects.toThrow('arguments mismatch')
    }finally{rmSync(directory,{recursive:true,force:true})}
  })
  it('unrelated retry arriving first cannot satisfy the intended actor/job/run checkpoint',()=>{
    const actor={userId:'fixture-user',sessionId:'fixture-session'}
    const job={session_id:'fixture-session',token:'fixture-token',run_id:'wrun_intended'}
    const unrelated={name:'wrun_unrelated-event.json',event:{runId:'wrun_unrelated',eventType:'step_retrying'}}
    const intended={name:'wrun_intended-event.json',event:{runId:'wrun_intended',eventType:'step_retrying'}}
    const input=[{sessionId:'fixture-session',jobToken:'fixture-token'}]
    expect(findIntendedRetry([unrelated],actor,job,input)).toBeNull()
    expect(findIntendedRetry([unrelated,intended],actor,job,input)).toEqual(intended)
    expect(findIntendedRetry([intended],actor,job,[{sessionId:'other-session',jobToken:'fixture-token'}])).toBeNull()
    expect(findIntendedRetry([intended],actor,job,[{sessionId:'fixture-session',jobToken:'stale-token'}])).toBeNull()
    expect(findIntendedRetry([intended],actor,{...job,session_id:'other-session'},input)).toBeNull()
  })
  it('promotion requires explicit loopback configuration before reading users', async () => {
    const { promotionConfig } = await import('../../scripts/promote-clinician')
    expect(() => promotionConfig({ NEXT_PUBLIC_SUPABASE_URL: 'https://remote.supabase.co', SUPABASE_SECRET_KEY: 'fictional' })).toThrow()
    expect(() => promotionConfig({ NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' })).toThrow()
    expect(promotionConfig({ NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SECRET_KEY: 'fictional' })).toEqual({ url: 'http://127.0.0.1:54321', secret: 'fictional' })
  })
  it('rejects remote, credential-bearing and ambiguous destinations', () => {
    for (const url of ['https://127.0.0.1:54321', 'http://localhost:54321', 'http://127.0.0.1:54322', 'http://key@127.0.0.1:54321', 'http://127.0.0.1:54321/other', 'http://remote.invalid:54321']) expect(() => localOrigin(url, 54321)).toThrow()
    const env = acceptanceEnvironment({ PATH: process.env.PATH, NODE_OPTIONS: '--require /bad', OPENAI_API_KEY: 'bad', SUPABASE_ACCESS_TOKEN: 'bad', HTTP_PROXY: 'bad' }, { url: 'http://127.0.0.1:54321', publicKey: 'fictional', secretKey: 'fictional' }, '/private/tmp/fictional')
    for (const name of ['NODE_OPTIONS', 'OPENAI_API_KEY', 'SUPABASE_ACCESS_TOKEN', 'HTTP_PROXY']) expect(env).not.toHaveProperty(name)
  })
  it('runs installed AI SDK through ProviderV3 and fails closed for model/network expansion', () => {
    const directory = realpathSync(mkdtempSync(resolve(tmpdir(), 'serenia-provider-test-')))
    writeFileSync(resolve(directory, 'control.json'), '{"structured":"success"}')
    try {
      const result = spawnSync(process.execPath, ['--import', resolve('scripts/acceptance-provider.mjs'), '--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        import { generateText } from 'ai';
        import net from 'node:net';
        const response = await generateText({model:'synthetic/structured', prompt:'synthetic'});
        assert.ok(response.text.includes('patient_facing_summary'));
        assert.throws(() => globalThis.AI_SDK_DEFAULT_PROVIDER.languageModel('external/model'));
        await assert.rejects(fetch('https://external.invalid/'));
        assert.throws(() => net.connect({host:'external.invalid',port:443}));
      `], { encoding: 'utf8', env: acceptanceEnvironment(process.env, { url: 'http://127.0.0.1:54321', publicKey: 'fictional', secretKey: 'fictional' }, directory) })
      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
      const ledger = readFileSync(resolve(directory, 'provider.jsonl'), 'utf8')
      expect(ledger).toContain('"modelId":"synthetic/structured"')
      expect(ledger.match(/network_denied/g)).toHaveLength(2)
    } finally { rmSync(directory, { recursive: true, force: true }) }
  })
  it('proposes synthetic questionnaires only for deliberate fixture requests', () => {
    const directory = realpathSync(mkdtempSync(resolve(tmpdir(), 'serenia-provider-request-test-')))
    writeFileSync(resolve(directory, 'control.json'), '{"structured":"success"}')
    try {
      const result = spawnSync(process.execPath, ['--import', resolve('scripts/acceptance-provider.mjs'), '--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        const model = globalThis.AI_SDK_DEFAULT_PROVIDER.languageModel('synthetic/conversational');
        async function calls(text) {
          const response = await model.doStream({prompt:[{role:'user',content:[{type:'text',text}]}]});
          return (await Array.fromAsync(response.stream)).filter(part => part.type === 'tool-call');
        }
        for (const [text, code] of [['Solicito el cuestionario PHQ9','PHQ9'], ['[CSSRS] Solicito el cuestionario','CSSRS']]) {
          const proposed = await calls(text);
          assert.equal(proposed.length, 1);
          assert.equal(proposed[0].toolName, 'propose_questionnaire');
          assert.equal(JSON.parse(proposed[0].input).code, code);
        }
        for (const text of ['He completado el cuestionario.', 'He terminado el PHQ9', 'Ahora me siento tranquilo']) assert.equal((await calls(text)).length, 0);
      `], { encoding: 'utf8', env: acceptanceEnvironment(process.env, { url: 'http://127.0.0.1:54321', publicKey: 'fictional', secretKey: 'fictional' }, directory) })
      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
    } finally { rmSync(directory, { recursive: true, force: true }) }
  })
})
