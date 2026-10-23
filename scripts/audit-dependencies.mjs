import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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
/** @param {number | null | undefined} commandExit */
export function assertAuditGate(report, context, scope = 'production', commandExit = undefined) {
  if (!['production', 'full'].includes(scope)) throw new Error('Unknown audit scope')
  const counts = validateReport(report)
  if (commandExit !== undefined && commandExit !== (counts.total === 0 ? 0 : 1)) throw new Error('Audit exit and report disagree')
  if (scope === 'full') {
    const productionCounts = validateReport(context?.productionReport)
    if (productionCounts.total !== 0) throw new Error('Audit blocked: production must have zero advisories at every severity')
  }
  if (counts.total === 0) return 'PASS'
  throw new Error(`Audit blocked: ${counts.total} advisory package graph entries (${scope})`)
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.env.SERENIA_CHECK_LOG_DIR ? resolve(process.env.SERENIA_CHECK_LOG_DIR) : mkdtempSync(resolve(tmpdir(), 'serenia-audit-'))
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const home = resolve(directory, 'npm-home')
  mkdirSync(home, { mode: 0o700, recursive: true })
  const userconfig = resolve(directory, 'npm-user.conf')
  const globalconfig = resolve(directory, 'npm-global.conf')
  writeFileSync(userconfig, '', { mode: 0o600 })
  writeFileSync(globalconfig, '', { mode: 0o600 })
  const env = { PATH: process.env.PATH, HOME: home, NPM_CONFIG_USERCONFIG: userconfig, NPM_CONFIG_GLOBALCONFIG: globalconfig, NPM_CONFIG_CACHE: resolve(directory, 'npm-cache'), NPM_CONFIG_REGISTRY: 'https://registry.npmjs.org/', NEXT_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1' }
  let failed = false
  let productionReport
  for (const scope of ['production', 'full']) {
    const args = ['audit', '--json', ...(scope === 'production' ? ['--omit=dev'] : [])]
    const result = spawnSync('npm', args, { encoding: 'utf8', env, maxBuffer: 32 * 1024 * 1024 })
    writeFileSync(resolve(directory, `audit-${scope}.json`), result.stdout || '', { mode: 0o600 })
    writeFileSync(resolve(directory, `audit-${scope}.stderr.log`), result.stderr || '', { mode: 0o600 })
    writeFileSync(resolve(directory, `audit-${scope}.exit.json`), JSON.stringify({ exit: result.status, error: result.error?.message }) + '\n', { mode: 0o600 })
    try {
      if (result.error || ![0, 1].includes(result.status)) throw new Error('Audit command failed')
      const report = JSON.parse(result.stdout)
      if (scope === 'production') productionReport = report
      const context = scope === 'full' ? { productionReport } : undefined
      const outcome = assertAuditGate(report, context, scope, result.status)
      console.log(`${scope}: ${outcome} ${JSON.stringify(report.metadata.vulnerabilities)}; npm exit=${result.status}`)
    } catch (error) { console.error(`${scope}: FAIL ${error.message}`); failed = true }
  }
  console.log(`Full audit evidence: ${directory}`)
  if (failed) process.exitCode = 1
}
