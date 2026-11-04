import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dockerCommand } from './docker-command'

test('uses Docker directly if rtk is not installed', () => {
  const directory = mkdtempSync(join(tmpdir(), 'probe-path-'))
  try { assert.deepEqual(dockerCommand(directory), ['docker']) }
  finally { rmSync(directory, { recursive: true, force: true }) }
})

test('uses rtk proxy for Docker when an executable is on PATH', () => {
  const directory = mkdtempSync(join(tmpdir(), 'probe-path-'))
  try {
    const executable = join(directory, 'rtk')
    writeFileSync(executable, '#!/bin/sh\nexit 0\n'); chmodSync(executable, 0o700)
    assert.deepEqual(dockerCommand(directory), ['rtk', 'proxy', 'docker'])
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
