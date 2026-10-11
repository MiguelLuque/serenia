import { NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/server/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const response = NextResponse.redirect(`${origin}/login?error=auth_callback`)
  response.headers.set('Cache-Control', 'private, no-store')
  const code = searchParams.get('code')
  if (code) {
    const supabase = await createAuthenticatedClient(response)
    const flowId = searchParams.get('sb_flow_id')
    const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined)
    if (!error) response.headers.set('Location', `${origin}/app`)
  }
  return response
}
