import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { artifactIdentity } from '../../scripts/hosted-start.mjs'

function fixture(test: (snapshot: string, put: (path: string, text?: string) => void, outside: string) => void) {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), 'serenia-artifact-test-')))
  const snapshot = resolve(root, 'project'), outside = resolve(root, 'outside')
  mkdirSync(snapshot); mkdirSync(outside)
  const put = (path: string, text = 'controlled fixture') => {
    mkdirSync(dirname(resolve(snapshot, path)), { recursive: true })
    writeFileSync(resolve(snapshot, path), text)
  }
  for (const path of ['.next/BUILD_ID', '.next/server/app/api/chat/route.js', '.next/server/chunks/runtime.js', '.next/static/chunks/client.js', 'scripts/hosted-provider.mjs', 'app/page.tsx', 'lib/source.ts', 'package.json', 'package-lock.json', 'next.config.ts']) put(path)
  try { test(snapshot, put, outside) } finally { rmSync(root, { recursive: true, force: true }) }
}

// These are the real Next16 response-cache layouts observed after GET/login
// and favicon, outside .next/server/app compiled routes.
const responseFiles = [
  '.next/server/route-cache/APP_PAGE/hash/$/login.html',
  '.next/server/route-cache/APP_PAGE/hash/$/login.meta',
  '.next/server/route-cache/APP_PAGE/hash/$/login.rsc',
  '.next/server/route-cache/APP_PAGE/hash/$/login.segments/__PAGE__.segment.rsc',
  '.next/server/route-cache/APP_ROUTE/hash/$/favicon.ico.body',
  '.next/server/route-cache/APP_ROUTE/hash/$/favicon.ico.meta',
]

describe('hosted immutable artifact with mutable Next response data', () => {
  it('retains the built identity after legitimate response-cache population and refresh', () => fixture((snapshot, put) => {
    const built = artifactIdentity(snapshot)
    for (const path of responseFiles) put(path, 'cached response data')
    expect(artifactIdentity(snapshot)).toEqual(built)
    put(responseFiles[0], 'revalidated response data'); rmSync(resolve(snapshot, responseFiles[1]))
    expect(artifactIdentity(snapshot)).toEqual(built)
  }))
  it.each(['.next/server/app/api/chat/route.js', '.next/server/chunks/runtime.js', '.next/static/chunks/client.js', 'app/page.tsx', 'lib/source.ts', 'scripts/hosted-provider.mjs', 'package-lock.json'])('rejects changed immutable bytes at %s via identity mismatch', path => fixture((snapshot, put) => {
    const built = artifactIdentity(snapshot)
    put(path, 'unexpected code or lock change')
    expect(artifactIdentity(snapshot).aggregateSha256).not.toBe(built.aggregateSha256)
  }))
  it.each(['.next/server/extra.js', '.next/server/route-cache-extra/route.js'])('rejects added code outside the exact cache boundary: %s', path => fixture((snapshot, put) => {
    const built = artifactIdentity(snapshot)
    put(path, 'unexpected added code')
    expect(artifactIdentity(snapshot).aggregateSha256).not.toBe(built.aggregateSha256)
  }))
  it('rejects removed compiled code via identity mismatch', () => fixture(snapshot => {
    const built = artifactIdentity(snapshot)
    rmSync(resolve(snapshot, '.next/server/app/api/chat/route.js'))
    expect(artifactIdentity(snapshot).aggregateSha256).not.toBe(built.aggregateSha256)
  }))
  it.each(['.next/server/route-cache', '.next/cache'])('rejects a symlink at cache boundary %s', path => fixture((snapshot, _put, outside) => {
    symlinkSync(outside, resolve(snapshot, path))
    expect(() => artifactIdentity(snapshot)).toThrow(/symlink/)
  }))
  it('rejects symlinks nested inside the response cache rather than following external data', () => fixture((snapshot, put, outside) => {
    put(responseFiles[0]); symlinkSync(outside, resolve(snapshot, '.next/server/route-cache/external'))
    expect(() => artifactIdentity(snapshot)).toThrow(/symlink/)
  }))
  it('requires a real response-cache directory at the declared boundary', () => fixture((snapshot, put) => {
    put('.next/server/route-cache', 'unexpected regular file')
    expect(() => artifactIdentity(snapshot)).toThrow(/directory/)
  }))
})
