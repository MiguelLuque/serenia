import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/shared/supabase/types'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const refreshHeaders = new Headers()
  function redirect(path: string) {
    const redirected = NextResponse.redirect(new URL(path, request.url))
    response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie))
    refreshHeaders.forEach((value, name) => redirected.headers.set(name, value))
    return redirected
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          const previousCookies = response.cookies.getAll()
          response = NextResponse.next({ request })
          previousCookies.forEach(cookie => response.cookies.set(cookie))
          Object.entries(headers).forEach(([name, value]) => refreshHeaders.set(name, value))
          refreshHeaders.forEach((value, name) => response.headers.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user: sessionUser }, error: authError } = await supabase.auth.getUser()
  const user = authError ? null : sessionUser
  const path = request.nextUrl.pathname

  const isPublic =
    path.startsWith('/login') ||
    path.startsWith('/registro') ||
    path.startsWith('/auth/callback') ||
    path === '/privacidad' ||
    path === '/terminos' ||
    path === '/'

  if (!user && !isPublic) {
    return redirect('/login')
  }

  if (user && (path === '/login' || path === '/registro')) {
    return redirect('/app')
  }

  if (user && (path.startsWith('/app') || path === '/onboarding')) {
    const { data: ready, error } = await supabase.rpc('get_onboarding_ready')
    if (path.startsWith('/app') && (error || ready !== true)) return redirect('/onboarding')
    if (path === '/onboarding' && !error && ready === true) return redirect('/app')
  }

  return response
}
