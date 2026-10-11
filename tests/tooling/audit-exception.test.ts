import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { assertAuditGate } from '../../scripts/audit-dependencies.mjs'
const names = ['braces', 'micromatch', 'fast-glob', '@next/eslint-plugin-next', 'eslint-config-next']
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'))
const configSource = readFileSync('eslint.config.mjs', 'utf8')
type Entry = { name: string; isDirect: boolean; effects: string[]; fixAvailable: boolean; severity: string; nodes: string[]; range: string; via: (string | { url: string; range: string; severity: string })[] }
function context() { return { lock: structuredClone(lock), configSource, config: [{}] as { settings?: { next?: { rootDir?: string } } }[], productionReport: { auditReportVersion: 2, metadata: { dependencies: dependencies(), vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } }, vulnerabilities: {} as Record<string, Entry> } } }
function dependencies() { return { prod: 1, dev: 5, optional: 0, peer: 0, peerOptional: 0, total: 6 } }
function report(): { auditReportVersion: number; metadata: { dependencies: ReturnType<typeof dependencies>; vulnerabilities: Record<string, number> }; vulnerabilities: Record<string, Entry> } {
  return { auditReportVersion: 2, metadata: { dependencies: dependencies(), vulnerabilities: { info: 0, low: 0, moderate: 0, high: 5, critical: 0, total: 5 } }, vulnerabilities: Object.fromEntries(names.map((name, index) => [name, {
    name, isDirect: index === names.length - 1, effects: index < names.length - 1 ? [names[index + 1]] : [], fixAvailable: false, severity: 'high', nodes: ['node_modules/' + name], range: name === 'braces' || name === 'fast-glob' ? '*' : name === 'micromatch' ? '>=0.2.0' : '>=14.3.0-canary.0',
    via: index ? [names[index - 1]] : [{ url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm', range: '<=3.0.3', severity: 'high' }],
  }])) }
}
afterEach(() => vi.useRealTimers())
describe('temporary exact development-only braces exception', () => {
  it('accepts only the recorded dev graph and clear production report before expiry', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-11T12:00:00Z'))
    expect(assertAuditGate(report(), context(), 'full')).toBe('PASS_WITH_TEMPORARY_DEV_EXCEPTION')
  })
  it('evaluates the installed ESLint config without traversing circular plugin internals', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-11T12:00:00Z'))
    const c = context()
    c.config = (await import('../../eslint.config.mjs')).default
    expect(assertAuditGate(report(), c, 'full')).toBe('PASS_WITH_TEMPORARY_DEV_EXCEPTION')
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
    expect(() => assertAuditGate(r, c, 'full')).toThrow()
  })
})

describe('audit policy remains fail closed outside the exception', () => {
  it.each(['low', 'moderate', 'info'])('rejects a complete %s advisory in production and full reports', severity => {
    const r = report()
    r.vulnerabilities = { braces: { ...r.vulnerabilities.braces, severity, effects: [], via: [{ url: 'https://github.com/advisories/GHSA-synthetic-other', range: '*', severity }] } }
    r.metadata.vulnerabilities = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 1, [severity]: 1 }
    expect(() => assertAuditGate(r, undefined, 'production')).toThrow()
    expect(() => assertAuditGate(r, context(), 'full')).toThrow()
  })
  it.each(['missing-severity', 'missing-total', 'impossible-dependency-count', 'missing-dependencies', 'missing-version', 'inconsistent-total', 'inconsistent-severity', 'negative-count', 'unknown-severity', 'empty-nodes', 'missing-directness'])('rejects incomplete or inconsistent evidence: %s', scenario => {
    const r = structuredClone(context().productionReport)
    // Intentional malformed runtime evidence exercises schema validation.
    const malformed = r as unknown as { auditReportVersion?: number; metadata: { dependencies?: object; vulnerabilities: Record<string, number> }; vulnerabilities: Record<string, Partial<Entry>> }
    if (scenario === 'missing-severity') delete malformed.metadata.vulnerabilities.low
    if (scenario === 'missing-total') delete malformed.metadata.vulnerabilities.total
    if (scenario === 'missing-dependencies') delete malformed.metadata.dependencies
    if (scenario === 'impossible-dependency-count') (malformed.metadata.dependencies as { prod: number }).prod = 999
    if (scenario === 'missing-version') delete malformed.auditReportVersion
    if (scenario === 'inconsistent-total') malformed.metadata.vulnerabilities.total = 1
    if (scenario === 'inconsistent-severity') malformed.metadata.vulnerabilities.low = 1
    if (scenario === 'negative-count') malformed.metadata.vulnerabilities.low = -1
    if (['unknown-severity', 'empty-nodes', 'missing-directness'].includes(scenario)) {
      malformed.vulnerabilities.braces = { ...report().vulnerabilities.braces, severity: scenario === 'unknown-severity' ? 'new-level' : 'low', effects: [], nodes: scenario === 'empty-nodes' ? [] : ['node_modules/braces'] }
      malformed.metadata.vulnerabilities.low = 1; malformed.metadata.vulnerabilities.total = 1
      if (scenario === 'missing-directness') delete malformed.vulnerabilities.braces.isDirect
    }
    expect(() => assertAuditGate(malformed)).toThrow()
  })
  it.each(['devDependencies', 'optionalDependencies', 'peerDependencies', 'dependencies'])('rejects a new root %s consumer', kind => {
    const c = context(); c.lock.packages[''][kind] = { ...c.lock.packages[''][kind], braces: '3.0.3' }
    expect(() => assertAuditGate(report(), c, 'full')).toThrow()
  })
  it.each(['optionalDependencies', 'peerDependencies', 'devDependencies'])('rejects a new package %s consumer', kind => {
    const c = context(); c.lock.packages['node_modules/synthetic-parent'] = { [kind]: { braces: '3.0.3' } }
    expect(() => assertAuditGate(report(), c, 'full')).toThrow()
  })
  it('rejects new audit directness and changed inherited effects', () => {
    const r = report(); r.vulnerabilities.braces.isDirect = true
    expect(() => assertAuditGate(r, context(), 'full')).toThrow()
    r.vulnerabilities.braces.isDirect = false; r.vulnerabilities.braces.effects.push('another-consumer')
    expect(() => assertAuditGate(r, context(), 'full')).toThrow()
  })
  it('requires clear production evidence even after the full graph becomes clean', () => {
    const c = context(); c.productionReport.metadata.vulnerabilities.total = 1
    expect(() => assertAuditGate(context().productionReport, c, 'full')).toThrow()
  })
  it('does not use the exception in production or accept a valid nonzero production context with clean full', () => {
    const c = context(); const r = report()
    expect(() => assertAuditGate(r, c, 'production')).toThrow()
    c.productionReport.vulnerabilities.braces = { ...r.vulnerabilities.braces, severity: 'moderate', effects: [] }
    c.productionReport.metadata.vulnerabilities.moderate = 1; c.productionReport.metadata.vulnerabilities.total = 1
    expect(() => assertAuditGate(context().productionReport, c, 'full')).toThrow()
  })
  it('accepts complete zero-advisory reports in both scopes', () => {
    const c = context()
    expect(assertAuditGate(c.productionReport)).toBe('PASS')
    expect(assertAuditGate(c.productionReport, c, 'full')).toBe('PASS')
  })
})
