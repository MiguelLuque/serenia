import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/server/supabase/middleware'

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/api/internal/close-stale-sessions') return NextResponse.next({ request })
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|\\.well-known/workflow/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
