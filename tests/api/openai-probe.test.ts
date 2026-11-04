import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const f = vi.hoisted(() => ({
  order: [] as string[],
  reservationError: false,
  simulateVerifiedReceipt: false,
  userId: '00000000-0000-4000-8000-000000000001',
  generate: vi.fn(),
}))

vi.mock('@/lib/server/supabase/server', () => ({
  createAuthenticatedClient: async () => ({ auth: { getUser: async () => {
    f.order.push('getUser')
    return { data: { user: { id: f.userId } }, error: null }
  } } }),
  createServiceRoleClient: () => ({ from: (table: string) => {
    expect(table).toBe('audit_log')
    return { insert: (value: unknown) => {
      f.order.push('insert')
      expect(value).toEqual({ id: 'f7c9c98c-bc13-48af-9808-bad1f0daaa7f', actor_type: 'system', entity_type: 'ai_transport_probe', action: 'reserved' })
      return { retry: (enabled: boolean) => {
        expect(enabled).toBe(false)
        return { abortSignal: async (signal: AbortSignal) => {
          expect(signal).toBeInstanceOf(AbortSignal)
          return { error: f.reservationError ? { code: '23505' } : null }
        } }
      } }
    } }
  } }),
}))

vi.mock('@/lib/server/llm/clinical-pilot', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/server/llm/clinical-pilot')>()
  return { clinicalPilotEnabled: (...args: Parameters<typeof original.clinicalPilotEnabled>) => {
    f.order.push('allowlist')
    return original.clinicalPilotEnabled(...args)
  } }
})
vi.mock('@/app/api/internal/openai-probe/probe-generation', () => ({ generateOne: f.generate }))
vi.mock('@/app/api/internal/openai-probe/hosted-receipt-gate', async importOriginal => {
  const original = await importOriginal<typeof import('@/app/api/internal/openai-probe/hosted-receipt-gate')>()
  return { verifiedHostedReadback: async () => f.simulateVerifiedReceipt ? true : original.verifiedHostedReadback() }
})

import { POST } from '@/app/api/internal/openai-probe/route'

const request = () => new Request('https://example-preview.vercel.app/api/internal/openai-probe', { method: 'POST', headers: { origin: 'https://example-preview.vercel.app' } })

describe('POST preview probe guard', () => {
  beforeEach(() => {
    f.order.length = 0; f.reservationError = false; f.simulateVerifiedReceipt = false; f.generate.mockReset()
    f.generate.mockImplementation(async (_model, task) => { f.order.push(task); return { complete: true, usage: { inputTokens: 10, outputTokens: 2 } } })
    for (const [name, value] of Object.entries({
      NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'codex/serenia-openai-direct-probe', VERCEL_URL: 'example-preview.vercel.app',
      NEXT_PUBLIC_SUPABASE_URL: 'https://brpozobkoatabctjjadc.supabase.co', OPENAI_PROBE_ENABLED: 'on', LLM_TRANSPORT: 'openai', OPENAI_API_KEY: 'synthetic-only',
      FEATURE_CLINICAL_CONVERSATION_PILOT: 'on', CLINICAL_PILOT_REVIEW_USER_IDS: f.userId,
      LLM_CONVERSATIONAL_PROVIDER: 'openai', LLM_CONVERSATIONAL_MODEL: 'gpt-6-luna',
      LLM_CLOSURE_REPORT_PROVIDER: 'openai', LLM_CLOSURE_REPORT_MODEL: 'gpt-6.1-sol',
    })) vi.stubEnv(name, value)
    vi.stubGlobal('fetch', () => { throw new Error('Unexpected real network') })
  })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  it('does nothing before feature is enabled', async () => {
    vi.stubEnv('OPENAI_PROBE_ENABLED', 'off')
    const response = await POST(request())
    expect(response.status).toBe(404); expect(f.order).toEqual([]); expect(f.generate).not.toHaveBeenCalled()
  })

  it('keeps the actual non-configurable hosted hold closed even if all feature flags are enabled', async () => {
    vi.stubEnv('OPENAI_PROBE_RECEIPT_VERIFIED', 'on') // This value is not evidence and must be ignored.
    const response = await POST(request())
    expect(response.status).toBe(404); expect(f.order).toEqual([]); expect(f.generate).not.toHaveBeenCalled()
  })

  it('rejects an authenticated person outside the actual allowlist before reserving', async () => {
    f.simulateVerifiedReceipt = true // Test-only stub, not a hosted receipt.
    vi.stubEnv('CLINICAL_PILOT_REVIEW_USER_IDS', '00000000-0000-4000-8000-000000000002')
    const response = await POST(request())
    expect(response.status).toBe(404); expect(f.order).toEqual(['getUser', 'allowlist']); expect(f.generate).not.toHaveBeenCalled()
  })

  it('uses getUser then real allowlist then reserve before either generation', async () => {
    f.simulateVerifiedReceipt = true // Test-only stub, not a hosted receipt.
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(f.order).toEqual(['getUser', 'allowlist', 'insert', 'conversation', 'report'])
    expect(await response.json()).toEqual({ status: 'success', usage: [{ inputTokens: 10, outputTokens: 2 }, { inputTokens: 10, outputTokens: 2 }] })
  })

  it('does not generate after a duplicate or failed reservation', async () => {
    f.simulateVerifiedReceipt = true // Test-only stub, not a hosted receipt.
    f.reservationError = true
    const response = await POST(request())
    expect(response.status).toBe(404); expect(f.order).toEqual(['getUser', 'allowlist', 'insert']); expect(f.generate).not.toHaveBeenCalled()
  })
})
