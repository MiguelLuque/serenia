import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

it('prints offline, machine-readable current and hypothetical scenarios', () => {
  const output = execFileSync(process.execPath, ['--import', 'tsx', resolve('scripts/model-costs.ts')], { cwd: resolve('.'), encoding: 'utf8', env: { PATH: process.env.PATH, NODE_ENV: 'test' } })
  const result = JSON.parse(output)
  expect(result.snapshot).toMatchObject({ date: '2026-11-01', processingMode: 'standard' })
  expect(result.scenarios.currentCadence.calls).toBe(41)
  expect(result.scenarios.currentCadence.baseline.usd).toBe(0.37725)
  expect(result.scenarios.currentCadence.lunaLunaSol.usd).toBe(0.101)
  expect(result.scenarios.hypotheticalFourProfileCalls.baseline.usd).toBe(0.23325)
  expect(result.scenarios.hypotheticalFourProfileCalls.lunaLunaSol.usd).toBe(0.0834)
  expect(result.onlineCalls).toBe(0)
})
