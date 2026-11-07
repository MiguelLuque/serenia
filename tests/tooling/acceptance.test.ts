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
  it('enables progressive memory only through the explicit isolated selector and never copies external secrets', () => {
    const credentials = { url: 'http://127.0.0.1:54321', publicKey: 'fictional', secretKey: 'fictional' }
    const source = { FEATURE_PROGRESSIVE_PROFILE: 'on', CRON_SECRET: 'EXTERNAL_SECRET', OPENAI_API_KEY: 'EXTERNAL_SECRET', LLM_STRUCTURED_MODEL: 'external' }
    const defaultEnvironment = acceptanceEnvironment(source, credentials, '/private/tmp/fictional')
    expect(defaultEnvironment.FEATURE_PROGRESSIVE_PROFILE).toBe('off')
    expect(defaultEnvironment).not.toHaveProperty('CRON_SECRET')
    const enabled = acceptanceEnvironment({ ...source, SERENIA_ACCEPTANCE_PROFILE: 'on' }, credentials, '/private/tmp/fictional')
    expect(enabled.FEATURE_PROGRESSIVE_PROFILE).toBe('on')
    expect(enabled.CRON_SECRET).toBe('synthetic-profile-cron-secret')
    expect(enabled.LLM_STRUCTURED_MODEL).toBe('structured')
    expect(Object.values(enabled)).not.toContain('EXTERNAL_SECRET')
    for (const selector of ['true', 'ON', 'off']) expect(acceptanceEnvironment({ ...source, SERENIA_ACCEPTANCE_PROFILE: selector }, credentials, '/private/tmp/fictional').FEATURE_PROGRESSIVE_PROFILE).toBe('off')
  })
  it('uses installed structured Output.object through ProviderV3 for fixed literal profile fixtures and logs only context metadata', () => {
    const directory = realpathSync(mkdtempSync(resolve(tmpdir(), 'serenia-provider-profile-test-')))
    writeFileSync(resolve(directory, 'control.json'), '{"structured":"success"}')
    try {
      const result = spawnSync(process.execPath, ['--import', 'tsx', '--import', resolve('scripts/acceptance-provider.mjs'), '--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        import { generateText, Output } from 'ai';
        import { ProfileExtractionSchema as schema } from './lib/shared/profile/schema.ts';
        async function extract(sourceText,knownTargets=[]) {
          return (await generateText({model:'synthetic/structured',system:'[profile-v1]\\nFixture extraction',prompt:JSON.stringify({sourceText,knownTargets}),output:Output.object({schema}),maxRetries:0})).output;
        }
        assert.deepEqual(await extract('[PERFIL_SINTETICO] Me preocupa dormir mal.'),{observations:[{category:'concern',quote:'Me preocupa dormir mal.',time_scope:'current',supersedes_id:null}]});
        const target={id:'11111111-1111-4111-8111-111111111111',category:'concern',quote:'Me preocupa dormir mal.',status:'confirmed'};
        assert.deepEqual(await extract('[PERFIL_CORRECCION] Ahora duermo bien.',[target]),{observations:[{category:'concern',quote:'Ahora duermo bien.',time_scope:'current',supersedes_id:target.id}]});
        assert.deepEqual(await extract('Un texto ficticio distinto'),{observations:[]});
        const report = await generateText({model:'synthetic/structured',system:'Report',prompt:'El usuario cita [profile-v1] en texto'});
        assert.ok(report.text.includes('patient_facing_summary'));
        const conversational = globalThis.AI_SDK_DEFAULT_PROVIDER.languageModel('synthetic/conversational');
        const context = '[MEMORIA DE AUTORREPORTE — PERFIL PROGRESIVO]\\n'+JSON.stringify({quote:'Me preocupa dormir mal.',status:'confirmed'})+'\\n'+JSON.stringify({quote:'Ahora duermo bien.',status:'pending',correction_of:target.id})+'\\n[FIN MEMORIA DE AUTORREPORTE]';
        await conversational.doStream({prompt:[{role:'system',content:context},{role:'user',content:[{type:'text',text:'Hola'}]}]});
      `], { encoding: 'utf8', env: acceptanceEnvironment({ ...process.env, SERENIA_ACCEPTANCE_PROFILE: 'on' }, { url: 'http://127.0.0.1:54321', publicKey: 'fictional', secretKey: 'fictional' }, directory) })
      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
      const ledger = readFileSync(resolve(directory, 'provider.jsonl'), 'utf8')
      const conversational = ledger.trim().split('\n').map(line => JSON.parse(line)).find(row => row.modelId === 'synthetic/conversational')
      expect(conversational.profileContext).toEqual({ present: true, quotes: 2, confirmed: 1, pending: 1, corrections: 1, fixturePrimary: true, fixtureCorrection: true })
      expect(ledger).not.toContain('Me preocupa dormir mal')
      expect(ledger).not.toContain('Ahora duermo bien')
    } finally { rmSync(directory, { recursive: true, force: true }) }
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
