import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readdirSync, readSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const perFileLimit = 2 * 1024 * 1024
function boundedFile(path, limit = perFileLimit) {
  if (!existsSync(path) || !lstatSync(path).isFile()) return undefined
  const fd = openSync(path, 'r')
  try {
    const buffer = Buffer.alloc(limit)
    const count = readSync(fd, buffer, 0, limit, 0)
    const bytes = buffer.subarray(0, count)
    return { bytes, originalBytes: lstatSync(path).size, copiedBytes: count, truncated: lstatSync(path).size > count, sha256: createHash('sha256').update(bytes).digest('hex') }
  } finally { closeSync(fd) }
}
export function collectEvidence(temporaryRoot, stackRoot, destination) {
  mkdirSync(destination, { recursive: true, mode: 0o700 })
  /** @type {{limits: object, files: {file: string, originalBytes: number, copiedBytes: number, truncated: boolean, sha256: string}[]}} */
  const manifest = { limits: { perFileBytes: perFileLimit, totalFiles: 16, sourceDirectories: 10 }, files: [] }
  const directories = readdirSync(temporaryRoot).filter(name => /^serenia-(?:build|workflow-wire)-[\w-]+$/.test(name)).sort().slice(0, 10)
  for (const directory of directories) {
    const source = resolve(temporaryRoot, directory)
    if (!lstatSync(source).isDirectory()) continue
    const allowed = directory.startsWith('serenia-build-') ? /^(?:build\.log|metadata\.json|result\.json)$/ : /^verification-[\d.]+\.json$/
    for (const name of readdirSync(source).filter(name => allowed.test(name)).sort()) {
      if (manifest.files.length >= 16) break
      const file = boundedFile(resolve(source, name))
      if (!file) continue
      const target = `${directory}--${name}`
      writeFileSync(resolve(destination, target), file.bytes, { mode: 0o600 })
      manifest.files.push({ file: target, originalBytes: file.originalBytes, copiedBytes: file.copiedBytes, truncated: file.truncated, sha256: file.sha256 })
    }
  }
  const diagnostics = { policy: 'Raw stack logs remain private. Export only bounded byte/hash identity and numeric exit status; no free-form stack output or credentials.', stages: {} }
  for (const stage of ['start', 'reset', 'verify', 'stop']) {
    const raw = boundedFile(resolve(stackRoot, `supabase-${stage}.log`))
    const result = boundedFile(resolve(stackRoot, `supabase-${stage}.exit`), 16)
    const text = result?.bytes.toString('utf8').trim()
    const exit = /^\d{1,3}$/.test(text ?? '') && Number(text) <= 255 ? Number(text) : null
    const log = raw ? { bytes: raw.originalBytes, hashedBytes: raw.copiedBytes, truncated: raw.truncated, sha256: raw.sha256 } : null
    diagnostics.stages[stage] = { exit, log, evidence: exit !== null && raw ? 'RECORDED' : 'MISSING_OR_NOT_RUN' }
  }
  writeFileSync(resolve(destination, 'local-stack-diagnostics.json'), JSON.stringify(diagnostics, null, 2) + '\n', { mode: 0o600 })
  writeFileSync(resolve(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 })
  return manifest
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runner = process.env.RUNNER_TEMP
  if (!runner) throw new Error('RUNNER_TEMP is required for CI evidence')
  /** @type {{limits: object, files: {file: string, originalBytes: number, copiedBytes: number, truncated: boolean, sha256: string}[]}} */
  const manifest = collectEvidence(tmpdir(), runner, resolve(runner, 'serenia-final-evidence'))
  console.log(`Collected ${manifest.files.length} bounded build/wire files and secret-free local-stack diagnostics`)
}
