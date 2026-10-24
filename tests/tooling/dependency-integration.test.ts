import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { zodSchema } from 'ai'
import { AssessmentGenerationSchema } from '@/lib/server/assessments/generator'

// Transport regressions run in a disposable child: vulnerable releases can
// emit an uncaught stream error. Only ephemeral loopback ports are used.
function child(source: string, argument = '') {
  const result = spawnSync(process.execPath, ['--input-type=commonjs', '-e', source, argument], {
    cwd: process.cwd(), env: { PATH: process.env.PATH, NODE_ENV: 'test' },
    encoding: 'utf8', timeout: 12_000, maxBuffer: 32_000,
  })
  expect({ exit: result.status, error: result.error?.message, stderr: result.stderr }).toEqual({ exit: 0, error: undefined, stderr: '' })
  expect(result.stdout.trim()).toBe('PASS')
}

describe('patched schema and transport integration', () => {
  it('rejects oversized constrained collections before visiting their elements', () => {
    let visits = 0
    const schema = z.array(z.string().superRefine(() => { visits++ })).max(1)
    expect(schema.safeParse(['synthetic-a', 'synthetic-b']).success).toBe(false)
    expect(visits).toBe(0)
  })

  it('keeps the real AI SDK report schema strict and fully required', async () => {
    const schema = await zodSchema(AssessmentGenerationSchema).jsonSchema
    expect(schema.required).toEqual(expect.arrayContaining(['questionnaires', 'proposed_tasks', 'risk_assessment']))
    expect(schema.additionalProperties).toBe(false)
    const risk = schema.properties?.risk_assessment as { required: string[]; additionalProperties: boolean }
    expect(risk.required).toEqual(expect.arrayContaining(['heteroaggression', 'substance_use_acute']))
    expect(risk.additionalProperties).toBe(false)
    const questionnaire = schema.properties?.questionnaires as { items: { required: string[] } }
    expect(questionnaire.items.required).toEqual(expect.arrayContaining(['code', 'score', 'band', 'flags']))
  })

  it('survives trailing bytes after a compressed body and serves the next request', () => {
    child(String.raw`
      const http = require('node:http'); const { gzipSync } = require('node:zlib');
      const parser = require('body-parser').json(); const assert = require('node:assert/strict');
      const server = http.createServer((req,res) => parser(req,res,error => {
        res.statusCode = error ? 400 : 200; res.end(error ? 'rejected' : JSON.stringify(req.body));
      }));
      const request = (port,body,encoding) => new Promise((resolve,reject) => {
        const req=http.request({hostname:'127.0.0.1',port,method:'POST',headers:{'content-type':'application/json','content-length':body.length,...(encoding?{'content-encoding':encoding}:{})}},res=>{
          let text=''; res.on('data',chunk=>text+=chunk); res.on('end',()=>resolve({status:res.statusCode,text}));
        }); req.on('error',reject); req.end(body);
      });
      (async()=>{
        await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); const port=server.address().port;
        const bad=Buffer.concat([gzipSync(Buffer.from('{"synthetic":true}')),Buffer.from('trailing-bytes')]);
        await request(port,bad,'gzip');
        await new Promise(resolve=>setTimeout(resolve,30));
        const next=await request(port,Buffer.from('{"synthetic":true}'));
        assert.equal(next.status,200); assert.deepEqual(JSON.parse(next.text),{synthetic:true});
        server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); console.log('PASS');
      })().catch(error=>{console.error(error);process.exit(1)});
    `)
  }, 15_000)

  it.each(['@ai-sdk/provider-utils', '@workflow/world-local'])('keeps %s transport alive after excessive content encodings', parent => {
    child(String.raw`
      const http=require('node:http'); const {createRequire}=require('node:module'); const {join}=require('node:path');
      const assert=require('node:assert/strict'); const parent=createRequire(join(process.cwd(),'node_modules',process.argv[1],'package.json'));
      const {fetch}=parent('undici');
      const server=http.createServer((req,res)=>{
        if(req.url==='/bad'){res.writeHead(200,{'content-encoding':'gzip, gzip, gzip, gzip, gzip, gzip','content-length':'10'});res.flushHeaders();res.destroy();}
        else res.end('synthetic-ok');
      });
      (async()=>{
        await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
        await assert.rejects(async()=>{const response=await fetch(base+'/bad');await response.text();});
        await new Promise(resolve=>setTimeout(resolve,30));
        assert.equal(await (await fetch(base+'/ok')).text(),'synthetic-ok');
        server.closeAllConnections();await new Promise(resolve=>server.close(resolve));console.log('PASS');
      })().catch(error=>{console.error(error);process.exit(1)});
    `, parent)
  }, 15_000)

  it('enforces mixed-case SRI through the Workflow transport', () => {
    child(String.raw`
      const http=require('node:http');const {createRequire}=require('node:module');const {join}=require('node:path');
      const {createHash}=require('node:crypto');const assert=require('node:assert/strict');
      const {fetch}=createRequire(join(process.cwd(),'node_modules/@workflow/world-local/package.json'))('undici');
      const server=http.createServer((_req,res)=>res.end('different synthetic bytes'));
      (async()=>{
        await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
        const integrity='SHA256-'+createHash('sha256').update('expected synthetic bytes').digest('base64');
        await assert.rejects(async()=>{await fetch(url,{integrity});});
        server.closeAllConnections();await new Promise(resolve=>server.close(resolve));console.log('PASS');
      })().catch(error=>{console.error(error);process.exit(1)});
    `)
  }, 15_000)
})
