import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('prepared hosted profile readback', () => {
  it('runs the read-only receipt and negative verification checks', () => {
    const result = spawnSync(process.execPath, ['--test', 'tests/tooling/profile-hosted-readback.test.mjs'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 10000,
      env: { PATH: process.env.PATH, NODE_ENV: 'test' },
    })
    expect(result.status, result.stderr || result.stdout).toBe(0)
  })
})
