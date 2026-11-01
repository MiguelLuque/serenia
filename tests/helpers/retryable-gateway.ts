import { createGateway } from '@ai-sdk/gateway'

// Real SDK provider, synthetic credentials and in-memory fetch: no sockets or model calls.
export function retryableGateway() {
  const requests: Array<{ url: string; body: string }> = []
  const gateway = createGateway({
    apiKey: 'synthetic-test-only',
    baseURL: 'https://synthetic.invalid/v1/ai',
    fetch: async (url, init) => {
      requests.push({ url: String(url), body: String(init?.body) })
      return new Response(JSON.stringify({ error: { message: 'Synthetic unavailable' } }), {
        status: 503, headers: { 'content-type': 'application/json' },
      })
    },
  })
  return { gateway, requests }
}
