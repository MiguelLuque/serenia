import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { assertAuditGate } from '../../scripts/audit-dependencies.mjs'
const names = ['braces', 'micromatch', 'fast-glob', '@next/eslint-plugin-next', 'eslint-config-next']
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'))
const configSource = readFileSync('eslint.config.mjs', 'utf8')
type Entry = { severity: string; nodes: string[]; range: string; via: (string | { url: string; range: string; severity: string })[] }
function context() { return { lock: structuredClone(lock), configSource, config: [{}] as { settings?: { next?: { rootDir?: string } } }[], productionReport: { metadata: { vulnerabilities: { high: 0, critical: 0, total: 0 } }, vulnerabilities: {} as Record<string, Entry> } } }
function report(): { metadata: { vulnerabilities: { high: number; critical: number } }; vulnerabilities: Record<string, Entry> } {
  return { metadata: { vulnerabilities: { high: 5, critical: 0 } }, vulnerabilities: Object.fromEntries(names.map((name, index) => [name, {
    severity: 'high', nodes: ['node_modules/' + name], range: name === 'braces' || name === 'fast-glob' ? '*' : name === 'micromatch' ? '>=0.2.0' : '>=14.3.0-canary.0',
    via: index ? [names[index - 1]] : [{ url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm', range: '<=3.0.3', severity: 'high' }],
  }])) }
}
afterEach(() => vi.useRealTimers())
describe('temporary exact development-only braces exception', () => {
  it('accepts only the recorded dev graph and clear production report before expiry', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-11T12:00:00Z'))
    expect(assertAuditGate(report(), context())).toBe('PASS_WITH_TEMPORARY_DEV_EXCEPTION')
  })
  it('evaluates the installed ESLint config without traversing circular plugin internals', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-11T12:00:00Z'))
    const c = context()
    c.config = (await import('../../eslint.config.mjs')).default
    expect(assertAuditGate(report(), c)).toBe('PASS_WITH_TEMPORARY_DEV_EXCEPTION')
  })
  it.each(['production-node', 'other-branch', 'other-advisory', 'rootDir', 'changed-config', 'production-advisory', 'expired'])('fails closed for %s', scenario => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(scenario === 'expired' ? '2026-10-18T00:00:00Z' : '2026-10-11T12:00:00Z'))
    const r = report(); const c = context()
    if (scenario === 'production-node') c.lock.packages['node_modules/braces'].dev = false
    if (scenario === 'other-branch') c.lock.packages['node_modules/synthetic-parent'] = { dependencies: { braces: '^3.0.3' } }
    if (scenario === 'other-advisory') r.vulnerabilities.braces.via.push({ url: 'https://github.com/advisories/GHSA-other-new', range: '*', severity: 'high' })
    if (scenario === 'rootDir') c.config = [{ settings: { next: { rootDir: 'untrusted/**' } } }]
    if (scenario === 'changed-config') c.configSource += '\n// altered\n'
    if (scenario === 'production-advisory') c.productionReport.vulnerabilities.braces = r.vulnerabilities.braces
    expect(() => assertAuditGate(r, c)).toThrow()
  })
})
