import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const temporary: string[] = []
const files = [
  ['dist/commonjs/index.js', '\n// Restore the callable CommonJS API expected by pinned ESLint plugins.\nmodule.exports = Object.assign(exports.minimatch, exports);\n'],
  ['dist/esm/index.js', '\n// Restore the default ESM export expected by ESLint legacy consumers.\nexport default minimatch;\n'],
] as const
const child = (code: string) => spawnSync(process.execPath, ['--max-old-space-size=128', '--input-type=module', '-e', code], { cwd: root, encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024, env: { PATH: process.env.PATH, NODE_ENV: 'test' } })
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'serenia-minimatch-compat-'))
  temporary.push(directory)
  const target = join(directory, 'node_modules/minimatch')
  mkdirSync(join(directory, 'scripts'), { recursive: true })
  mkdirSync(target, { recursive: true })
  copyFileSync(join(root, 'scripts/restore-minimatch-legacy-api.mjs'), join(directory, 'scripts/restore-minimatch-legacy-api.mjs'))
  copyFileSync(join(root, 'node_modules/minimatch/package.json'), join(target, 'package.json'))
  const pristine = new Map<string, string>()
  for (const [file, addition] of files) {
    const source = readFileSync(join(root, 'node_modules/minimatch', file), 'utf8')
    const original = source.endsWith(addition) ? source.slice(0, -addition.length) : source
    pristine.set(file, original)
    mkdirSync(dirname(join(target, file)), { recursive: true })
    writeFileSync(join(target, file), original)
  }
  const run = () => spawnSync(process.execPath, [join(directory, 'scripts/restore-minimatch-legacy-api.mjs')], { cwd: tmpdir(), encoding: 'utf8', timeout: 5000, env: { PATH: process.env.PATH, NODE_ENV: 'test' } })
  return { directory, target, pristine, run }
}
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }) })

describe('fixed minimatch with legacy consumer exports', () => {
  it('keeps the real React ignore glob without disabling the rule for unmatched components', () => {
    const result = child(`import {createRequire} from 'node:module';const r=createRequire(import.meta.url);const{Linter}=r('eslint');const rule=r('eslint-plugin-react/lib/rules/jsx-pascal-case');const l=new Linter();const config=[{languageOptions:{ecmaVersion:2022,parserOptions:{ecmaFeatures:{jsx:true}}},plugins:{react:{rules:{'jsx-pascal-case':rule}}},rules:{'react/jsx-pascal-case':['error',{ignore:['App*']}]}}];console.log(JSON.stringify({ignored:l.verify('const el=<App_x />',config),enforced:l.verify('const el=<Other_x />',config).map(x=>x.ruleId)}));`)
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({ ignored: [], enforced: ['react/jsx-pascal-case'] })
  })
  it('preserves the accessibility helper glob matching for custom child components', () => {
    const result = child(`import {createRequire} from 'node:module';const r=createRequire(import.meta.url);const f=r('eslint-plugin-jsx-a11y/lib/util/mayContainChildComponent');const tree={children:[{type:'JSXElement',openingElement:{name:{type:'JSXIdentifier',name:'CustomInput'},attributes:[]},children:[]}]};console.log(JSON.stringify([f(tree,'Custom*'),f(tree,'Other*')]));`)
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual([true, false])
  })
  it('supports callable CommonJS and default ESM while retaining modern named exports', () => {
    const result = child(`import mm,{minimatch,Minimatch} from 'minimatch';import{createRequire}from'node:module';const c=createRequire(import.meta.url)('minimatch');console.log(JSON.stringify([c('src/a.ts','src/*.ts'),mm('src/a.js','src/*.ts'),minimatch('src/a.ts','src/*.ts'),new Minimatch('src/*.ts').match('src/a.ts'),c.defaults({nocase:true})('FOO','foo')]));`)
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual([true, false, true, true, true])
  })
  it('retains the upstream expansion cap on the bounded amplification regression', () => {
    const result = child(`import{Minimatch}from'minimatch';const m=new Minimatch(Array(12).fill('**/../a/b').join('/'),{optimizationLevel:2,braceExpandMax:64});console.log(JSON.stringify({sets:m.set.length}));`)
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({ sets: 64 })
  })
  it('adapts only the approved files and is idempotent from an unrelated cwd', () => {
    const f = fixture()
    expect(f.run().status).toBe(0)
    for (const [file, addition] of files) expect(readFileSync(join(f.target, file), 'utf8')).toBe(f.pristine.get(file) + addition)
    expect(f.run().status).toBe(0)
    for (const [file, addition] of files) expect(readFileSync(join(f.target, file), 'utf8')).toBe(f.pristine.get(file) + addition)
  })
  it('validates the second file before changing the first when content is unexpected', () => {
    const f = fixture()
    writeFileSync(join(f.target, files[1][0]), f.pristine.get(files[1][0]) + '\n// tampered\n')
    const result = f.run()
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('content mismatch')
    expect(readFileSync(join(f.target, files[0][0]), 'utf8')).toBe(f.pristine.get(files[0][0]))
  })
  it('rejects an unexpected package version before changing its files', () => {
    const f = fixture()
    writeFileSync(join(f.target, 'package.json'), '{"version":"99.0.0"}')
    expect(f.run().status).not.toBe(0)
    for (const [file] of files) expect(readFileSync(join(f.target, file), 'utf8')).toBe(f.pristine.get(file))
  })
  it('rejects a symlink target even when its content matches the pristine file', () => {
    const f = fixture()
    const outside = join(f.directory, 'outside.js')
    writeFileSync(outside, f.pristine.get(files[0][0])!)
    rmSync(join(f.target, files[0][0]))
    symlinkSync(outside, join(f.target, files[0][0]))
    expect(f.run().status).not.toBe(0)
    expect(readFileSync(outside, 'utf8')).toBe(f.pristine.get(files[0][0]))
  })
})
