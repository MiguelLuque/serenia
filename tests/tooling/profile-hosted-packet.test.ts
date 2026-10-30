import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, mkdtempSync, cpSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const root = resolve('.')
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex')

describe('target-bound profile packet', () => {
  it('assembles deterministic exact accepted sections and rejects changed source/baseline bytes', async () => {
    expect(existsSync(resolve(root, 'scripts/profile-hosted-packet.mjs'))).toBe(true)
    const { makeProfilePacket, profileSources } = await import('../../scripts/profile-hosted-packet.mjs')
    const first = makeProfilePacket(root), second = makeProfilePacket(root)
    expect(first).toEqual(second)
    expect(first.manifest.status).toBe('PREPARED_NOT_APPLIED')
    expect(first.manifest.sourceBase).toBe('93fc4ef')
    expect(first.manifest.projectId).toBe('brpozobkoatabctjjadc')
    expect(first.manifest.canonicalName).toBe('serenia_progressive_profile_review')
    expect(first.manifest.noHistoricalReplay).toBe(true)
    expect(first.manifest).not.toHaveProperty('remoteVersion')
    expect(hash(first.packet)).toBe(first.manifest.packetSha256)
    expect(first.packet.length).toBe(first.manifest.packetBytes)
    expect(first.packet.toString()).not.toContain('@@')
    expect(readFileSync(resolve(root, 'supabase/hosted/profile-atomic.sql'))).toEqual(first.packet)
    expect(JSON.parse(readFileSync(resolve(root, 'supabase/hosted/profile-manifest.json'), 'utf8'))).toEqual(first.manifest)
    expect(first.manifest.sections).toHaveLength(4)
    for (const [index, section] of first.manifest.sections.entries()) {
      const source = readFileSync(resolve(root, 'supabase/migrations', section.filename))
      expect(section.filename).toBe(profileSources[index].filename)
      expect(section.sha256).toBe(profileSources[index].sha256)
      expect(section.position).toBe(index + 1)
      expect(section.bytes).toBe(source.length)
      expect(first.packet.subarray(section.offset, section.offset + section.bytes)).toEqual(source)
      expect(hash(source)).toBe(section.sha256)
    }
    const fixture = mkdtempSync(resolve(tmpdir(), 'serenia-profile-packet-'))
    try {
      cpSync(resolve(root, 'supabase'), resolve(fixture, 'supabase'), { recursive: true })
      for (const source of profileSources) {
        const path = resolve(fixture, 'supabase/migrations', source.filename), bytes = readFileSync(path)
        writeFileSync(path, Buffer.concat([bytes, Buffer.from('\n-- tampered')]))
        expect(() => makeProfilePacket(fixture)).toThrow(/source identity/)
        writeFileSync(path, bytes)
      }
      for (const filename of ['profile-baseline-20261030.json', 'profile-baseline-query.sql', 'profile-new-objects.json']) {
        const path = resolve(fixture, 'supabase/hosted', filename), bytes = readFileSync(path)
        writeFileSync(path, Buffer.concat([bytes, Buffer.from(' ')]))
        expect(() => makeProfilePacket(fixture)).toThrow(/baseline identity/)
        writeFileSync(path, bytes)
      }
    } finally { rmSync(fixture, { recursive: true, force: true }) }
  })
  it('rejects CLI target overrides before writing output', () => {
    const result = spawnSync(process.execPath, ['scripts/profile-hosted-packet.mjs', '--target=elsewhere'], { cwd: root, encoding: 'utf8' })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/No target or argument overrides/)
  })
})
