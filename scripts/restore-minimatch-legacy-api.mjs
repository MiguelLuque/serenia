import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// npm verifies the tarball. Pin the exact upstream files before adapting exports.
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(project, 'node_modules/minimatch')
const paths = [
  [resolve(project, 'node_modules'), 'directory'],
  [root, 'directory'],
  [resolve(root, 'package.json'), 'file'],
  [resolve(root, 'dist'), 'directory'],
  [resolve(root, 'dist/commonjs'), 'directory'],
  [resolve(root, 'dist/esm'), 'directory'],
  [resolve(root, 'dist/commonjs/index.js'), 'file'],
  [resolve(root, 'dist/esm/index.js'), 'file'],
]
for (const [path, kind] of paths) {
  const stat = lstatSync(path)
  if (stat.isSymbolicLink() || (kind === 'directory' ? !stat.isDirectory() : !stat.isFile())) {
    throw new Error('Unexpected minimatch installation path')
  }
}

const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version
if (version !== '11.0.4') throw new Error('Unsupported minimatch version')
const patches = [
  { file: 'dist/commonjs/index.js', sha: '235c5458355f1449cc100f1cea1a43d45f788a4feb524a83497aa146bea88f32', addition: '\n// Restore the callable CommonJS API expected by pinned ESLint plugins.\nmodule.exports = Object.assign(exports.minimatch, exports);\n' },
  { file: 'dist/esm/index.js', sha: 'b238ca70371b1f192817ae9516afaacb566d1df2a7a85e47c6c24f41f1707864', addition: '\n// Restore the default ESM export expected by ESLint legacy consumers.\nexport default minimatch;\n' },
]
const digest = text => createHash('sha256').update(text).digest('hex')
// Validate both inputs before changing either, including on repeated installs.
const updates = patches.map(({ file, sha, addition }) => {
  const path = resolve(root, file)
  const content = readFileSync(path, 'utf8')
  if (content.endsWith(addition) && digest(content.slice(0, -addition.length)) === sha) return null
  if (digest(content) !== sha) throw new Error(`Pristine minimatch content mismatch: ${file}`)
  return { path, content: content + addition }
})
for (const update of updates) if (update) writeFileSync(update.path, update.content)
console.log('Restored documented minimatch 11.0.4 legacy API exports')
