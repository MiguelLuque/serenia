import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTarget, verifyIdentity, sqlFor } from './probe-container'

const id = 'a'.repeat(64), nonce = '1'.repeat(32)
const vars = { PROBE_DOCKER_ENDPOINT: 'unix:///tmp/fake.sock', PROBE_CONTAINER_ID: id, PROBE_CONTAINER_NONCE: nonce }
const expected = { id, name: '/serenia-profile-dashboard-' + nonce.slice(0, 12), image: 'postgres:17.6-bookworm', network: 'none', label: nonce }
const isSocket = (path: string) => path === '/tmp/fake.sock'

test('rejects invalid or missing socket, container ID and unpredictable nonce', () => {
  for (const changed of [
    { PROBE_DOCKER_ENDPOINT: 'tcp://host:2375' },
    { PROBE_DOCKER_ENDPOINT: 'unix://remote/tmp/fake.sock' },
    { PROBE_DOCKER_ENDPOINT: 'unix:///tmp/fake.sock?x=1' },
    { PROBE_DOCKER_ENDPOINT: 'unix:///tmp/not-a-socket' },
    { PROBE_CONTAINER_ID: 'b'.repeat(63) },
    { PROBE_CONTAINER_ID: id + '; rm -rf /' },
    { PROBE_CONTAINER_NONCE: '../public' },
    { PROBE_CONTAINER_NONCE: undefined },
  ]) assert.throws(() => parseTarget({ ...vars, ...changed }, isSocket))
})

test('refuses wrong label, name, image, network or container ID before SQL', () => {
  const target = parseTarget(vars, isSocket)
  for (const changed of [
    { id: 'b'.repeat(64) }, { name: '/other' }, { image: 'postgres:latest' },
    { network: 'host' }, { label: '2'.repeat(32) }, { label: null },
  ]) assert.throws(() => verifyIdentity(target, { ...expected, ...changed }))
  assert.doesNotThrow(() => verifyIdentity(target, expected))
})

test('only emits SELECT/INSERT against two fixed tables inside the nonce-derived schema', () => {
  const target = parseTarget(vars, isSocket)
  for (const scenario of ['race', 'lost'] as const) {
    const insert = sqlFor(target, scenario, 'insert'), count = sqlFor(target, scenario, 'count')
    assert.match(insert, /^INSERT INTO "serenia_probe_[a-f0-9]{32}"\."(?:race|lost)_reservations"/)
    assert.match(count, /^SELECT count\(\*\) FROM "serenia_probe_[a-f0-9]{32}"\."(?:race|lost)_reservations"/)
    assert.doesNotMatch(insert + count, /\b(?:TRUNCATE|DROP|DELETE|UPDATE|public)\b/i)
  }
})
