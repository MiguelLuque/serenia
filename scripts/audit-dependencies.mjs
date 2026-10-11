import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const names = ['braces', 'micromatch', 'fast-glob', '@next/eslint-plugin-next', 'eslint-config-next']
const versions = ['3.0.3', '4.0.8', '3.3.1', '16.4.0', '16.4.0']
const ranges = ['*', '>=0.2.0', '*', '>=14.3.0-canary.0', '>=14.3.0-canary.0']
const dependencyRanges = ['^3.0.3', '^4.0.4', '3.3.1', '16.4.0']
const expiry = Date.parse('2026-10-18T00:00:00Z')
const configHash = '6b440fd458d9a2820a20e10b81127025eb257b04aacd06ea539fc40f4eca5ed2'
function temporaryDevelopmentException(report, context) {
  if (!context || Date.now() >= expiry) return false
  const { lock, configSource, config, productionReport } = context
  if (createHash('sha256').update(configSource).digest('hex') !== configHash) return false
  if (JSON.stringify(config).includes('"rootDir"')) return false
  if (!productionReport || productionReport.metadata?.vulnerabilities?.total !== 0 || Object.keys(productionReport.vulnerabilities ?? { invalid: true }).length !== 0) return false
  const high = Object.entries(report.vulnerabilities).filter(([, v]) => ['high', 'critical'].includes(v.severity))
  if (Object.keys(report.vulnerabilities).length !== 5 || report.metadata.vulnerabilities.high !== 5 || report.metadata.vulnerabilities.critical !== 0 || high.length !== 5 || names.some(name => !high.some(([key]) => key === name))) return false
  for (let index = 0; index < names.length; index++) {
    const name = names[index]
    const entry = report.vulnerabilities[name]
    const node = `node_modules/${name}`
    const installed = lock?.packages?.[node]
    if (entry.severity !== 'high' || entry.range !== ranges[index] || entry.nodes?.length !== 1 || entry.nodes[0] !== node || installed?.dev !== true || installed.version !== versions[index]) return false
    if (entry.via?.length !== 1) return false
    if (index === 0) {
      const advisory = entry.via[0]
      if (advisory.url !== 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' || advisory.range !== '<=3.0.3' || advisory.severity !== 'high') return false
    } else if (entry.via[0] !== names[index - 1] || installed.dependencies?.[names[index - 1]] !== dependencyRanges[index - 1]) return false
    // A new consumer/path of the same GHSA is outside this exception.
    const consumers = Object.entries(lock.packages).filter(([, pkg]) => Object.hasOwn(pkg.dependencies ?? {}, name)).map(([key]) => key)
    if (index < names.length - 1 && (consumers.length !== 1 || consumers[0] !== `node_modules/${names[index + 1]}`)) return false
    if (index === names.length - 1 && (consumers.length !== 0 || lock.packages[''].devDependencies?.[name] !== versions[index] || Object.hasOwn(lock.packages[''].dependencies ?? {}, name))) return false
    if (Object.keys(lock.packages).some(key => key !== node && key.endsWith(`/node_modules/${name}`))) return false
  }
  return true
}
export function assertAuditGate(report, context) {
  const counts = report?.metadata?.vulnerabilities
  if (!counts || !report.vulnerabilities || !Number.isInteger(counts.high) || !Number.isInteger(counts.critical)) throw new Error('Invalid audit report; gate cannot assess dependencies')
  if (counts.high || counts.critical || Object.values(report.vulnerabilities).some(v => ['high', 'critical'].includes(v.severity))) {
    if (temporaryDevelopmentException(report, context)) return 'PASS_WITH_TEMPORARY_DEV_EXCEPTION'
    throw new Error(`Audit blocked: ${counts.high} high / ${counts.critical} critical package graph entries`)
  }
  return 'PASS'
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
      const outcome = assertAuditGate(report, context)
      console.log(`${scope}: ${outcome} ${JSON.stringify(report.metadata.vulnerabilities)}; npm exit=${result.status}${outcome.includes('EXCEPTION') ? '; GHSA-vfj7-8cjw-p6xm expires 2026-10-18T00:00:00Z (not a clean audit)' : ''}`)
    } catch (error) { console.error(`${scope}: FAIL ${error.message}`); failed = true }
  }
  console.log(`Full audit evidence: ${directory}`)
  if (failed) process.exitCode = 1
}
