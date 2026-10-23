import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { assertAuditGate } from '../../scripts/audit-dependencies.mjs'
const names = ['braces', 'micromatch', 'fast-glob', '@next/eslint-plugin-next', 'eslint-config-next']
type Entry = { name: string; isDirect: boolean; effects: string[]; fixAvailable: boolean; severity: string; nodes: string[]; range: string; via: (string | { url: string; range: string; severity: string })[] }
function context() { return { productionReport: { auditReportVersion: 2, metadata: { dependencies: dependencies(), vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } }, vulnerabilities: {} as Record<string, Entry> } } }
function dependencies() { return { prod: 1, dev: 5, optional: 0, peer: 0, peerOptional: 0, total: 6 } }
function report(): { auditReportVersion: number; metadata: { dependencies: ReturnType<typeof dependencies>; vulnerabilities: Record<string, number> }; vulnerabilities: Record<string, Entry> } {
  return { auditReportVersion: 2, metadata: { dependencies: dependencies(), vulnerabilities: { info: 0, low: 0, moderate: 0, high: 5, critical: 0, total: 5 } }, vulnerabilities: Object.fromEntries(names.map((name, index) => [name, {
    name, isDirect: index === names.length - 1, effects: index < names.length - 1 ? [names[index + 1]] : [], fixAvailable: false, severity: 'high', nodes: ['node_modules/' + name], range: name === 'braces' || name === 'fast-glob' ? '*' : name === 'micromatch' ? '>=0.2.0' : '>=14.3.0-canary.0',
    via: index ? [names[index - 1]] : [{ url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm', range: '<=3.0.3', severity: 'high' }],
  }])) }
}
afterEach(() => vi.useRealTimers())
describe('removed development exception', () => {
  it('rejects the formerly exempt graph even before its old expiry', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-11T12:00:00Z'))
    const priorContext = { ...context(), lock: JSON.parse(readFileSync('package-lock.json', 'utf8')), configSource: readFileSync('eslint.config.mjs', 'utf8'), config: [{}] }
    expect(() => assertAuditGate(report(), priorContext, 'full')).toThrow()
  })
})

describe('strict zero-advisory audit policy', () => {
  it.each(['info', 'low', 'moderate', 'high', 'critical'])('rejects a complete %s advisory in production and full reports', severity => {
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
  it('requires clear production evidence even after the full graph becomes clean', () => {
    const c = context(); c.productionReport.metadata.vulnerabilities.total = 1
    expect(() => assertAuditGate(context().productionReport, c, 'full')).toThrow()
  })
  it('rejects a nonzero production context even with clean full', () => {
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

// A clean JSON document must never hide npm failure.
describe('npm exit evidence', () => {
  it.each([1, 2, null])('rejects clean report paired with npm exit %s', exit => {
    expect(() => assertAuditGate(context().productionReport, undefined, 'production', exit)).toThrow()
  })
})

describe('audit scope and command consistency', () => {
  it('rejects an unknown scope', () => {
    expect(() => assertAuditGate(context().productionReport, undefined, 'unexpected')).toThrow('Unknown audit scope')
  })
  it('requires a complete production report for full audit', () => {
    expect(() => assertAuditGate(context().productionReport, undefined, 'full')).toThrow()
  })
  it('accepts clean evidence with npm exit zero', () => {
    expect(assertAuditGate(context().productionReport, context(), 'full', 0)).toBe('PASS')
  })
  it('rejects advisory evidence paired with npm exit zero', () => {
    expect(() => assertAuditGate(report(), context(), 'full', 0)).toThrow('Audit exit and report disagree')
  })
})
