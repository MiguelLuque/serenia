import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const roots: string[] = []
afterEach(() => roots.forEach(root => rmSync(root, { recursive: true, force: true })))
describe('bounded CI evidence without stack credentials', () => {
  it('retains build and wire artifacts but exports only stack diagnostics, not key-bearing logs', async () => {
    const { collectEvidence } = await import('../../scripts/collect-ci-evidence.mjs')
    const root = mkdtempSync(join(tmpdir(), 'serenia-ci-test-')); roots.push(root)
    const stack = join(root, 'stack'); const output = join(root, 'output')
    for (const directory of [stack, join(root, 'serenia-build-fixture'), join(root, 'serenia-workflow-wire-fixture')]) mkdirSync(directory)
    writeFileSync(join(root, 'serenia-build-fixture/build.log'), 'Compiled successfully')
    writeFileSync(join(root, 'serenia-build-fixture/result.json'), '{"exit":0}')
    writeFileSync(join(root, 'serenia-workflow-wire-fixture/verification-4.8.13.json'), '{"failures":0}')
    writeFileSync(join(stack, 'supabase-start.log'), 'SECRET_KEY=synthetic-private-value\nfailed to start container\n')
    writeFileSync(join(stack, 'supabase-start.exit'), '1\n')
    const manifest = collectEvidence(root, stack, output)
    expect(manifest.files).toHaveLength(3)
    const diagnostics = readFileSync(join(output, 'local-stack-diagnostics.json'), 'utf8')
    expect(diagnostics).not.toContain('synthetic-private-value')
    expect(JSON.parse(diagnostics).stages.start.exit).toBe(1)
    expect(JSON.parse(diagnostics).stages.start.log.bytes).toBeGreaterThan(0)
    expect(readdirSync(output)).not.toContain('supabase-start.log')
  })
  it('ignores unexpected paths and symlinks and caps each file', async () => {
    const { collectEvidence } = await import('../../scripts/collect-ci-evidence.mjs')
    const root = mkdtempSync(join(tmpdir(), 'serenia-ci-test-')); roots.push(root)
    const build = join(root, 'serenia-build-fixture'); mkdirSync(build)
    writeFileSync(join(root, 'private.log'), 'synthetic-private-value')
    symlinkSync(join(root, 'private.log'), join(build, 'build.log'))
    writeFileSync(join(build, 'unexpected.log'), 'synthetic-private-value')
    writeFileSync(join(build, 'metadata.json'), 'a'.repeat(2 * 1024 * 1024 + 1))
    const manifest = collectEvidence(root, join(root, 'missing-stack'), join(root, 'output'))
    expect(manifest.files).toHaveLength(1)
    expect(manifest.files[0].truncated).toBe(true)
    expect(manifest.files[0].copiedBytes).toBe(2 * 1024 * 1024)
  })
})
