import { statSync } from 'node:fs'

export type Target = Readonly<{ endpoint: string; id: string; nonce: string; schema: string }>
type Identity = { id: unknown; name: unknown; image: unknown; network: unknown; label: unknown }
type Environment = Readonly<Record<string, string | undefined>>

function realSocket(path: string): boolean {
  try { return statSync(path).isSocket() } catch { return false }
}

export function parseTarget(env: Environment, isSocket: (path: string) => boolean = realSocket): Target {
  const endpoint = env.PROBE_DOCKER_ENDPOINT, id = env.PROBE_CONTAINER_ID, nonce = env.PROBE_CONTAINER_NONCE
  if (!endpoint || !/^unix:\/\/\/[^?#\x00]+$/.test(endpoint) || !id || !/^[a-f0-9]{64}$/.test(id) || !nonce || !/^[a-f0-9]{32}$/.test(nonce)) throw new Error('Invalid isolated container target')
  const path = endpoint.slice('unix://'.length)
  if (!isSocket(path)) throw new Error('Docker socket unavailable')
  return Object.freeze({ endpoint, id, nonce, schema: `serenia_probe_${nonce}` })
}

export function verifyIdentity(target: Target, identity: Identity): void {
  if (identity.id !== target.id || identity.name !== `/serenia-profile-dashboard-${target.nonce.slice(0, 12)}` ||
      identity.image !== 'postgres:17.6-bookworm' || identity.network !== 'none' || identity.label !== target.nonce) {
    throw new Error('Isolated container identity mismatch')
  }
}

export function sqlFor(target: Target, scenario: 'race' | 'lost', operation: 'insert' | 'count'): string {
  if (!/^[a-f0-9]{32}$/.test(target.nonce) || target.schema !== `serenia_probe_${target.nonce}` ||
      !['race', 'lost'].includes(scenario) || !['insert', 'count'].includes(operation)) throw new Error('Invalid synthetic query')
  const relation = `"${target.schema}"."${scenario}_reservations"`
  return operation === 'insert'
    ? `INSERT INTO ${relation}(id,actor_type,entity_type,action) VALUES ('f7c9c98c-bc13-48af-9808-bad1f0daaa7f','system','ai_transport_probe','reserved');`
    : `SELECT count(*) FROM ${relation};`
}
