import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const names = ['braces', 'micromatch', 'fast-glob', '@next/eslint-plugin-next', 'eslint-config-next']
const versions = ['3.0.3', '4.0.8', '3.3.1', '16.4.1', '16.4.1']
const ranges = ['*', '>=0.2.0', '*', '>=14.3.0-canary.0', '>=14.3.0-canary.0']
const dependencyRanges = ['^3.0.3', '^4.0.4', '3.3.1', '16.4.1']
const expiry = Date.parse('2026-10-18T00:00:00Z')
const configHash = '6b440fd458d9a2820a20e10b81127025eb257b04aacd06ea539fc40f4eca5ed2'
function temporaryDevelopmentException(report, context) {
  if (!context || Date.now() >= expiry) return false
  const { lock, configSource, config, productionReport } = context
  if (createHash('sha256').update(configSource).digest('hex') !== configHash) return false
  if (!Array.isArray(config) || config.some(entry => {
    const settings = entry?.settings?.next
    return settings && typeof settings === 'object' && 'rootDir' in settings
  })) return false
  if (productionReport.metadata.vulnerabilities.total !== 0) return false
  const high = Object.entries(report.vulnerabilities).filter(([, v]) => ['high', 'critical'].includes(v.severity))
  if (Object.keys(report.vulnerabilities).length !== 5 || report.metadata.vulnerabilities.high !== 5 || report.metadata.vulnerabilities.critical !== 0 || high.length !== 5 || names.some(name => !high.some(([key]) => key === name))) return false
  for (let index = 0; index < names.length; index++) {
    const name = names[index]
    const entry = report.vulnerabilities[name]
    const node = `node_modules/${name}`
    const installed = lock?.packages?.[node]
    if (entry.isDirect !== (index === names.length - 1) || entry.effects.length !== (index < names.length - 1 ? 1 : 0) || (index < names.length - 1 && entry.effects[0] !== names[index + 1])) return false
    if (entry.severity !== 'high' || entry.range !== ranges[index] || entry.nodes?.length !== 1 || entry.nodes[0] !== node || installed?.dev !== true || installed.version !== versions[index]) return false
    if (entry.via?.length !== 1) return false
    if (index === 0) {
      const advisory = entry.via[0]
      if (advisory.url !== 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' || advisory.range !== '<=3.0.3' || advisory.severity !== 'high') return false
    } else if (entry.via[0] !== names[index - 1] || installed.dependencies?.[names[index - 1]] !== dependencyRanges[index - 1]) return false
    // A new consumer/path of the same GHSA is outside this exception.
    const kinds = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
    const consumers = Object.entries(lock.packages).flatMap(([key, pkg]) =>
      kinds.filter(kind => Object.hasOwn(pkg[kind] ?? {}, name)).map(kind => ({ key, kind, range: pkg[kind][name] })))
    const expected = index < names.length - 1
      ? { key: `node_modules/${names[index + 1]}`, kind: 'dependencies', range: dependencyRanges[index] }
      : { key: '', kind: 'devDependencies', range: versions[index] }
    if (consumers.length !== 1 || Object.keys(expected).some(key => consumers[0][key] !== expected[key])) return false
    if (Object.keys(lock.packages).some(key => key !== node && key.endsWith(`/node_modules/${name}`))) return false
  }
  return true
}
const severities = ['info', 'low', 'moderate', 'high', 'critical']
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
function validateReport(report) {
  const invalid = () => { throw new Error('Invalid or inconsistent audit report; gate cannot assess dependencies') }
  if (!record(report) || report.auditReportVersion !== 2 || !record(report.vulnerabilities) || !record(report.metadata)) invalid()
  const counts = report.metadata.vulnerabilities
  const dependencies = report.metadata.dependencies
  if (!record(counts) || Object.keys(counts).length !== 6 || [...severities, 'total'].some(key => !Number.isSafeInteger(counts[key]) || counts[key] < 0)) invalid()
  if (!record(dependencies) || ['prod', 'dev', 'optional', 'peer', 'peerOptional', 'total'].some(key => !Number.isSafeInteger(dependencies[key]) || dependencies[key] < 0 || dependencies[key] > dependencies.total)) invalid()
  const actual = Object.fromEntries(severities.map(key => [key, 0]))
  for (const [name, entry] of Object.entries(report.vulnerabilities)) {
    if (!record(entry) || entry.name !== name || !severities.includes(entry.severity) || typeof entry.isDirect !== 'boolean' || typeof entry.range !== 'string' || !Array.isArray(entry.nodes) || !entry.nodes.length || entry.nodes.some(node => typeof node !== 'string' || !node.startsWith('node_modules/')) || new Set(entry.nodes).size !== entry.nodes.length) invalid()
    if (!Array.isArray(entry.via) || !entry.via.length || !Array.isArray(entry.effects) || entry.effects.some(effect => typeof effect !== 'string' || !Object.hasOwn(report.vulnerabilities, effect))) invalid()
    if (typeof entry.fixAvailable !== 'boolean' && !(record(entry.fixAvailable) && typeof entry.fixAvailable.name === 'string' && typeof entry.fixAvailable.version === 'string' && typeof entry.fixAvailable.isSemVerMajor === 'boolean')) invalid()
    for (const via of entry.via) {
      if (typeof via === 'string') {
        if (!Object.hasOwn(report.vulnerabilities, via)) invalid()
      } else if (!record(via) || typeof via.url !== 'string' || typeof via.range !== 'string' || !severities.includes(via.severity)) invalid()
    }
    actual[entry.severity]++
  }
  if (severities.some(key => counts[key] !== actual[key]) || counts.total !== Object.keys(report.vulnerabilities).length || counts.total !== severities.reduce((sum, key) => sum + counts[key], 0)) invalid()
  return counts
}
export function assertAuditGate(report, context, scope = 'production') {
  if (!['production', 'full'].includes(scope)) throw new Error('Unknown audit scope')
  const counts = validateReport(report)
  if (scope === 'full') {
    const productionCounts = validateReport(context?.productionReport)
    if (productionCounts.total !== 0) throw new Error('Audit blocked: production must have zero advisories at every severity')
  }
  if (counts.total === 0) return 'PASS'
  if (scope === 'full' && temporaryDevelopmentException(report, context)) return 'PASS_WITH_TEMPORARY_DEV_EXCEPTION'
  throw new Error(`Audit blocked: ${counts.total} non-exempt advisory package graph entries (${scope})`)
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.env.SERENIA_CHECK_LOG_DIR ? resolve(process.env.SERENIA_CHECK_LOG_DIR) : mkdtempSync(resolve(tmpdir(), 'serenia-audit-'))
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  let failed = false
  let productionReport
  for (const scope of ['production', 'full']) {
    const args = ['audit', '--json', ...(scope === 'production' ? ['--omit=dev'] : [])]
    const result = spawnSync('npm', args, { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: process.env.HOME, NEXT_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1' }, maxBuffer: 32 * 1024 * 1024 })
    writeFileSync(resolve(directory, `audit-${scope}.json`), result.stdout || '', { mode: 0o600 })
    writeFileSync(resolve(directory, `audit-${scope}.stderr.log`), result.stderr || '', { mode: 0o600 })
    writeFileSync(resolve(directory, `audit-${scope}.exit.json`), JSON.stringify({ exit: result.status, error: result.error?.message }) + '\n', { mode: 0o600 })
    try {
      if (result.error || ![0, 1].includes(result.status)) throw new Error('Audit command failed')
      const report = JSON.parse(result.stdout)
      if (scope === 'production') productionReport = report
      const context = scope === 'full' ? {
        lock: JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8')),
        configSource: readFileSync(new URL('../eslint.config.mjs', import.meta.url), 'utf8'),
        config: (await import('../eslint.config.mjs')).default,
        productionReport,
      } : undefined
      const outcome = assertAuditGate(report, context, scope)
      if (result.status !== (report.metadata.vulnerabilities.total === 0 ? 0 : 1)) throw new Error('Audit exit and report disagree')
      console.log(`${scope}: ${outcome} ${JSON.stringify(report.metadata.vulnerabilities)}; npm exit=${result.status}${outcome.includes('EXCEPTION') ? '; GHSA-vfj7-8cjw-p6xm expires 2026-10-18T00:00:00Z (not a clean audit)' : ''}`)
    } catch (error) { console.error(`${scope}: FAIL ${error.message}`); failed = true }
  }
  console.log(`Full audit evidence: ${directory}`)
  if (failed) process.exitCode = 1
}
