import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// npm verifies the tarball. Pin the exact upstream files before adapting exports.
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(project, 'node_modules/minimatch')
const plugin = resolve(project, 'node_modules/eslint-plugin-import')
// The plugin is a dev dependency and may be absent in production-only installs.
let pluginPresent = true
try {
  lstatSync(plugin)
} catch (error) {
  if (error.code !== 'ENOENT') throw error
  pluginPresent = false
}
const paths = [
  [resolve(project, 'node_modules'), 'directory'],
  [root, 'directory'],
  [resolve(root, 'package.json'), 'file'],
  [resolve(root, 'dist'), 'directory'],
  [resolve(root, 'dist/commonjs'), 'directory'],
  [resolve(root, 'dist/esm'), 'directory'],
  [resolve(root, 'dist/commonjs/index.js'), 'file'],
  [resolve(root, 'dist/esm/index.js'), 'file'],
  ...(pluginPresent ? [
    [plugin, 'directory'],
    [resolve(plugin, 'package.json'), 'file'],
    [resolve(plugin, 'lib'), 'directory'],
    [resolve(plugin, 'lib/rules'), 'directory'],
    [resolve(plugin, 'lib/rules/no-internal-modules.js'), 'file'],
  ] : []),
]
for (const [path, kind] of paths) {
  const stat = lstatSync(path)
  if (stat.isSymbolicLink() || (kind === 'directory' ? !stat.isDirectory() : !stat.isFile())) {
    throw new Error('Unexpected minimatch installation path')
  }
}

const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version
if (version !== '11.0.4') throw new Error('Unsupported minimatch version')
if (pluginPresent && JSON.parse(readFileSync(resolve(plugin, 'package.json'), 'utf8')).version !== '2.32.0') {
  throw new Error('Unsupported eslint-plugin-import version')
}
const patches = [
  { file: resolve(root, 'dist/commonjs/index.js'), sha: '235c5458355f1449cc100f1cea1a43d45f788a4feb524a83497aa146bea88f32', adapt: content => content + '\n// Restore the callable CommonJS API expected by pinned ESLint plugins.\nmodule.exports = Object.assign(exports.minimatch, exports);\n' },
  { file: resolve(root, 'dist/esm/index.js'), sha: 'b238ca70371b1f192817ae9516afaacb566d1df2a7a85e47c6c24f41f1707864', adapt: content => content + '\n// Restore the default ESM export expected by ESLint legacy consumers.\nexport default minimatch;\n' },
  ...(pluginPresent ? [{ file: resolve(plugin, 'lib/rules/no-internal-modules.js'), sha: 'f36ab9b9b97cc2d8a49f8fe474c4200875db4fa357c5061fe71538b01db696a4', adapt: content => content.replaceAll("return _minimatch2['default'].makeRe(p);", "return { test: function (value) { return (0, _minimatch2['default'])(value, p); } };") }] : []),
]
const digest = text => createHash('sha256').update(text).digest('hex')
// Validate all inputs before changing any, including on repeated installs.
const updates = patches.map(({ file, sha, adapt }) => {
  const content = readFileSync(file, 'utf8')
  if (digest(content) === sha) return { path: file, content: adapt(content) }
  // The exact adapted bytes are derived from a pristine copy, not accepted by prefix.
  if (file !== resolve(plugin, 'lib/rules/no-internal-modules.js') && content.includes('\n// Restore the ')) {
    const original = content.slice(0, content.lastIndexOf('\n// Restore the '))
    if (digest(original) === sha && adapt(original) === content) return null
  }
  if (file === resolve(plugin, 'lib/rules/no-internal-modules.js')) {
    const original = content.replaceAll("return { test: function (value) { return (0, _minimatch2['default'])(value, p); } };", "return _minimatch2['default'].makeRe(p);")
    if (digest(original) === sha && adapt(original) === content) return null
  }
  throw new Error('Pristine dependency content mismatch')
})
for (const update of updates) if (update) writeFileSync(update.path, update.content)
console.log('Restored documented minimatch and ESLint plugin compatibility')
