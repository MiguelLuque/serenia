import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { acceptanceEnvironment, localOrigin } from '../../scripts/acceptance-local.mjs'

describe('synthetic acceptance boundary', () => {
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
})
